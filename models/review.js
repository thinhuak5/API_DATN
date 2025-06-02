// models/review.js
const Sequelize = require('sequelize');
const database = require('./database');

const Review = database.define('reviews',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        rating: { // Điểm đánh giá (ví dụ: 1 đến 5 sao)
            type: Sequelize.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 5,
            }
        },
        comment: { // Nội dung bình luận
            type: Sequelize.TEXT,
            allowNull: true, // Có thể chỉ đánh giá sao mà không bình luận
        },
        review_date: {
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
        },
        user_id: { // Người đánh giá
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        product_id: { // Sản phẩm được đánh giá
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        order_item_id: { // Liên kết với mục trong đơn hàng để xác thực đã mua
            type: Sequelize.INTEGER,
            allowNull: false,
            unique: true, // Mỗi order_item chỉ được đánh giá 1 lần bởi người mua đó
        },
        status: { // Trạng thái đánh giá: 0: chờ duyệt, 1: đã duyệt, 2: từ chối
            type: Sequelize.TINYINT,
            defaultValue: 1, // Mặc định là đã duyệt, hoặc 0 nếu bạn muốn có quy trình duyệt
        }
    },
    {
        timestamps: true, // Sẽ tự động thêm createdAt và updatedAt
        tableName: 'reviews'
    }
);

module.exports = Review;

// Định nghĩa association SAU KHI đã export
const User = require('./user');
const Product = require('./product');
const OrderItem = require('./OrderItem'); // Giữ nguyên tên file của bạn

Review.belongsTo(User, {foreignKey: 'user_id', as: 'user'});
Review.belongsTo(Product, {foreignKey: 'product_id', as: 'product'});
Review.belongsTo(OrderItem, {foreignKey: 'order_item_id', as: 'orderItemDetail'}); // 'orderItemDetail' để tránh trùng với 'items' của Order