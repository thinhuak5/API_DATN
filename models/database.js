const Sequelize = require('sequelize');

const sequelize = new Sequelize('testdatn2', 'root', 'mysql', {
    dialect: 'mysql',
    host: 'localhost'
});
module.exports = sequelize;
