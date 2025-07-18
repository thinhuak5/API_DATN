const Sequelize = require('sequelize');
const database = require('./database');

const Discount = database.define('discounts', {
  id: {
    type: Sequelize.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  code: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true,
  },
  description: {
    type: Sequelize.STRING,
    allowNull: true,
  },
  discount_type: {
    type: Sequelize.ENUM('percent', 'fixed'),
    allowNull: false,
    defaultValue: 'percent',
  },
  discount_value: {
    type: Sequelize.FLOAT,
    allowNull: false,
  },
  min_order_value: {
    type: Sequelize.FLOAT,
    allowNull: true,
  },
  max_discount_value: {
    type: Sequelize.FLOAT,
    allowNull: true,
  },
  quantity: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  used: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  start_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  end_date: {
    type: Sequelize.DATE,
    allowNull: true,
  },
  status: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  timestamps: true,
});

module.exports = Discount; 