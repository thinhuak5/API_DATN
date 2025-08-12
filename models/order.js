const Sequelize = require('sequelize');
const database = require('./database');
const Payment = require('../models/payment');
const OrderItem = require('./OrderItem');
const Discount = require('./discount');

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
        discount_id: Sequelize.INTEGER, // ID của mã giảm giá được áp dụng
        discount_amount: Sequelize.FLOAT, // Số tiền giảm giá
        total_amount: Sequelize.FLOAT, // Tổng tiền sau khi áp dụng giảm giá
    },
    {
        timestamps: true,
    }
);

module.exports = Order;

Order.hasMany(OrderItem, {foreignKey: 'order_id', as: 'items'});
Order.belongsTo(Payment, {foreignKey: 'payment_id', as: 'payment'});
Payment.hasOne(Order, {foreignKey: 'payment_id', as: 'order'});
Order.belongsTo(Discount, {foreignKey: 'discount_id', as: 'discount'});
Discount.hasMany(Order, {foreignKey: 'discount_id', as: 'orders'});