const Sequelize = require('sequelize');
const database = require('./database');
const Cart = require("../models/carts");

const Product = database.define('products', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true
        },
        name: Sequelize.STRING,
        images: Sequelize.STRING,
        description: Sequelize.TEXT,
        short_description: Sequelize.TEXT,
        price: Sequelize.INTEGER,
        discount_price: Sequelize.INTEGER,
        view: Sequelize.INTEGER,
        status: Sequelize.TINYINT,
        category_id: Sequelize.INTEGER,
        quantity: Sequelize.STRING,
        minStock: Sequelize.STRING,
        categoryparent_id: Sequelize.INTEGER

    },
    {
        timestamps: true
    });

Product.hasMany(Cart, {foreignKey: 'product_id'});
Cart.belongsTo(Product, {foreignKey: 'product_id'});

module.exports = Product;

const OrderItem = require('./OrderItem'); // Đổi thành './orderItem' nếu tên file là orderItem.js

// Một Product có thể xuất hiện trong nhiều OrderItems
Product.hasMany(OrderItem, {foreignKey: 'product_id', as: 'orderItems'});

const Review = require('./review'); // Đảm bảo đường dẫn đúng

Product.hasMany(Review, { foreignKey: 'product_id', as: 'reviews' });
