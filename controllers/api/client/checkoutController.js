// controllers/api/client/checkoutController.js

const sequelize = require('../../../models/database');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');

exports.createOrder = async (req, res, next) => {
    if (!req.user || !req.user.id) {
        console.error("Lỗi: req.user không tồn tại trong createOrder.");
        return res.status(401).json({message: "Yêu cầu không được xác thực."});
    }
    const authenticatedUserId = req.user.id;
    console.log(`Authenticated User ID: ${authenticatedUserId}`);

    const {
        items,
        name,
        phone,
        address,
        payment_id,       // đổi từ payments thành payment_id
        payment_status,   // 0: chưa thanh toán, 1: đã thanh toán
    } = req.body;

    console.log("Received checkout data:", req.body);

    if (!items || items.length === 0 || !name || !phone || !address) {
        console.warn("Validation failed. Data:", {items_length: items?.length, name, phone, address});
        return res.status(400).json({message: "Dữ liệu đơn hàng không hợp lệ hoặc thiếu thông tin bắt buộc."});
    }

    const t = await sequelize.transaction();

    try {
        // 1. Tạo đơn hàng mới
        const newOrder = await Order.create({
            user_id: authenticatedUserId,
            name,
            phone,
            address,
            payment_id: payment_id || null,   // liên kết payment
            payment_status: payment_status === 1 ? 1 : 0, // mặc định 0 nếu không có hoặc khác 1
            status: 1, // trạng thái đơn hàng (có thể tùy chỉnh)
        }, {transaction: t});

        const orderId = newOrder.id;

        // 2. Tạo chi tiết đơn hàng
        const orderItemsData = items.map(item => ({
            order_id: orderId,
            product_id: item.productId,
            quantity: item.quantity,
            price: item.price,
        }));

        await OrderItem.bulkCreate(orderItemsData, {transaction: t});

        // 3. Commit transaction
        await t.commit();

        console.log("Order created successfully:", newOrder.toJSON());
        res.status(201).json({message: "Đặt hàng thành công!", order: newOrder});

    } catch (error) {
        await t.rollback();
        console.error("Lỗi khi tạo đơn hàng:", error);
        res.status(500).json({message: "Đã xảy ra lỗi trong quá trình xử lý đơn hàng.", error: error.message});
    }
};
