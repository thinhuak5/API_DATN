// controllers/api/admin/reviewAdminController.js

const Review = require('../../../models/review');
const ReviewImage = require('../../../models/ReviewImage');
const User = require('../../../models/user');
const ProductVariation = require('../../../models/productVariation');
const { Op } = require('sequelize');

exports.getAllReviews = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    // Build điều kiện where
    const whereCondition = {};
    if (status !== undefined && ['0','1','2'].includes(String(status))) {
      whereCondition.status = parseInt(status, 10);
    }
    if (search) {
      whereCondition[Op.or] = [
        { comment: { [Op.like]: `%${search}%` } },
        { '$user.name$': { [Op.like]: `%${search}%` } },
        { '$variation.value$': { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Review.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id','name','avatar'],
          required: true
        },
        {
          model: ProductVariation,
          as: 'variation',
          attributes: ['id','name','value','price'],
          required: true
        },
        {
          model: ReviewImage,
          as: 'images',
          attributes: ['id','image_url']
        }
      ],
      order: [['createdAt','DESC']],
      limit:  parseInt(limit,10),
      offset,
      distinct: true
    });

    res.status(200).json({
      message: 'Lấy danh sách đánh giá thành công.',
      totalItems: count,
      totalPages: Math.ceil(count/limit),
      currentPage: parseInt(page,10),
      reviews: rows
    });

  } catch (error) {
    console.error("Lỗi khi admin lấy danh sách đánh giá:", error);
    res.status(500).json({
      message: 'Lỗi server khi lấy danh sách đánh giá.',
      error: error.message
    });
  }
};


exports.getReviewDetails = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByPk(reviewId, {
      include: [
        { model: User, as: 'user', attributes: ['id','name','email'] },
        {
          model: ProductVariation,
          as: 'variation',
          attributes: ['id','name','value','price']
        },
        { model: ReviewImage, as: 'images', attributes: ['id','image_url'] }
      ]
    });
    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
    }
    res.status(200).json(review);

  } catch (error) {
    console.error("Lỗi khi admin lấy chi tiết đánh giá:", error);
    res.status(500).json({
      message: 'Lỗi server khi lấy chi tiết đánh giá.',
      error: error.message
    });
  }
};


exports.updateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;
    if (status === undefined || ![0,1,2].includes(parseInt(status,10))) {
      return res.status(400).json({
        message: 'Trạng thái không hợp lệ. Chỉ chấp nhận 0,1 hoặc 2.'
      });
    }
    const review = await Review.findByPk(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá này.' });
    }
    review.status = parseInt(status,10);
    await review.save();
    res.status(200).json({
      message: 'Cập nhật trạng thái đánh giá thành công.',
      review
    });
  } catch (error) {
    console.error("Lỗi khi admin cập nhật trạng thái đánh giá:", error);
    res.status(500).json({
      message: 'Lỗi server khi cập nhật trạng thái.',
      error: error.message
    });
  }
};


exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const review = await Review.findByPk(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Không tìm thấy đánh giá để xóa.' });
    }
    await review.destroy();
    res.status(200).json({ message: 'Đã xóa đánh giá thành công.' });
  } catch (error) {
    console.error("Lỗi khi admin xóa đánh giá:", error);
    res.status(500).json({
      message: 'Lỗi server khi xóa đánh giá.',
      error: error.message
    });
  }
};
