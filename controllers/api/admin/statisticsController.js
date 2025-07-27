const Product = require('../../../models/product');
const Review = require('../../../models/review');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const User = require('../../../models/user'); // Thêm dòng này


exports.getStatistics = async (req, res) => {
    try {
        const totalProducts = await Product.count();
        const totalReviews = await Review.count();
        const totalOrders = await Order.count();
        const totalUsers = await User.count(); // Thêm dòng này


        const allOrders = await Order.findAll({
            where: {
                status: 4, // Đã giao
                payment_status: 1 // Đã thanh toán
            },
            include: {
                model: OrderItem,
                as: 'items',
                attributes: ['price', 'quantity']
            }
        });


        const totalRevenue = allOrders.reduce((total, order) => {
            const orderTotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
            return total + orderTotal;
        }, 0);

        const totalPrices = allOrders.map(order => {
            return order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        });

        const orderPriceStats = {
            below100k: totalPrices.filter(total => total < 100000).length,
            from100kTo500k: totalPrices.filter(total => total >= 100000 && total < 500000).length,
            from500kTo1mil: totalPrices.filter(total => total >= 500000 && total <= 1000000).length,
            over1mil: totalPrices.filter(total => total > 1000000).length
        };

        // Thống kê loại đơn hàng
        const orderTypeStats = {
            delivered: await Order.count({where: {status: 4}}), // đã giao
            canceled: await Order.count({where: {status: 0}}), // Sửa: dùng 'canceled' 1 chữ "l"
            pending: await Order.count({where: {status: 1}}),   // chờ xác nhận
            confirmed: await Order.count({where: {status: 2}}), // đã xác nhận
            shipping: await Order.count({where: {status: 3}}),  // đang giao hàng
        };

        res.status(200).json({
            message: "Thống kê thành công",
            data: {
                products: totalProducts,
                reviews: totalReviews,
                orders: totalOrders,
                users: totalUsers, // Thêm dòng này
                revenue: totalRevenue, // Doanh thu tính theo đơn đã giao + đã thanh toán


                orderPriceStats,
                orderTypeStats // ← quan trọng: tên này phải giống FE
            }
        });
    } catch (error) {
        console.error("Lỗi thống kê:", error);
        res.status(500).json({message: "Lỗi server khi thống kê", error: error.message});
    }
};
