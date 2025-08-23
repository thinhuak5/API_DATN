
const sequelize = require('../../../models/database');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const ProductVariation = require('../../../models/productVariation');
const Product = require('../../../models/product');
const Discount = require('../../../models/discount');

exports.createOrder = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    console.error("Lỗi: req.user không tồn tại trong createOrder.");
    return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  }
  const authenticatedUserId = req.user.id;
  console.log(`Authenticated User ID: ${authenticatedUserId}`);

  const {
    items,
    name,
    phone,
    address,
    payment_id,
    payment_status,
    discount_id,
    discount_amount,
    total_amount
  } = req.body || {};

  console.log("Received checkout data:", req.body);

  // ===== [TC1] Thiếu dữ liệu / giỏ trống
  if (!Array.isArray(items) || items.length === 0 || !name || !phone || !address) {
    return res.status(400).json({ message: "Dữ liệu đơn hàng không hợp lệ hoặc thiếu thông tin bắt buộc." });
  }

  const t = await sequelize.transaction();
  try {
    // ===== [TC2] Chuẩn hoá & gộp số lượng theo variation (để kiểm tồn một lần)
    const normItems = items
      .map((it) => ({
        product_id: it.productId ?? it.product_id ?? null,
        variation_id: it.variationId ?? it.variation_id ?? null,
        quantity: Number(it.quantity || 0),
        price: it.price, // ưu tiên bị override bởi giá variation
      }))
      .filter((it) => it.quantity > 0 && (it.variation_id || it.product_id));

    if (normItems.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "Không có item hợp lệ." });
    }

    // Gom qty theo variation
    const qtyByVar = new Map();
    for (const it of normItems) {
      if (!it.variation_id) continue;
      qtyByVar.set(it.variation_id, (qtyByVar.get(it.variation_id) || 0) + it.quantity);
    }
    const variationIds = Array.from(qtyByVar.keys());

    // ===== [TC3] Khoá bản ghi biến thể & kiểm tra tồn (FOR UPDATE)
    let varRows = [];
    if (variationIds.length) {
      varRows = await ProductVariation.findAll({
        where: { id: variationIds },
        attributes: ["id", "price", "quantity", "product_id"],
        transaction: t,
        lock: t.LOCK.UPDATE, // chống race
      });
    }
    const varById = new Map(varRows.map((v) => [v.id, v]));

    // ===== [TC4] Báo lỗi nếu không đủ tồn / không tìm thấy biến thể
    const insufficient = [];
    for (const vId of variationIds) {
      const need = qtyByVar.get(vId) || 0;
      const row = varById.get(vId);
      if (!row) {
        insufficient.push({ variation_id: vId, reason: "variation_not_found" });
      } else if ((row.quantity || 0) < need) {
        insufficient.push({ variation_id: vId, need, stock: row.quantity || 0, reason: "not_enough_stock" });
      }
    }
    if (insufficient.length) {
      await t.rollback();
      return res.status(409).json({ message: "Một số biến thể không đủ tồn kho.", insufficient });
    }

    // ===== [TC5] Xử lý mã giảm giá (nếu có) – đồng bộ với code cũ
    let discountData = null;
    if (discount_id) {
      const discount = await Discount.findByPk(discount_id, { transaction: t, lock: t.LOCK.UPDATE });
      if (discount) {
        const now = new Date();
        const valid =
          discount.status &&
          (discount.quantity ?? 0) > 0 &&
          (!discount.start_date || discount.start_date <= now) &&
          (!discount.end_date || discount.end_date >= now);
        if (valid) {
          await discount.update(
            { used: (discount.used || 0) + 1, quantity: (discount.quantity || 0) - 1 },
            { transaction: t }
          );
          discountData = {
            id: discount.id,
            code: discount.code,
            discount_type: discount.discount_type,
            discount_value: discount.discount_value,
          };
        } else {
          console.warn(`Mã giảm giá ID ${discount_id} không còn hiệu lực.`);
        }
      } else {
        console.warn(`Mã giảm giá ID ${discount_id} không tồn tại.`);
      }
    }

    // ===== [TC6] Tạo Order (trạng thái 1), không cần cờ stock_deducted ở phía client
    const newOrder = await Order.create(
      {
        user_id: authenticatedUserId,
        name,
        phone,
        address,
        payment_id: payment_id || null,
        payment_status: Number(payment_status) === 1 ? 1 : 0,
        status: 1,
        discount_id: discountData ? discountData.id : null,
        discount_amount: discount_amount || 0,
        total_amount: total_amount || null,
      },
      { transaction: t }
    );

    const orderId = newOrder.id;

    // ===== [TC7] Ghi OrderItems — giá ưu tiên lấy từ variation nếu có
    const orderItemsData = [];
    let calculatedTotal = 0;

    for (const it of normItems) {
      let finalPrice = Number(it.price || 0);
      let variationIdToSave = it.variation_id || null;

      if (variationIdToSave) {
        const v = varById.get(variationIdToSave) ||
          (await ProductVariation.findByPk(variationIdToSave, { transaction: t }));
        if (v && v.price != null) {
          finalPrice = Number(v.price);
        } else if (!v) {
          console.warn(`Biến thể ID ${variationIdToSave} không tìm thấy trong DB. Đặt variation_id về null.`);
          variationIdToSave = null;
        }
      } else if (it.product_id) {
        const p = await Product.findByPk(it.product_id, { transaction: t });
        if (p && p.price != null) finalPrice = Number(p.price);
      }

      calculatedTotal += finalPrice * it.quantity;

      orderItemsData.push({
        order_id: orderId,
        product_id: it.product_id,
        variation_id: variationIdToSave,
        quantity: it.quantity,
        price: finalPrice,
      });
    }

    if (orderItemsData.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "Không có item hợp lệ trong đơn hàng." });
    }

    await OrderItem.bulkCreate(orderItemsData, { transaction: t });

    // ===== [TC8] Tính total nếu FE không gửi
    if (!total_amount) {
      let finalTotal = calculatedTotal;
      if (discountData) {
        if (discountData.discount_type === "percent") {
          finalTotal = calculatedTotal * (1 - Number(discountData.discount_value || 0) / 100);
        } else if (discountData.discount_type === "fixed") {
          finalTotal = Math.max(calculatedTotal - Number(discountData.discount_value || 0), 0);
        }
      } else if (newOrder.discount_amount) {
        finalTotal = Math.max(calculatedTotal - Number(newOrder.discount_amount || 0), 0);
      }
      await newOrder.update({ total_amount: Math.round(finalTotal) }, { transaction: t });
    }

    // ===== [TC9] TRỪ KHO NGAY (port y nguyên tinh thần admin/update) — dùng sequelize.literal
