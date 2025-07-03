const Sequelize = require('sequelize');

const database = require('./database');

const ContactMessage = database.define('contactMessage', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: Sequelize.STRING,
    email: Sequelize.STRING,
    message: Sequelize.TEXT,
    replied: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
    },
    replyContent: Sequelize.TEXT,
 
}, {
    timestamps: false, // Tạo createdAt và updatedAt
    tableName: 'contactMessage',
})

ContactMessage.associate = (models) => {
    // Nếu cần liên kết với bảng khác sau này, bạn thêm tại đây
    // Ví dụ: ContactMessage.belongsTo(models.User, { foreignKey: 'user_id' });
};

module.exports = ContactMessage;
