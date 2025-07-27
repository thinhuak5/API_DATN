// models/review.js

const Sequelize = require('sequelize');
const database = require('./database');

// Định nghĩa model Review
const Review = database.define('reviews', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  rating: {
    type: Sequelize.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 }
  },
  comment: {
    type: Sequelize.TEXT,
    allowNull: true,
  },
  review_date: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW,
  },
  user_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  variation_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
  },
  order_item_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    unique: true,
  },
  status: {
    type: Sequelize.TINYINT,
    defaultValue: 1,
  }
}, {
  timestamps: true,
  tableName: 'reviews'
});

// Sau khi định nghĩa model, mới require các model liên quan
const User             = require('./user');
const ProductVariation = require('./productVariation');
const OrderItem        = require('./OrderItem');
const ReviewImage      = require('./ReviewImage');

// Khai báo các association
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Review.belongsTo(ProductVariation, { foreignKey: 'variation_id', as: 'variation' });
Review.belongsTo(OrderItem, { foreignKey: 'order_item_id', as: 'orderItemDetail' });
Review.hasMany(ReviewImage, { foreignKey: 'review_id', as: 'images', onDelete: 'CASCADE' });

// Nếu cần, có thể khai ngược lại trong ReviewImage
ReviewImage.belongsTo(Review, { foreignKey: 'review_id', as: 'review' });

// (Không cần) ReviewImage không nên liên kết trực tiếp tới ProductVariation
// vì chúng ta đã có relation Review → Variation
// Nếu bạn muốn link image với variation để lưu ảnh từng biến thể,
// hãy thiết kế thêm trường variation_id trong ReviewImage và khai association ở model đó.

module.exports = Review;
