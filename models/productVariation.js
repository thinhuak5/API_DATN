const { DataTypes } = require('sequelize');
const database = require('./database'); // Giả sử bạn có file cấu hình database

const ProductVariation = database.define('ProductVariation', {
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
    name: { // Tên biến thể (e.g., "Màu sắc", "Kích thước")
        type: DataTypes.STRING,
        allowNull: false,
    },
    value: { // Giá trị biến thể (e.g., "Đỏ", "XL")
        type: DataTypes.STRING,
        allowNull: false,
    },
    price: { // Giá riêng cho biến thể này (có thể null nếu dùng giá gốc)
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    quantity: { // Số lượng tồn kho cho biến thể này
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    minStock: { // Tồn kho cảnh báo cho biến thể này
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    type: { // Loại biến thể: 'regular' hoặc 'special'
        type: DataTypes.ENUM('regular', 'special'),
        defaultValue: 'regular',
        allowNull: false,
    },
}, {
    tableName: 'product_variations', // Đặt tên bảng của bạn
    timestamps: true,
});

module.exports = ProductVariation;