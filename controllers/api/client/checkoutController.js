// controllers/api/client/checkoutController.js

// --- ĐÂY LÀ DÒNG ĐÃ SỬA ---
const sequelize = require('../../../models/database'); // Đảm bảo đường dẫn đúng

// --- CÁC IMPORT KHÁC ---
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem'); // Đảm bảo tên file đúng (OrderItem.js hoặc orderItem.js)
// const Product = require('../../models/product'); // Có thể cần sau

exports.createOrder = async (req, res, next) => {
    // ---- Lấy userId từ req.user do middleware xác thực gắn vào (AN TOÀN HƠN) ----
    if (!req.user || !req.user.id) {
        console.error("Lỗi nghiêm trọng: req.user không tồn tại trong createOrder. Middleware xác thực có vấn đề?");
        return res.status(401).json({message: "Yêu cầu không được xác thực."});
    }
    const authenticatedUserId = req.user.id;
    console.log(`Authenticated User ID: ${authenticatedUserId}`);

    // ---- Lấy dữ liệu từ body ----
    const {
        items,
        name,
        phone,
        address,
        payments,
        payment_status
    } = req.body;

    // ---- Log dữ liệu nhận được để debug ----
    console.log("Received checkout data in backend:", req.body);
    console.log("Items received:", items);

    // --- VALIDATION ---
    if (!items || items.length === 0 || !name /* || !phone || phone === 'N/A' || !address || address === 'Default Address' */) {
        console.warn("Validation failed. Data:", {items_length: items?.length, name, phone, address});
        return res.status(400).json({message: "Dữ liệu đơn hàng không hợp lệ hoặc thiếu thông tin bắt buộc (tên, sản phẩm)."});
    }

    // --- Dòng này bây giờ sẽ hoạt động ---
    const t = await sequelize.transaction();

    try {
        // 1. Tạo đơn hàng mới
        const newOrder = await Order.create({
            user_id: authenticatedUserId,
            name: name,
            phone: phone,
            address: address,
            payments: payments || 1,
            payment_status: payment_status === 0 ? 0 : 1,
            status: 1,
        }, {transaction: t});

        const orderId = newOrder.id;

        // 2. Tạo các chi tiết đơn hàng
        const orderItemsData = items.map(item => ({
            order_id: orderId,
            product_id: item.productId,
            quantity: item.quantity,
            price: item.price
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