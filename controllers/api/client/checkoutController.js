
const sequelize = require('../../../models/database');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const ProductVariation = require('../../../models/productVariation'); // Đảm bảo import ProductVariation
const Product = require('../../../models/product'); // Đảm bảo import Product (nếu bạn cần truy vấn nó)

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
        payment_id,
        payment_status,
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
            payment_id: payment_id || null,
            payment_status: payment_status === 1 ? 1 : 0,
            status: 1,
        }, {transaction: t});

        const orderId = newOrder.id;

        // 2. Chuẩn bị dữ liệu chi tiết đơn hàng
        // Cần lấy lại thông tin product_id và variation_id từ database nếu cần xác thực thêm
        // Nhưng nếu bạn tin tưởng dữ liệu từ frontend, có thể dùng trực tiếp item.productId và item.variationId
        const orderItemsData = [];
        for (const item of items) {
            let finalPrice = item.price; // Giá từ frontend (đã được ưu tiên biến thể)
            let variationIdToSave = item.variationId || null; // variationId từ frontend

            // (Tùy chọn) Xác thực và lấy giá từ database một lần nữa để đảm bảo tính toàn vẹn dữ liệu
            // Nếu bạn muốn chắc chắn giá và variation_id là chính xác từ DB tại thời điểm đặt hàng:
            if (variationIdToSave) {
                const variation = await ProductVariation.findByPk(variationIdToSave);
                if (variation) {
                    finalPrice = variation.price; // Lấy giá từ biến thể trong DB
                    // variationIdToSave = variation.id; // Đảm bảo ID đúng
                } else {
                    console.warn(`Biến thể ID ${variationIdToSave} không tìm thấy trong DB. Đặt variation_id về null.`);
                    variationIdToSave = null; // Đặt về null nếu biến thể không tồn tại
                }
            } else { // Sản phẩm không có biến thể, xác thực giá sản phẩm gốc
                const product = await Product.findByPk(item.productId);
                if (product) {
                    finalPrice = product.price; // Lấy giá từ sản phẩm gốc trong DB
                } else {
                    console.warn(`Sản phẩm ID ${item.productId} không tìm thấy trong DB.`);
                    // Có thể xử lý lỗi hoặc bỏ qua mục này
                }
            }
            // ----------------------------------------------------------------------------------

            orderItemsData.push({
                order_id: orderId,
                product_id: item.productId,
                variation_id: variationIdToSave, // <<< ĐÃ THÊM variation_id VÀO ĐÂY!
                quantity: item.quantity,
                price: finalPrice, // Sử dụng giá đã được xác thực (hoặc giá từ frontend nếu bạn tin tưởng)
            });
        }

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