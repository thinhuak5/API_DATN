// controllers/orderController.js
const Order = require("../../../models/order");
const OrderItem = require("../../../models/OrderItem");
const ProductVariation = require("../../../models/productVariation");
const ProductImage = require("../../../models/productImage");
const database = require("../../../models/database");

// =============== GET /api/orders/history =================
exports.getOrderHistory = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  }
  const userId = req.user.id;

  try {
    const orders = await Order.findAll({
      where: { user_id: userId },
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: ProductVariation,
              as: "variation",
              attributes: ["id", "name", "price"],
              include: [
                {
                  model: ProductImage,
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

    const ordersWithTotal = orders.map((order) => {
      const o = order.toJSON();

      o.items = (o.items || []).map((item) => {
        if (
          item.variation &&
          item.variation.productImages &&
          item.variation.productImages.length > 0
        ) {
          item.variation.image_url = item.variation.productImages[0].image_url;
          delete item.variation.productImages;
        } else {
          item.variation.image_url = null; // FE sẽ tự fallback "Không có ảnh"
        }
        return item;
      });

      // Tổng tiền (không trừ giảm giá ở đây; FE đã hiển thị -discount nếu có)
      o.totalAmount = (o.items || []).reduce((sum, it) => {
        const price = Number(it.variation?.price || it.price) || 0;
        const qty = Number(it.quantity) || 0;
        return sum + price * qty;
      }, 0);

      return o;
    });

    console.log("--- getOrderHistory Result ---");
    ordersWithTotal.forEach((order) => {
      console.log(`Order ID: ${order.id}, Total Amount: ${order.totalAmount}`);
      (order.items || []).forEach((it) => {
        console.log(
          `  Product Variation: ${it.variation?.name} | Image URL: ${it.variation?.image_url}`
        );
      });
    });

    res.json(ordersWithTotal);
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử đơn hàng:", error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi truy vấn lịch sử đơn hàng.",
      error: error.message,
    });
  }
};

// =============== PUT /api/orders/:id/cancel ==============
// =============== PUT /api/orders/:id/cancel ==============
exports.cancelOrder = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: "Yêu cầu không được xác thực." });
  }
  const userId = req.user.id;
  const { id: orderId } = req.params;
  const { reason } = req.body;

  const t = await database.transaction();
  try {
    if (!reason || reason.trim() === "") {
      await t.rollback();
      return res.status(400).json({ message: "Lý do hủy đơn hàng là bắt buộc." });
    }

    // Lấy đơn + items để hoàn kho
    const order = await Order.findOne({
      where: { id: orderId, user_id: userId },
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: ["id", "variation_id", "quantity"],
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE, // SELECT ... FOR UPDATE (tùy DB)
    });

    if (!order) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn này." });
    }

    // Không cho hủy nếu đã hủy
    if (Number(order.status) === 0) {
      await t.rollback();
      return res.status(400).json({ message: "Đơn hàng đã bị hủy trước đó." });
    }

    // ✅ CHO PHÉP hủy khi trạng thái là 1 (Chờ xác nhận) hoặc 2 (Đã xác nhận)
    //    Dùng includes để tránh lỗi toán tử dấu phẩy
    if (![1, 2].includes(Number(order.status))) {
      await t.rollback();
      return res.status(400).json({ message: "Không thể hủy đơn hàng ở trạng thái này." });
    }

    // Hoàn kho theo từng item
    for (const it of order.items || []) {
      if (it.variation_id) {
        await ProductVariation.increment("quantity", {
          by: Number(it.quantity) || 0,
          where: { id: it.variation_id },
          transaction: t,
        });
      }
    }

    // Cập nhật trạng thái đơn
    order.status = 0; // Đã hủy
    order.cancellation_reason = reason.trim();
    order.cancelledAt = new Date();
    await order.save({ transaction: t });

    await t.commit();

    console.log(`Đơn hàng #${orderId} đã được hủy. Hoàn kho xong. Lý do: ${reason.trim()}`);

    return res.json({
      message: `Đơn hàng #${orderId} đã được hủy thành công.`,
      orderId,
      newStatus: 0,
      reason: reason.trim(),
    });
  } catch (error) {
    await t.rollback();
    console.error(`Lỗi khi hủy đơn hàng #${orderId}:`, error);
    return res
      .status(500)
      .json({ message: "Đã xảy ra lỗi khi hủy đơn hàng.", error: error.message });
  }
};

