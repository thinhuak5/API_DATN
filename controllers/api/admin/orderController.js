const { Sequelize } = require("sequelize");
const orderModel = require("../../../models/order");
const orderItemModel = require("../../../models/OrderItem");
const productVariationModel = require("../../../models/productVariation");
const productImageModel = require("../../../models/productImage");
const productModel = require("../../../models/product");

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

    const data = orders.map((order) => {
      const o = order.toJSON();
      o.items = o.items.map((item) => {
        if (
          item.variation &&
          item.variation.productImages &&
          item.variation.productImages.length > 0
        ) {
          item.variation.image_url = item.variation.productImages[0].image_url;
        } else {
          item.variation.image_url = null;
        }
        delete item.variation.productImages;
        return item;
      });
      o.totalAmount = o.items.reduce((sum, item) => {
        const price = Number(item.variation?.price ?? item.price) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + price * qty;
      }, 0);
      return o;
    });

    res.json(data);
  } catch (error) {
    console.error("Lỗi getAll orders:", error);
    res.status(500).json({ error: "Lỗi server" });
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

    if (!order) {
      return res.status(404).json({ error: "Đơn hàng không tồn tại" });
    }

    const o = order.toJSON();
    o.items = o.items.map((item) => {
      if (
        item.variation &&
        item.variation.productImages &&
        item.variation.productImages.length > 0
      ) {
        item.variation.image_url = item.variation.productImages[0].image_url;
      } else {
        item.variation.image_url = null;
      }
      delete item.variation.productImages;
      return item;
    });
    o.totalAmount = o.items.reduce((sum, item) => {
      const price = Number(item.variation?.price ?? item.price) || 0;
      const qty = Number(item.quantity) || 0;
      return sum + price * qty;
    }, 0);

    res.json(o);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
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
    res.status(201).json({ message: "Đơn hàng đã được tạo thành công!", order: newOrder });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi khi tạo đơn hàng" });
  }
};

exports.update = async (req, res) => {
  const t = await orderModel.sequelize.transaction();
  try {
    const orderId = req.params.id;
    const { payment_status, status } = req.body;

    // 1) Lấy đơn hiện tại (lock để tránh race)
    const order = await orderModel.findByPk(orderId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!order) {
      await t.rollback();
      return res.status(404).json({ error: "Đơn hàng không tìm thấy" });
    }

    const prevStatus = order.status;
    const nextStatus = typeof status === "number" ? status : prevStatus;
    const nextPaymentStatus =
      typeof payment_status === "number" ? payment_status : order.payment_status;

    // 2) Lần đầu vào trạng thái 4 -> trừ kho biến thể
    const needDeduct = nextStatus === 4 && order.stock_deducted !== 1;

    if (needDeduct) {
      const orderItems = await orderItemModel.findAll({
        where: { order_id: orderId },
        attributes: ["id", "variation_id", "quantity"],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      const variationIds = orderItems.map(i => i.variation_id).filter(Boolean);
      const variationMeta = variationIds.length
        ? await productVariationModel.findAll({
            where: { id: variationIds },
            attributes: ["id", "product_id"],
            transaction: t,
          })
        : [];

      const affectedProductIds = [...new Set(variationMeta.map(v => v.product_id))];

      // Trừ tồn & cộng sold cho từng biến thể
      for (const it of orderItems) {
        const variationId = it.variation_id;
        const qty = Number(it.quantity) || 0;
        if (!variationId || qty <= 0) continue;

        await productVariationModel.update(
          {
            quantity: Sequelize.literal(`GREATEST(quantity - ${qty}, 0)`),
            sold: Sequelize.literal(`sold + ${qty}`),
          },
          { where: { id: variationId }, transaction: t }
        );
      }

      // 3) Nếu tổng tồn của tất cả biến thể của 1 sản phẩm = 0 -> Ẩn sản phẩm
      for (const pid of affectedProductIds) {
        const remain = (await productVariationModel.sum("quantity", {
          where: { product_id: pid },
          transaction: t,
        })) || 0;

        if (remain <= 0) {
          await productModel.update(
            { status: 0 }, // 0 = Ẩn
            { where: { id: pid }, transaction: t }
          );
        }
      }

      // 4) Cập nhật trạng thái + đánh dấu đã trừ kho
      await orderModel.update(
        {
          status: nextStatus,
          payment_status: nextPaymentStatus,
          stock_deducted: 1,
        },
        { where: { id: orderId }, transaction: t }
      );
    } else {
      // Không cần trừ kho
      await orderModel.update(
        {
          status: nextStatus,
          payment_status: nextPaymentStatus,
          stock_deducted: order.stock_deducted,
        },
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
    if (deleted === 0) {
      return res.status(404).json({ error: "Đơn hàng không tồn tại" });
    }
    res.json({ message: "Xóa đơn hàng thành công" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
  }
};
