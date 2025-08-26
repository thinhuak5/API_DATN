const Sequelize = require('sequelize');

const sequelize = new Sequelize('react-datn', 'root', 'mysql', {
    dialect: 'mysql',
    host: 'localhost'
});
module.exports = sequelize;
