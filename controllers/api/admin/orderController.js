const { Sequelize } = require("sequelize");
const orderModel = require("../../../models/order");
const orderItemModel = require("../../../models/OrderItem");
const productVariationModel = require("../../../models/productVariation");
const productImageModel = require("../../../models/productImage");
const productModel = require("../../../models/product");

// helper số an toàn
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const attachImageAndTotals = (orderJson) => {
  const o = { ...orderJson };

  // Gán image_url cho variation
  o.items = (o.items || []).map((item) => {
    if (item?.variation?.productImages?.length) {
      item.variation.image_url = item.variation.productImages[0].image_url;
    } else {
      if (!item.variation) item.variation = {};
      item.variation.image_url = null;
    }
    if (item.variation) delete item.variation.productImages;
    return item;
  });

  // Chuẩn hoá payment_id (FE dùng key này)
  o.payment_id = n(o.payment_id ?? o.payments);
  // (tuỳ bạn) có thể xoá trường cũ:
  // delete o.payments;

  // Tính subtotal và total fallback
  const subtotal = (o.items || []).reduce((sum, it) => {
    const price = n(it?.variation?.price ?? it?.price);
    const qty = n(it?.quantity);
    return sum + price * qty;
  }, 0);

  const discount = n(o.discount_amount); // nếu không có cột này, sẽ = 0
  const dbTotal = n(o.total_amount);

  // Trả về các field mà FE đọc
  o.subtotal = subtotal;
  o.discount_amount = discount;
  o.total_amount = dbTotal > 0 ? dbTotal : Math.max(0, subtotal - discount);

  return o;
};

exports.getAll = async (req, res) => {
  try {
    const orders = await orderModel.findAll({
      include: [
        {
          model: orderItemModel,
          as: "items",
          include: [
            {
              model: productVariationModel,
              as: "variation",
              attributes: ["id", "name", "price"],
              include: [
                {
                  model: productImageModel,
                  as: "productImages",
                  attributes: ["image_url"],
                  limit: 1,
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const data = orders.map((o) => attachImageAndTotals(o.toJSON()));
    return res.json(data); // FE đang res.data hoặc mảng trực tiếp
  } catch (error) {
    console.error("Lỗi getAll orders:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

exports.detail = async (req, res) => {
  try {
    const order = await orderModel.findByPk(req.params.id, {
      include: [
        {
          model: orderItemModel,
          as: "items",
          include: [
            {
              model: productVariationModel,
              as: "variation",
              attributes: ["id", "name", "price"],
              include: [
                {
                  model: productImageModel,
                  as: "productImages",
                  attributes: ["image_url"],
                  limit: 1,
                },
              ],
            },
          ],
        },
      ],
    });

    if (!order) return res.status(404).json({ error: "Đơn hàng không tồn tại" });

    const o = attachImageAndTotals(order.toJSON());
    return res.json(o);
  } catch (error) {
    console.error("detail order error:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

exports.create = async (req, res) => {
  try {
    const { user_id, payments, payment_status, status, phone, name, address } = req.body;
    const newOrder = await orderModel.create({
      user_id,
      payments,
      payment_status,
      status,
      phone,
      name,
      address,
    });
    return res
      .status(201)
      .json({ message: "Đơn hàng đã được tạo thành công!", order: newOrder });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Lỗi khi tạo đơn hàng" });
  }
};

exports.update = async (req, res) => {
  const t = await orderModel.sequelize.transaction();
  try {
    const orderId = req.params.id;
    const { payment_status, status } = req.body;

    const order = await orderModel.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: "Đơn hàng không tìm thấy" });
    }

    const prevStatus = order.status;
    const nextStatus = typeof status === "number" ? status : prevStatus;
    const nextPaymentStatus =
      typeof payment_status === "number" ? payment_status : order.payment_status;

    const needDeduct = nextStatus === 4 && order.stock_deducted !== 1;

    if (needDeduct) {
      const orderItems = await orderItemModel.findAll({
        where: { order_id: orderId },
        attributes: ["id", "variation_id", "quantity"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const variationIds = orderItems.map((i) => i.variation_id).filter(Boolean);
      const variationMeta = variationIds.length
        ? await productVariationModel.findAll({
            where: { id: variationIds },
            attributes: ["id", "product_id"],
            transaction: t,
          })
        : [];

      const affectedProductIds = [...new Set(variationMeta.map((v) => v.product_id))];

      for (const it of orderItems) {
        const variationId = it.variation_id;
        const qty = n(it.quantity);
        if (!variationId || qty <= 0) continue;

        await productVariationModel.update(
          {
            quantity: Sequelize.literal(`GREATEST(quantity - ${qty}, 0)`),
            sold: Sequelize.literal(`sold + ${qty}`),
          },
          { where: { id: variationId }, transaction: t }
        );
      }

      for (const pid of affectedProductIds) {
        const remain =
          (await productVariationModel.sum("quantity", {
            where: { product_id: pid },
            transaction: t,
          })) || 0;

        if (remain <= 0) {
          await productModel.update({ status: 0 }, { where: { id: pid }, transaction: t });
        }
      }

      await orderModel.update(
        { status: nextStatus, payment_status: nextPaymentStatus, stock_deducted: 1 },
        { where: { id: orderId }, transaction: t }
      );
    } else {
      await orderModel.update(
        { status: nextStatus, payment_status: nextPaymentStatus, stock_deducted: order.stock_deducted },
        { where: { id: orderId }, transaction: t }
      );
    }

    await t.commit();
    return res.status(200).json({
      message: needDeduct
        ? "Cập nhật đơn hàng thành công, đã trừ kho và kiểm tra ẩn sản phẩm."
        : "Cập nhật đơn hàng thành công.",
    });
  } catch (error) {
    console.error(error);
    await t.rollback();
    return res.status(500).json({ error: "Lỗi khi cập nhật đơn hàng" });
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await orderModel.destroy({ where: { id: req.params.id } });
    if (deleted === 0) return res.status(404).json({ error: "Đơn hàng không tồn tại" });
    return res.json({ message: "Xóa đơn hàng thành công" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};
