const Sequelize = require('sequelize');

const sequelize = new Sequelize('react-datnn', 'root', 'mysql', {
    dialect: 'mysql',
    host: 'localhost'
});
module.exports = sequelize;
