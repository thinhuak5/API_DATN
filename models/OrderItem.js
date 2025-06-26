const Sequelize = require('sequelize');
const database = require('./database');

const OrderItem = database.define('order_items',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        order_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        product_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        variation_id: { // <-- ĐẢM BẢO TRƯỜNG NÀY TỒN TẠI VÀ CÓ CẤU HÌNH ĐÚNG
            type: Sequelize.INTEGER,
            allowNull: true, // Cho phép NULL nếu là sản phẩm mặc định
            references: {
                model: 'product_variations', // PHẢI trùng với tên bảng thực tế của ProductVariation
                key: 'id'
            }
        },
        quantity: {
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        price: { // Giá này nên là giá của biến thể tại thời điểm đặt hàng
            type: Sequelize.INTEGER,
            allowNull: false,
        }
    },
    {
        timestamps: true,
        tableName: 'order_items'
    }
);

module.exports = OrderItem;

const Review = require('./review');
const ProductVariation = require('./productVariation'); // Đảm bảo import ProductVariation

OrderItem.hasOne(Review, {foreignKey: 'order_item_id', as: 'review'});

// --- ĐẢM BẢO ASSOCIATION NÀY ĐƯỢC ĐỊNH NGHĨA CHÍNH XÁC ---
OrderItem.belongsTo(ProductVariation, { foreignKey: 'variation_id', as: 'selectedVariation' });
// -----------------------------------------------------------