// ==== 9) TRỪ KHO + CỘNG SOLD NGAY ====
for (const [vId, need] of qtyByVar.entries()) {
  await ProductVariation.update(
    {
      quantity: sequelize.literal(`GREATEST(quantity - ${need}, 0)`),
      sold:     sequelize.literal(`COALESCE(sold, 0) + ${need}`),
    },
    { where: { id: vId }, transaction: t }
  );
}


    // ===== [TC10] Ẩn sản phẩm nếu tổng tồn của tất cả biến thể = 0
    const affectedProductIds = [...new Set(varRows.map(v => v.product_id))];
    for (const pid of affectedProductIds) {
      const remain = (await ProductVariation.sum("quantity", { where: { product_id: pid }, transaction: t })) || 0;
      if (remain <= 0) {
        await Product.update({ status: 0 }, { where: { id: pid }, transaction: t });
      }
    }

    await t.commit();

    console.log("Order created + deducted stock:", newOrder.toJSON());
    return res.status(201).json({
      message: "Đặt hàng thành công và đã trừ kho!",
      order: newOrder,
      discount: discountData,
    });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi tạo đơn hàng:", error);
    return res.status(500).json({
      message: "Đã xảy ra lỗi trong quá trình xử lý đơn hàng.",
      error: error.message,
    });
  }
};
