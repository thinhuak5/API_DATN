const Sequelize = require('sequelize');

const sequelize = new Sequelize('react-datn2', 'root', 'mysql', {
    dialect: 'mysql',
    host: 'localhost'
});
module.exports = sequelize;
