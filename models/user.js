const Sequelize = require('sequelize');
const Cart = require("../models/carts");
const database = require('./database');
const bcrypt = require('bcryptjs');

const User = database.define('users', {
    id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
    },
    username: Sequelize.STRING,
    password: Sequelize.STRING,
    email: Sequelize.STRING,
    name: Sequelize.STRING,
    phone: Sequelize.STRING,
    avatar: Sequelize.STRING,
    status: Sequelize.TINYINT,
    role: Sequelize.TINYINT,
    address: Sequelize.STRING,
    resetToken: {
        type: Sequelize.STRING,
        allowNull: true
    },
    resetTokenExpiry: {
        type: Sequelize.DATE,
        allowNull: true
    }
}, {
    timestamps: false, // Không có createdAt và updatedAt
});

User.hasMany(Cart, {foreignKey: 'user_id'});
Cart.belongsTo(User, {foreignKey: 'user_id'});

User.beforeCreate(async (user) => {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
});
module.exports = User;
