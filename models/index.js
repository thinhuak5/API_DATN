// models/index.js
const database = require("./database");
const Sequelize = require("sequelize");

const Product = require("./product");
const ProductVariation = require("./productVariation");
const ProductImage = require("./productImage");
const Cart = require("./carts");
const Order = require("./order");
const OrderItem = require("./OrderItem");

// Product ↔ ProductVariation
Product.hasMany(ProductVariation, {
  foreignKey: "product_id",
  as: "variations",
});
ProductVariation.belongsTo(Product, {
  foreignKey: "product_id",
  as: "product",
});

// ProductVariation ↔ ProductImage
ProductVariation.hasMany(ProductImage, {
  foreignKey: "variations_id",
  as: "productImages",
});
ProductImage.belongsTo(ProductVariation, {
  foreignKey: "variations_id",
  as: "variation",
});

// Cart ↔ ProductVariation
ProductVariation.hasMany(Cart, { foreignKey: "variation_id", as: "carts" });
Cart.belongsTo(ProductVariation, {
  foreignKey: "variation_id",
  as: "variation",
});

// Order ↔ OrderItem
Order.hasMany(OrderItem, { foreignKey: "order_id", as: "orderItems" });
OrderItem.belongsTo(Order, { foreignKey: "order_id", as: "order" });


// ProductVariation ↔ OrderItem
ProductVariation.hasMany(OrderItem, {
  foreignKey: "variation_id",
  as: "orderItems",
});
OrderItem.belongsTo(ProductVariation, {
  foreignKey: "variation_id",
  as: "variation",
});

module.exports = {
  sequelize: database,
  Product,
  ProductVariation,
  ProductImage,
  Cart,
  Order,
  OrderItem,
};
