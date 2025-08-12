const Sequelize = require('sequelize');
const database = require('./database');


const TempOrder = database.define('temp_orders', {
    txn_ref: {type: Sequelize.STRING, allowNull: false, unique: true},
    user_id: Sequelize.INTEGER,
    name: Sequelize.STRING,
    phone: Sequelize.STRING,
    address: Sequelize.STRING,
    payment_id: Sequelize.INTEGER,
    items: Sequelize.TEXT,
    amount: Sequelize.INTEGER,
    discount_id: Sequelize.INTEGER,
    discount_amount: Sequelize.INTEGER
}, {
    timestamps: true
});
module.exports = TempOrder;




