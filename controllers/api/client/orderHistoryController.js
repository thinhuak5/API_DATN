// controllers/orderController.js
const Order = require("../../../models/order");
const OrderItem = require("../../../models/OrderItem");
const ProductVariation = require("../../../models/productVariation");
const ProductImage = require("../../../models/productImage");

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
              as: "variation", // Đảm bảo dùng variation nếu thay đổi ở models
              attributes: ["id", "name", "value", "price"],
              include: [
                {
                  model: ProductImage,
                  as: "productImages",
                  attributes: ["image_url"],
                  limit: 1, // Chỉ lấy ảnh đầu tiên
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Định dạng lại dữ liệu để trả về URL Cloudinary trực tiếp
    const ordersWithTotal = orders.map((order) => {
      const orderJSON = order.toJSON();
      orderJSON.items = orderJSON.items.map((item) => {
        // Lấy image_url từ productImages (Cloudinary URL)
        if (
          item.variation &&
          item.variation.productImages &&
          item.variation.productImages.length > 0
        ) {
          item.variation.image_url = item.variation.productImages[0].image_url;
          delete item.variation.productImages; // Xóa productImages để giảm payload
        } else {
          item.variation.image_url = null; // Hoặc trả về URL ảnh mặc định nếu cần
        }
        return item;
      });

      // Tính tổng tiền
      orderJSON.totalAmount = orderJSON.items.reduce((sum, item) => {
        const price = Number(item.variation?.price || item.price) || 0;
        const quantity = Number(item.quantity) || 0;
        return sum + price * quantity;
      }, 0);

      return orderJSON;
    });

    console.log("--- getOrderHistory Result ---");
    ordersWithTotal.forEach((order) => {
      console.log(`Order ID: ${order.id}, Total Amount: ${order.totalAmount}`);
      order.items.forEach((item) => {
        console.log(
          `  Product Variation: ${item.variation.name}, Image URL: ${item.variation.image_url}`
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
      return res
        .status(400)
        .json({ message: "Lý do hủy đơn hàng là bắt buộc." });
    }

    const order = await Order.findOne({
      where: {
        id: orderId,
        user_id: userId,
      },
      transaction: t,
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn này.",
      });
    }

    if (order.status !== 1) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Không thể hủy đơn hàng ở trạng thái này." });
    }

    order.status = 0;
    order.cancellation_reason = reason.trim();
    order.cancelledAt = new Date();

    await order.save({ transaction: t });

    await t.commit();
    console.log(`Đơn hàng #${orderId} đã được hủy. Lý do: ${reason.trim()}`);
    res.json({
      message: `Đơn hàng #${orderId} đã được hủy thành công.`,
      orderId: orderId,
      newStatus: 0,
      reason: reason.trim(),
    });
  } catch (error) {
    await t.rollback();
    console.error(`Lỗi khi hủy đơn hàng #${orderId}:`, error);
    res.status(500).json({
      message: "Đã xảy ra lỗi khi hủy đơn hàng.",
      error: error.message,
    });
  }
};

