const Sequelize = require('sequelize');
const database = require('./database');

const Cart = database.define('carts', {
        id: {
            type: Sequelize.INTEGER,
            autoIncrement: true,
            allowNull: false,
            primaryKey: true
        },
        user_id: Sequelize.INTEGER,
        product_id: Sequelize.INTEGER,
        quantity: Sequelize.INTEGER,
        status: Sequelize.TINYINT,
    },
    {
        timestamps: true
    });

module.exports = Cart;


