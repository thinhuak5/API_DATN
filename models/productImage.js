const { DataTypes } = require('sequelize');
const database = require('./database');

const ProductImage = database.define('ProductImage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  image_url: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  variations_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'product_variations',
      key: 'id'
    }
  },
}, {
  tableName: 'product_images',
  timestamps: false  
});

module.exports = ProductImage;
