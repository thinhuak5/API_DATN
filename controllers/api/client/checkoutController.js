
const sequelize = require('../../../models/database');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const ProductVariation = require('../../../models/productVariation');
const Product = require('../../../models/product');
const Discount = require('../../../models/discount');

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
        discount_id,
        discount_amount,
        total_amount
    } = req.body;

    console.log("Received checkout data:", req.body);

    if (!items || items.length === 0 || !name || !phone || !address) {
        console.warn("Validation failed. Data:", {items_length: items?.length, name, phone, address});
        return res.status(400).json({message: "Dữ liệu đơn hàng không hợp lệ hoặc thiếu thông tin bắt buộc."});
    }

    const t = await sequelize.transaction();

    try {
        // Kiểm tra và cập nhật mã giảm giá nếu có
        let discountData = null;
        if (discount_id) {
            const discount = await Discount.findByPk(discount_id, { transaction: t });
            if (discount) {
                // Kiểm tra mã giảm giá còn hiệu lực không
                const now = new Date();
                if (discount.status && 
                    discount.quantity > 0 && 
                    (!discount.start_date || discount.start_date <= now) &&
                    (!discount.end_date || discount.end_date >= now)) {
                    
                    // Cập nhật số lượng sử dụng
                    await discount.update({
                        used: discount.used + 1,
                        quantity: discount.quantity - 1
                    }, { transaction: t });
                    
                    discountData = {
                        id: discount.id,
                        code: discount.code,
                        discount_type: discount.discount_type,
                        discount_value: discount.discount_value
                    };
                } else {
                    console.warn(`Mã giảm giá ID ${discount_id} không còn hiệu lực.`);
                }
            } else {
                console.warn(`Mã giảm giá ID ${discount_id} không tồn tại.`);
            }
        }

        // Tạo đơn hàng mới với thông tin giảm giá
        const newOrder = await Order.create({
            user_id: authenticatedUserId,
            name,
            phone,
            address,
            payment_id: payment_id || null,
            payment_status: payment_status === 1 ? 1 : 0,
            status: 1,
            discount_id: discountData ? discountData.id : null,
            discount_amount: discount_amount || 0,
            total_amount: total_amount || null // Nếu không có total_amount, sẽ tính tổng từ các item
        }, {transaction: t});

        const orderId = newOrder.id;

        const orderItemsData = [];
        let calculatedTotal = 0;
        
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

            calculatedTotal += finalPrice * item.quantity;

            orderItemsData.push({
                order_id: orderId,
                product_id: item.productId,
                variation_id: variationIdToSave, 
                quantity: item.quantity,
                price: finalPrice, 
            });
        }

        await OrderItem.bulkCreate(orderItemsData, {transaction: t});

        // Nếu không có total_amount được cung cấp, cập nhật tổng tiền tính toán
        if (!total_amount) {
            // Áp dụng giảm giá nếu có
            let finalTotal = calculatedTotal;
            if (discountData) {
                if (discountData.discount_type === 'percent') {
                    finalTotal = calculatedTotal * (1 - discountData.discount_value / 100);
                } else if (discountData.discount_type === 'fixed') {
                    finalTotal = Math.max(calculatedTotal - discountData.discount_value, 0);
                }
            }
            
            await newOrder.update({
                total_amount: finalTotal
            }, { transaction: t });
        }

        await t.commit();

        console.log("Order created successfully:", newOrder.toJSON());
        res.status(201).json({
            message: "Đặt hàng thành công!", 
            order: newOrder,
            discount: discountData
        });

    } catch (error) {
        await t.rollback();
        console.error("Lỗi khi tạo đơn hàng:", error);
        res.status(500).json({message: "Đã xảy ra lỗi trong quá trình xử lý đơn hàng.", error: error.message});
    }
};