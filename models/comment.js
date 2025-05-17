const Sequelize = require('sequelize');
const database = require('./database');

const Comment = database.define('comments',
    {
        id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        content: Sequelize.TEXT,
        date: Sequelize.DATE,
        status: Sequelize.TINYINT,
        product_id: Sequelize.INTEGER,
        user_id: Sequelize.INTEGER,

    },
    {
        timestamps: false,
    }
);

module.exports = Comment;
