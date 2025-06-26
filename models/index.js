const Product = require('./product');
const OrderItem = require('./OrderItem');
const Order = require('./order');
const Cart = require('./carts');
const ProductImage = require('./productImage');
const ProductVariation = require('./productVariation');

// Product ↔ Cart
Product.hasMany(Cart, { foreignKey: 'product_id' });
Cart.belongsTo(Product, { foreignKey: 'product_id' });

// Product ↔ OrderItem
Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'orderItems' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id' });

// Product ↔ ProductImage
Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'productImages' });
ProductImage.belongsTo(Product, { foreignKey: 'product_id' });

// Product ↔ ProductVariation
Product.hasMany(ProductVariation, { foreignKey: 'product_id', as: 'variations' });
ProductVariation.belongsTo(Product, { foreignKey: 'product_id' });

// Order ↔ OrderItem
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'orderItems' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// ProductVariation ↔ Cart
ProductVariation.hasMany(Cart, { foreignKey: 'variation_id', as: 'carts' });
Cart.belongsTo(ProductVariation, { foreignKey: 'variation_id', as: 'variation' });

// THÊM DÒNG NÀY ĐỂ ĐỊNH NGHĨA MỐI QUAN HỆ GIỮA ProductVariation VÀ OrderItem
ProductVariation.hasMany(OrderItem, {
    foreignKey: 'variation_id',
    as: 'orderItems', // Đảm bảo alias này khớp với alias bạn dùng trong include
    onDelete: 'RESTRICT', // Giữ nguyên RESTRICT nếu bạn muốn Sequelize thông báo lỗi khi có ràng buộc
    onUpdate: 'CASCADE'
});
OrderItem.belongsTo(ProductVariation, {
    foreignKey: 'variation_id',
    as: 'variation' // Alias tùy chọn cho OrderItem khi truy cập ngược lại
});

module.exports = { Product, OrderItem, Cart, ProductImage, ProductVariation, Order };