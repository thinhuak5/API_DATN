const { DataTypes } = require('sequelize');
const database = require('./database'); // file config Sequelize của bạn

const Product = database.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.TINYINT,
    allowNull: true,
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    // nếu bạn có bảng categories, có thể thêm:
    // references: { model: 'categories', key: 'id' }
  },
}, {
  tableName: 'products',
  timestamps: true,       // Sequelize sẽ tự quản createdAt / updatedAt
});

module.exports = Product;
