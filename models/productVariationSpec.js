const { DataTypes } = require('sequelize');
const database = require('./database');

const ProductVariationSpec = database.define('ProductVariationSpec', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  variation_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'product_variations', key: 'id' },
  },
  label: { type: DataTypes.STRING(255), allowNull: false },
  value: { type: DataTypes.STRING(255), allowNull: false },
  sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'product_variation_specs',
  timestamps: true,
});

module.exports = ProductVariationSpec;
