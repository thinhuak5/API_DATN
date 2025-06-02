// models/orderItem.js
const Sequelize = require('sequelize');
const database = require('./database');
// --- Bỏ require Order và Product ở đây ---

const OrderItem = database.define('order_items',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        // Không cần 'references' ở đây, vì chúng ta sẽ định nghĩa association riêng
        order_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        // Không cần 'references' ở đây
        product_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        quantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        price: {
            type: Sequelize.INTEGER,
            allowNull: false,
        }
    },
    {
        timestamps: true,
        tableName: 'order_items'
    }
);

// --- Export model NGAY SAU KHI định nghĩa ---
module.exports = OrderItem;

// --- Định nghĩa association SAU KHI đã export ---
// Bây giờ mới require Order và Product
const Order = require('./order');
const Product = require('./product');

// Một OrderItem thuộc về một Order
OrderItem.belongsTo(Order, {foreignKey: 'order_id', as: 'order'});
// Một OrderItem thuộc về một Product
OrderItem.belongsTo(Product, {foreignKey: 'product_id', as: 'product'});