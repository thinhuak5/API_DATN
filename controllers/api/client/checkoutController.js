// controllers/orderController.js
const sequelize = require('../../../models/database');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const ProductVariation = require('../../../models/productVariation');
const Product = require('../../../models/product');
const Discount = require('../../../models/discount');

/* ================= Helpers ================= */
const onlyDigits = (s) => String(s || '').replace(/\D+/g, '');
const normalizeVNPhoneE164 = (raw) => {
  // Hỗ trợ các dạng: "+84...", "84...", "0...", "xxxxxxxxx"
  let d = onlyDigits(raw);
  if (!d) return '';

  if (d.startsWith('84')) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);

  // chấp nhận 9–10 số local, normalize về +84 + local
  if (d.length < 8 || d.length > 10) return '';
  return `+84${d}`;
};

exports.createOrder = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Yêu cầu không được xác thực.' });
  }
  const userId = req.user.id;

  const {
    items,
    name,
    phone,
    address,
    payment_id,
    payment_status,
    discount_id,
    discount_amount,
    total_amount,
  } = req.body || {};

  // Validate thô
  if (!Array.isArray(items) || items.length === 0 || !name || !phone || !address) {
    return res
      .status(400)
      .json({ message: 'Dữ liệu đơn hàng không hợp lệ hoặc thiếu thông tin bắt buộc.' });
  }

  const safeName = String(name).trim();
  const safePhone = normalizeVNPhoneE164(phone);

  if (!safeName) {
    return res.status(400).json({ message: 'Tên người nhận không hợp lệ.' });
  }
  if (!safePhone) {
    return res
      .status(400)
      .json({ message: 'Số điện thoại không hợp lệ. Vui lòng nhập dạng +84...' });
  }

  const t = await sequelize.transaction();
  try {
    // Chuẩn hoá item
    const normItems = (items || [])
      .map((it) => ({
        product_id: it.productId ?? it.product_id ?? null,
        variation_id: it.variationId ?? it.variation_id ?? null,
        quantity: Number(it.quantity || 0),
        price: Number(it.price ?? 0),
      }))
      .filter((x) => x.quantity > 0 && (x.variation_id || x.product_id));

    if (normItems.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: 'Không có item hợp lệ.' });
    }

    // Gom số lượng theo variation để khóa kiểm tồn 1 lần
    const qtyByVar = new Map();
    for (const it of normItems) {
      if (!it.variation_id) continue;
      qtyByVar.set(it.variation_id, (qtyByVar.get(it.variation_id) || 0) + it.quantity);
    }
    const variationIds = Array.from(qtyByVar.keys());

    // Khóa bản ghi biến thể
    let varRows = [];
    if (variationIds.length) {
      varRows = await ProductVariation.findAll({
        where: { id: variationIds },
        attributes: ['id', 'price', 'quantity', 'product_id'],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
    }
    const varById = new Map(varRows.map((v) => [v.id, v]));

    // Check tồn
    const insufficient = [];
    for (const vId of variationIds) {
      const need = qtyByVar.get(vId) || 0;
      const row = varById.get(vId);
      if (!row) {
        insufficient.push({ variation_id: vId, reason: 'variation_not_found' });
      } else if ((row.quantity || 0) < need) {
        insufficient.push({
          variation_id: vId,
          need,
          stock: row.quantity || 0,
          reason: 'not_enough_stock',
        });
      }
    }
    if (insufficient.length) {
      await t.rollback();
      return res
        .status(409)
        .json({ message: 'Một số biến thể không đủ tồn kho.', insufficient });
    }

    // Mã giảm giá (nếu có)
    let discountData = null;
    if (discount_id) {
      const d = await Discount.findByPk(discount_id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (d) {
        const now = new Date();
        const valid =
          d.status &&
          (d.quantity ?? 0) > 0 &&
          (!d.start_date || d.start_date <= now) &&
          (!d.end_date || d.end_date >= now);
        if (valid) {
          await d.update(
            {
              used: (d.used || 0) + 1,
              quantity: (d.quantity || 0) - 1,
            },
            { transaction: t }
          );
          discountData = {
            id: d.id,
            code: d.code,
            discount_type: d.discount_type,
            discount_value: d.discount_value,
          };
        }
      }
    }

    // Tạo order
    const newOrder = await Order.create(
      {
        user_id: userId,
        name: safeName,
        phone: safePhone,
        address: String(address).trim(),
        payment_id: payment_id ?? null,
        payment_status: Number(payment_status) === 1 ? 1 : 0,
        status: 1,
        discount_id: discountData ? discountData.id : null,
        discount_amount: Number(discount_amount || 0),
        total_amount: total_amount ? Number(total_amount) : null,
      },
      { transaction: t }
    );

    // Ghi order items, ưu tiên giá từ variation
    let calculatedTotal = 0;
    const toCreate = [];
    for (const it of normItems) {
      let price = Number(it.price || 0);
      let varId = it.variation_id || null;

      if (varId) {
        const v = varById.get(varId) ||
          (await ProductVariation.findByPk(varId, { transaction: t }));
        if (v && v.price != null) price = Number(v.price);
        else if (!v) varId = null;
      } else if (it.product_id) {
        const p = await Product.findByPk(it.product_id, { transaction: t });
        if (p && p.price != null) price = Number(p.price);
      }

      calculatedTotal += price * it.quantity;
      toCreate.push({
        order_id: newOrder.id,
        product_id: it.product_id,
        variation_id: varId,
        quantity: it.quantity,
        price,
      });
    }

    if (!toCreate.length) {
      await t.rollback();
      return res.status(400).json({ message: 'Không có item hợp lệ trong đơn hàng.' });
    }
    await OrderItem.bulkCreate(toCreate, { transaction: t });

    // Tính total nếu FE không gửi
    if (!total_amount) {
      let finalTotal = calculatedTotal;
      if (discountData) {
        if (discountData.discount_type === 'percent') {
          finalTotal =
            calculatedTotal * (1 - Number(discountData.discount_value || 0) / 100);
        } else if (discountData.discount_type === 'fixed') {
          finalTotal = Math.max(
            calculatedTotal - Number(discountData.discount_value || 0),
            0
          );
        }
      } else if (newOrder.discount_amount) {
        finalTotal = Math.max(
          calculatedTotal - Number(newOrder.discount_amount || 0),
          0
        );
      }
      await newOrder.update({ total_amount: Math.round(finalTotal) }, { transaction: t });
    }

    // Trừ kho + cộng sold
    for (const [vId, need] of qtyByVar.entries()) {
      await ProductVariation.update(
        {
          quantity: sequelize.literal(`GREATEST(quantity - ${need}, 0)`),
          sold: sequelize.literal(`COALESCE(sold, 0) + ${need}`),
        },
        { where: { id: vId }, transaction: t }
      );
    }

    // Ẩn sản phẩm nếu hết hàng toàn bộ biến thể
    const affectedProductIds = [...new Set(varRows.map((v) => v.product_id))];
    for (const pid of affectedProductIds) {
      const remain =
        (await ProductVariation.sum('quantity', {
          where: { product_id: pid },
          transaction: t,
        })) || 0;
      if (remain <= 0) {
        await Product.update({ status: 0 }, { where: { id: pid }, transaction: t });
      }
    }

    await t.commit();
    return res.status(201).json({
      message: 'Đặt hàng thành công và đã trừ kho!',
      order: newOrder,
      discount: discountData,
    });
  } catch (err) {
    await t.rollback();
    console.error('Lỗi khi tạo đơn hàng:', err);
    return res.status(500).json({
      message: 'Đã xảy ra lỗi trong quá trình xử lý đơn hàng.',
      error: err.message,
    });
  }
};
