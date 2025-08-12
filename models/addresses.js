// models/addresses.js
const Sequelize = require("sequelize");
const database = require("./database");
const User = require("./user"); // dùng lại model users bạn đã có

const Address = database.define(
  "user_addresses",
  {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      allowNull: false,
      primaryKey: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    house_number: { type: Sequelize.STRING(255), allowNull: false },
    ward_code: { type: Sequelize.STRING(20), allowNull: false },
    ward_name: { type: Sequelize.STRING(100), allowNull: false },
    province_code: { type: Sequelize.STRING(20), allowNull: false },
    province_name: { type: Sequelize.STRING(100), allowNull: false },
    full_address: { type: Sequelize.STRING(500), allowNull: false },
    is_default: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "user_addresses",
    timestamps: false, // đồng bộ style với users
  }
);

// Quan hệ
User.hasMany(Address, { foreignKey: "user_id", as: "addresses" });
Address.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = Address;
