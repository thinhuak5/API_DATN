const Product = require('../../../models/product');
const Review = require('../../../models/review');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const User = require('../../../models/user');
const { Op } = require("sequelize");

exports.getWeeklyRevenue = async (req, res) => {
  try {
    const now = new Date();
    const endDate = new Date(now.setHours(23, 59, 59, 999));
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    // Lấy tất cả đơn hàng 7 ngày gần nhất (để tách orders/refunds/doanh thu)
    const allOrders = await Order.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate]
        },
      },
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: ["price", "quantity"]
        }
      ]
    });

    // Khởi tạo mảng 7 ngày gần nhất
    let dailyRevenue = {}, dailyOrders = {}, dailyRefunds = {};
    for (let i = 6; i >= 0; i--) {
      let day = new Date(endDate);
      day.setDate(endDate.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      dailyRevenue[key] = 0;
      dailyOrders[key] = 0;
      dailyRefunds[key] = 0;
    }

    // Duyệt qua các order, phân loại cho từng ngày
    allOrders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);

      // Đơn giao thành công
      if (order.status === 4 && order.payment_status === 1 && dailyOrders[dateKey] !== undefined) {
        dailyOrders[dateKey] += 1;
        const revenue = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        dailyRevenue[dateKey] += revenue;
      }
      // Đơn hủy
      if (order.status === 0 && dailyRefunds[dateKey] !== undefined) {
        dailyRefunds[dateKey] += 1;
      }
    });

    // Tổng doanh thu 7 ngày
    const totalWeeklyRevenue = Object.values(dailyRevenue).reduce((a, b) => a + b, 0);

    res.json({
      labels: Object.keys(dailyRevenue),
      data: Object.values(dailyRevenue),
      total: totalWeeklyRevenue,
      orders: Object.values(dailyOrders),
      refunds: Object.values(dailyRefunds)
    });
  } catch (err) {
    console.error("Lỗi lấy doanh thu tuần:", err);
    res.status(500).json({ error: "Lỗi server khi lấy doanh thu tuần" });
  }
};

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
