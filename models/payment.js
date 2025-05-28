const Sequelize = require('sequelize');
const database = require('./database');

const Payment = database.define('payments', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: Sequelize.STRING, // 'VNPay', 'COD', ...
    status: Sequelize.TINYINT, // 0 - chưa, 1 - thành công, 2 - thất bại
    transaction_code: Sequelize.STRING, // mã giao dịch từ VNPay
    paid_at: Sequelize.DATE,
}, {
    timestamps: true,
});

module.exports = Payment;
