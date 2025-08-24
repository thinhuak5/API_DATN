// models/addresses.js
const { DataTypes } = require("sequelize");
const database = require("./database");
const User = require("./user");

const Address = database.define(
  "user_addresses",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    house_number:  { type: DataTypes.STRING(255), allowNull: false },
    ward_code:     { type: DataTypes.STRING(20),  allowNull: false },
    ward_name:     { type: DataTypes.STRING(100), allowNull: false },
    province_code: { type: DataTypes.STRING(20),  allowNull: false },
    province_name: { type: DataTypes.STRING(100), allowNull: false },
    full_address:  { type: DataTypes.STRING(500), allowNull: false },
    is_default:    { type: DataTypes.TINYINT,     allowNull: false, defaultValue: 0 },

    // --- THÊM MỚI ---
    recipient_name:  { type: DataTypes.STRING(100), allowNull: true },
    recipient_phone: { type: DataTypes.STRING(20),  allowNull: true },

    // nếu muốn Sequelize quản lý timestamps thay vì DB
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "user_addresses",
    underscored: true,          // dùng snake_case
    timestamps: true,           // để Sequelize tự cập nhật updated_at
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { fields: ["user_id"] },
      { fields: ["user_id", "is_default"] },
    ],
  }
);

// Quan hệ
User.hasMany(Address, { foreignKey: "user_id", as: "addresses" });
Address.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = Address;
