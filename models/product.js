const Sequelize = require('sequelize');
const database = require('./database');


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
}, {
    timestamps: true
});


module.exports = Product;