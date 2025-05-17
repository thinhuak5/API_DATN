const Sequelize = require('sequelize');
const database = require('./database');


const Order = database.define('orders',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: Sequelize.STRING,
        phone: Sequelize.STRING,
        payments: Sequelize.INTEGER,
        payment_status: Sequelize.TINYINT,
        status: Sequelize.TINYINT,
        user_id: Sequelize.INTEGER,
        address: Sequelize.STRING,
    },
    {
        timestamps: true,
    }
);

module.exports = Order;


const OrderItem = require('./OrderItem'); // Đổi thành './orderItem' nếu tên file là orderItem.js

// Một Order có nhiều OrderItems
// Đặt tên association key rõ ràng: foreignKey là cột trong bảng OrderItem tham chiếu đến Order
Order.hasMany(OrderItem, {foreignKey: 'order_id', as: 'items'});