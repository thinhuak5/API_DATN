const { DataTypes } = require('sequelize');
const database = require('./database'); // Giả sử bạn có file cấu hình database

const ProductImage = database.define('ProductImage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    product_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'products', // Tên bảng sản phẩm
            key: 'id'
        }
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    tableName: 'product_images', // Đặt tên bảng của bạn
    timestamps: true,
});

module.exports = ProductImage;