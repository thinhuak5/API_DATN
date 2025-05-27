const Sequelize = require('sequelize');
const database = require('./database');

const CategoryParent = database.define('categoryparents',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: Sequelize.STRING,
        status: Sequelize.TINYINT,
        image: Sequelize.STRING
    },
    {
        timestamps: true, // Vì trong bảng có createdAt và updatedAt
    }
);

// Khai báo các mối quan hệ
CategoryParent.associate = (models) => {
    if (models.Category) {
        CategoryParent.hasMany(models.Category, { foreignKey: 'parent_id' });
    }
    if (models.Product) {
        CategoryParent.hasMany(models.Product, { foreignKey: 'categoryparent_id' });
    }
};

module.exports = CategoryParent;
