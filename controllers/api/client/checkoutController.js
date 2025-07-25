
const sequelize = require('../../../models/database');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const ProductVariation = require('../../../models/productVariation');
const Product = require('../../../models/product'); 

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

       
        const orderItemsData = [];
        for (const item of items) {
            let finalPrice = item.price; 
            let variationIdToSave = item.variationId || null; 

            
            if (variationIdToSave) {
                const variation = await ProductVariation.findByPk(variationIdToSave);
                if (variation) {
                    finalPrice = variation.price; 
                } else {
                    console.warn(`Biến thể ID ${variationIdToSave} không tìm thấy trong DB. Đặt variation_id về null.`);
                    variationIdToSave = null; 
                }
            } else { 
                const product = await Product.findByPk(item.productId);
                if (product) {
                    finalPrice = product.price; 
                } else {
                    console.warn(`Sản phẩm ID ${item.productId} không tìm thấy trong DB.`);
                }
            }

            orderItemsData.push({
                order_id: orderId,
                product_id: item.productId,
                variation_id: variationIdToSave, 
                quantity: item.quantity,
                price: finalPrice, 
            });
        }

        await OrderItem.bulkCreate(orderItemsData, {transaction: t});

        await t.commit();

        console.log("Order created successfully:", newOrder.toJSON());
        res.status(201).json({message: "Đặt hàng thành công!", order: newOrder});

    } catch (error) {
        await t.rollback();
        console.error("Lỗi khi tạo đơn hàng:", error);
        res.status(500).json({message: "Đã xảy ra lỗi trong quá trình xử lý đơn hàng.", error: error.message});
    }
};