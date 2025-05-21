// controllers/api/client/orderHistoryController.js
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const Product = require('../../../models/product');

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
                    as: 'items',
                    include: [
                        {
                            model: Product,
                            as: 'product',
                            attributes: ['id', 'name', 'images']
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']]
        });

        const ordersWithTotal = orders.map(order => {
            const orderJSON = order.toJSON();
            orderJSON.totalAmount = orderJSON.items.reduce((sum, item) => {
                const price = Number(item.price) || 0;
                const quantity = Number(item.quantity) || 0;
                return sum + (price * quantity);
            }, 0);
            return orderJSON;
        });

        res.json(ordersWithTotal);

    } catch (error) {
        console.error("Lỗi khi lấy lịch sử đơn hàng:", error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi truy vấn lịch sử đơn hàng." });
    }
};

// Hàm cancelOrder đã được chỉnh sửa và chỉ còn một bản duy nhất
exports.cancelOrder = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ message: "Yêu cầu không được xác thực." });
    }
    const userId = req.user.id;
    const { id: orderId } = req.params;
    const { reason } = req.body; // Lấy lý do hủy từ body

    if (!reason || reason.trim() === '') {
        return res.status(400).json({ message: "Lý do hủy đơn hàng là bắt buộc." });
    }

    try {
        const order = await Order.findOne({
            where: {
                id: orderId,
                user_id: userId // Đảm bảo user chỉ hủy được đơn hàng của chính mình
            }
        });

        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn này." });
        }

        // Kiểm tra trạng thái đơn hàng có cho phép hủy không (ví dụ: chỉ cho hủy khi status=1)
        if (order.status !== 1) { // 1: Chờ xác nhận
            return res.status(400).json({ message: "Không thể hủy đơn hàng ở trạng thái này." });
        }

        order.status = 0; // 0: Đã hủy
        order.cancellation_reason = reason.trim(); // Lưu lý do hủy vào trường mới
        order.cancelledAt = new Date(); // Thêm thời gian hủy nếu muốn

        await order.save();

        res.json({ message: `Đơn hàng #${orderId} đã được hủy thành công.`, orderId: orderId, newStatus: 0, reason: reason.trim() });

    } catch (error) {
        console.error(`Lỗi khi hủy đơn hàng #${orderId}:`, error);
        res.status(500).json({ message: "Đã xảy ra lỗi khi hủy đơn hàng." });
    }
};