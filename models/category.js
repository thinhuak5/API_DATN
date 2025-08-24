const Sequelize = require('sequelize');
const database = require('./database');

const Category = database.define('categories',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: Sequelize.STRING,
        status: Sequelize.TINYINT,
        images: Sequelize.STRING,
        parent_id: Sequelize.INTEGER,
        show_home: { type: Sequelize.TINYINT, defaultValue: 0 },   // <<< NEW
  // home_order: { type: Sequelize.INTEGER, allowNull: true }, // (nếu dùng)



    },
    {
        timestamps: false,
    }
);
Category.associate = (models) => {
    if (models.Product) {
        Category.hasMany(models.Product, {foreignKey: 'category_id'});
    }
};
module.exports = Category;