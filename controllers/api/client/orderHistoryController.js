// controllers/api/client/orderHistoryController.js
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem'); // Đảm bảo tên file đúng
const Product = require('../../../models/product');     // Import Product để lấy thông tin

exports.getOrderHistory = async (req, res, next) => {
    // Lấy user ID từ middleware xác thực (req.user được gắn bởi authenticateToken)
    if (!req.user || !req.user.id) {
        return res.status(401).json({message: "Yêu cầu không được xác thực."});
    }
    const userId = req.user.id;

    try {
        const orders = await Order.findAll({
            where: {user_id: userId}, // Chỉ lấy đơn hàng của user này
            include: [ // Quan trọng: Lấy kèm các OrderItems liên quan
                {
                    model: OrderItem,
                    as: 'items', // Đặt tên association như trong model Order
                    include: [ // Lấy kèm thông tin Product cho mỗi OrderItem
                        {
                            model: Product,
                            as: 'product', // Đặt tên association như trong model OrderItem
                            attributes: ['id', 'name', 'images'] // Chỉ lấy các trường cần thiết của Product
                        }
                    ]
                }
            ],
            order: [['createdAt', 'DESC']] // Sắp xếp đơn hàng mới nhất lên đầu
        });

        // Optional: Tính toán tổng tiền cho mỗi đơn hàng trên backend
        const ordersWithTotal = orders.map(order => {
            const orderJSON = order.toJSON(); // Chuyển thành plain object để thêm thuộc tính
            orderJSON.totalAmount = orderJSON.items.reduce((sum, item) => {
                // Kiểm tra item.price và item.quantity có tồn tại và là số không
                const price = Number(item.price) || 0;
                const quantity = Number(item.quantity) || 0;
                return sum + (price * quantity);
            }, 0);
            return orderJSON;
        });


        // res.json(orders); // Trả về orders gốc nếu không tính total ở backend
        res.json(ordersWithTotal); // Trả về orders đã có totalAmount

    } catch (error) {
        console.error("Lỗi khi lấy lịch sử đơn hàng:", error);
        res.status(500).json({message: "Đã xảy ra lỗi khi truy vấn lịch sử đơn hàng."});
    }
};

// --- Controller để hủy đơn hàng (ví dụ) ---
exports.cancelOrder = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({message: "Yêu cầu không được xác thực."});
    }
    const userId = req.user.id;
    const {id: orderId} = req.params; // Lấy orderId từ URL

    try {
        const order = await Order.findOne({
            where: {
                id: orderId,
                user_id: userId // Đảm bảo user chỉ hủy được đơn hàng của chính mình
            }
        });

        if (!order) {
            return res.status(404).json({message: "Không tìm thấy đơn hàng hoặc bạn không có quyền hủy đơn này."});
        }

        // Kiểm tra trạng thái đơn hàng có cho phép hủy không (ví dụ: chỉ cho hủy khi status=1)
        if (order.status !== 1) {
            return res.status(400).json({message: "Không thể hủy đơn hàng ở trạng thái này."});
        }

        // Cập nhật trạng thái đơn hàng thành "Đã hủy" (ví dụ: status = 0)
        order.status = 0;
        await order.save(); // Lưu thay đổi

        res.json({message: `Đơn hàng #${orderId} đã được hủy thành công.`});

    } catch (error) {
        console.error(`Lỗi khi hủy đơn hàng #${orderId}:`, error);
        res.status(500).json({message: "Đã xảy ra lỗi khi hủy đơn hàng."});
    }
};