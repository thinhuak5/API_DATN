const Sequelize = require('sequelize');
const database = require('./database');
const Payment = require('../models/payment');
const OrderItem = require('./OrderItem');

const Order = database.define('orders',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: Sequelize.STRING,
        phone: Sequelize.STRING,
        payment_id: Sequelize.INTEGER,
        payment_status: Sequelize.TINYINT,
        status: Sequelize.TINYINT,
        user_id: Sequelize.INTEGER,
        address: Sequelize.STRING,
        cancellation_reason: Sequelize.STRING, // Lý do hủy đơn hàng
        txn_ref: Sequelize.STRING,
    },
    {
        timestamps: true,
    }
);

module.exports = Order;

Order.hasMany(OrderItem, {foreignKey: 'order_id', as: 'items'});
Order.belongsTo(Payment, {foreignKey: 'payment_id', as: 'payment'});
Payment.hasOne(Order, {foreignKey: 'payment_id', as: 'order'});