const Sequelize = require('sequelize');
const database = require('./database');

const ReviewImage = database.define('review_images',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        review_id: { // Foreign key liên kết đến bảng reviews
            type: Sequelize.INTEGER,
            allowNull: false,
        },
        image_url: { // Đường dẫn tới hình ảnh
            type: Sequelize.STRING,
            allowNull: false,
        }
    },
    {
        timestamps: false, // Không cần timestamps cho bảng này
        tableName: 'review_images'
    }
);

module.exports = ReviewImage;