const Sequelize = require('sequelize');

const sequelize = new Sequelize('react-datn1', 'root', 'mysql', {
    dialect: 'mysql',
    host: 'localhost'
});
// require('./discount');
module.exports = sequelize;
//file này dùng cho lab 4.4 và bài lab5
