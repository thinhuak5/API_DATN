const Product = require('../../../models/product');
const Review = require('../../../models/review');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const User = require('../../../models/user');
const { Op } = require("sequelize");

// Thống kê doanh thu động: ngày, tuần, tháng, năm
exports.getRevenueStatistics = async (req, res) => {
    try {
        const { type } = req.query;
        let labels = [], data = [], orders = [], refunds = [], total = 0;
        const now = new Date();

        if (type === 'day') {
            // Theo giờ hôm nay
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);

            labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
            let hourlyRevenue = Array(24).fill(0),
                hourlyOrders = Array(24).fill(0),
                hourlyRefunds = Array(24).fill(0);

            const allOrders = await Order.findAll({
                where: { createdAt: { [Op.between]: [start, end] } },
                include: [{ model: OrderItem, as: "items", attributes: ["price", "quantity"] }]
            });

            allOrders.forEach(order => {
                const hour = new Date(order.createdAt).getHours();
                if (order.status === 4 && order.payment_status === 1) {
                    hourlyOrders[hour] += 1;
                    hourlyRevenue[hour] += order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                }
                if (order.status === 0) {
                    hourlyRefunds[hour] += 1;
                }
            });

            data = hourlyRevenue;
            orders = hourlyOrders;
            refunds = hourlyRefunds;
            total = data.reduce((a, b) => a + b, 0);

        } else if (type === 'week' || !type) {
            // 7 ngày gần nhất
            const endDate = new Date(now.setHours(23, 59, 59, 999));
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);

            let dailyRevenue = {}, dailyOrders = {}, dailyRefunds = {};
            for (let i = 6; i >= 0; i--) {
                let day = new Date(endDate);
                day.setDate(endDate.getDate() - i);
                const key = day.toISOString().slice(0, 10);
                dailyRevenue[key] = 0;
                dailyOrders[key] = 0;
                dailyRefunds[key] = 0;
            }

            const allOrders = await Order.findAll({
                where: { createdAt: { [Op.between]: [startDate, endDate] } },
                include: [{ model: OrderItem, as: "items", attributes: ["price", "quantity"] }]
            });

            allOrders.forEach(order => {
                const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
                if (order.status === 4 && order.payment_status === 1 && dailyOrders[dateKey] !== undefined) {
                    dailyOrders[dateKey] += 1;
                    const revenue = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                    dailyRevenue[dateKey] += revenue;
                }
                if (order.status === 0 && dailyRefunds[dateKey] !== undefined) {
                    dailyRefunds[dateKey] += 1;
                }
            });

            data = Object.values(dailyRevenue);
            labels = Object.keys(dailyRevenue);
            orders = Object.values(dailyOrders);
            refunds = Object.values(dailyRefunds);
            total = data.reduce((a, b) => a + b, 0);

        } else if (type === 'month') {
            // Từng ngày trong tháng hiện tại
            let start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            let daysInMonth = end.getDate();
            labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}/${now.getMonth() + 1}`);
            let dailyRevenue = Array(daysInMonth).fill(0),
                dailyOrders = Array(daysInMonth).fill(0),
                dailyRefunds = Array(daysInMonth).fill(0);

            const allOrders = await Order.findAll({
                where: { createdAt: { [Op.between]: [start, end] } },
                include: [{ model: OrderItem, as: "items", attributes: ["price", "quantity"] }]
            });

            allOrders.forEach(order => {
                const day = new Date(order.createdAt).getDate() - 1;
                if (order.status === 4 && order.payment_status === 1) {
                    dailyOrders[day] += 1;
                    dailyRevenue[day] += order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                }
                if (order.status === 0) {
                    dailyRefunds[day] += 1;
                }
            });

            data = dailyRevenue;
            orders = dailyOrders;
            refunds = dailyRefunds;
            total = data.reduce((a, b) => a + b, 0);

        } else if (type === 'year') {
            // Từng tháng trong năm
            labels = Array.from({ length: 12 }, (_, i) => `Th${i + 1}`);
            let monthlyRevenue = Array(12).fill(0),
                monthlyOrders = Array(12).fill(0),
                monthlyRefunds = Array(12).fill(0);

            const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

            const allOrders = await Order.findAll({
                where: { createdAt: { [Op.between]: [start, end] } },
                include: [{ model: OrderItem, as: "items", attributes: ["price", "quantity"] }]
            });

            allOrders.forEach(order => {
                const month = new Date(order.createdAt).getMonth();
                if (order.status === 4 && order.payment_status === 1) {
                    monthlyOrders[month] += 1;
                    monthlyRevenue[month] += order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
                }
                if (order.status === 0) {
                    monthlyRefunds[month] += 1;
                }
            });

            data = monthlyRevenue;
            orders = monthlyOrders;
            refunds = monthlyRefunds;
            total = data.reduce((a, b) => a + b, 0);
        }

        res.json({ labels, data, orders, refunds, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Thống kê tổng quan dashboard
exports.getStatistics = async (req, res) => {
    try {
        const totalProducts = await Product.count();
        const totalReviews = await Review.count();
        const totalOrders = await Order.count();
        const totalUsers = await User.count();

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

        const orderTypeStats = {
            delivered: await Order.count({ where: { status: 4 } }),
            canceled: await Order.count({ where: { status: 0 } }),
            pending: await Order.count({ where: { status: 1 } }),
            confirmed: await Order.count({ where: { status: 2 } }),
            shipping: await Order.count({ where: { status: 3 } }),
        };

        res.status(200).json({
            message: "Thống kê thành công",
            data: {
                products: totalProducts,
                reviews: totalReviews,
                orders: totalOrders,
                users: totalUsers,
                revenue: totalRevenue,
                orderPriceStats,
                orderTypeStats
            }
        });
    } catch (error) {
        console.error("Lỗi thống kê:", error);
        res.status(500).json({ message: "Lỗi server khi thống kê", error: error.message });
    }
};
