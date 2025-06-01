const Sequelize = require('sequelize');

const sequelize = new Sequelize('job-datn', 'root', 'mysql', {
    dialect: 'mysql',
    host: 'localhost'
});
module.exports = sequelize;
