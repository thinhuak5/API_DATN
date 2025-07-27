const Review = require('../../../models/review');
const ReviewImage = require('../../../models/ReviewImage');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const Product = require('../../../models/product');
const User = require('../../../models/user');
const database = require('../../../models/database');
const { Op } = require('sequelize');
const cloudinary = require('cloudinary').v2;

// Cấu hình Cloudinary (đảm bảo đồng bộ với file upload)
cloudinary.config({
    cloud_name: 'dpcybmljb',
    api_key: '922923592596195',
    api_secret: 'Q16PLsqe2uaHtegpBRZL3iIpCqM'
});

exports.createReview = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const { rating, comment, order_item_id, variation_id } = req.body;

    // Kiểm tra variation_id
    if (!variation_id) {
      await t.rollback();
      return res.status(400).json({ message: 'Thiếu ID biến thể sản phẩm (variation_id).' });
    }

    // Kiểm tra rating
    if (!rating || rating < 1 || rating > 5) {
      await t.rollback();
      return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5.' });
    }

    if (!order_item_id) {
      await t.rollback();
      return res.status(400).json({ message: 'Thiếu thông tin mục đơn hàng (order_item_id).' });
    }

    // Kiểm tra orderItem và order status
    const orderItem = await OrderItem.findOne({
      where: { id: order_item_id, variation_id: variation_id },  // Kiểm tra đúng variation_id
      include: [{ model: Order, as: 'order', where: { user_id: userId }, required: true }]
    });

    if (!orderItem) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn chỉ có thể đánh giá sản phẩm bạn đã mua từ mục đơn hàng này.' });
    }

    const associatedOrder = await Order.findByPk(orderItem.order_id);
    if (!associatedOrder || ![3, 4].includes(associatedOrder.status)) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã được giao hoặc hoàn thành.' });
    }

    // Kiểm tra xem đã review chưa
    const existingReview = await Review.findOne({ where: { order_item_id: order_item_id } });
    if (existingReview) {
      await t.rollback();
      return res.status(409).json({ message: 'Mục đơn hàng này đã được đánh giá.' });
    }

    // Tạo đánh giá mới
    const newReview = await Review.create({
      user_id: userId,
      variation_id: variation_id,  // Sử dụng variation_id thay vì product_id
      order_item_id: order_item_id,
      rating: parseInt(rating, 10),
      comment: comment,
      status: 0
    }, { transaction: t });

    // Xử lý hình ảnh (Cloudinary)
    if (req.files && req.files.length > 0) {
      const imagesData = req.files.map(file => ({
        review_id: newReview.id,
        image_url: file.path // Lưu URL Cloudinary
      }));
      await ReviewImage.bulkCreate(imagesData, { transaction: t });
    }

    await t.commit();

    // Lấy lại review với đầy đủ thông tin
    const finalReview = await Review.findByPk(newReview.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: ReviewImage, as: 'images', attributes: ['id', 'image_url'] }
      ]
    });

    res.status(201).json({ message: 'Cảm ơn bạn đã đánh giá sản phẩm!', review: finalReview });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Lỗi server khi tạo đánh giá.', error: error.message });
  }
};


exports.getProductReviews = async (req, res) => {
  try {
    const { variationId } = req.params;

    const reviews = await Review.findAll({
      where: {
        variation_id: variationId,
        status: 1
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'avatar']
        },
        {
          model: ReviewImage,
          as: 'images',
          attributes: ['id', 'image_url']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    let totalRating = 0;
    reviews.forEach(review => {
      totalRating += review.rating;
    });
    const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;

    res.status(200).json({
      message: reviews.length > 0 ? 'Lấy danh sách đánh giá thành công.' : 'Sản phẩm này chưa có đánh giá nào.',
      reviews: reviews,
      totalReviews: reviews.length,
      averageRating: parseFloat(averageRating)
    });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi server khi lấy đánh giá.', error: error.message });
  }
};

exports.getEligibleOrderItemsForReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { variationId } = req.params;

    // Kiểm tra xem variationId có được truyền đúng không
    if (!variationId) {
      return res.status(400).json({ message: "Thiếu ID biến thể." });
    }

    // Kiểm tra sự tồn tại của variationId trong cơ sở dữ liệu
    const orderItems = await OrderItem.findAll({
      where: { variation_id: variationId },  // Kiểm tra đúng variation_id
      include: [
        {
          model: Order,
          as: 'order',
          where: { user_id: userId, status: { [Op.in]: [3, 4] } },
          required: true
        },
        {
          model: Review,
          as: 'review',
          required: false,
          attributes: ['id']
        }
      ]
    });

    if (!orderItems || orderItems.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng cho biến thể này." });
    }

    res.status(200).json({ eligibleItems: orderItems });

  } catch (error) {
    res.status(500).json({ message: "Lỗi server khi xử lý yêu cầu.", error: error.message });
  }
};




exports.updateReview = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;
  const { rating, comment, imagesToDelete } = req.body;

  const t = await database.transaction();
  try {
    const review = await Review.findByPk(reviewId);

    if (!review) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đánh giá này.' });
    }

    if (review.user_id !== userId) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đánh giá này.' });
    }

    // Cập nhật rating và comment
    review.rating = rating ? parseInt(rating, 10) : review.rating;
    review.comment = comment !== undefined ? comment : review.comment;
    await review.save({ transaction: t });

    // Xóa ảnh cũ trên Cloudinary và database
    if (imagesToDelete && imagesToDelete.length > 0) {
      const idsToDelete = typeof imagesToDelete === 'string' ? JSON.parse(imagesToDelete) : imagesToDelete;
      if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
        // Lấy danh sách ảnh để xóa trên Cloudinary
        const imagesToDelete = await ReviewImage.findAll({
          where: {
            id: { [Op.in]: idsToDelete },
            review_id: reviewId
          }
        });

        // Xóa ảnh trên Cloudinary
        for (const image of imagesToDelete) {
          const publicId = image.image_url.split('/').pop().split('.')[0]; // Lấy public_id từ URL
          await cloudinary.uploader.destroy(`Uploads/${publicId}`);
        }

        // Xóa ảnh trong database
        await ReviewImage.destroy({
          where: {
            id: { [Op.in]: idsToDelete },
            review_id: reviewId
          },
          transaction: t
        });
      }
    }

    // Thêm ảnh mới
    if (req.files && req.files.length > 0) {
      const imagesData = req.files.map(file => ({
        review_id: reviewId,
        image_url: file.path // Lưu URL Cloudinary
      }));
      await ReviewImage.bulkCreate(imagesData, { transaction: t });
    }

    await t.commit();

    // Lấy lại review đã cập nhật
    const updatedReview = await Review.findByPk(reviewId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: ReviewImage, as: 'images', attributes: ['id', 'image_url'] }
      ]
    });

    res.status(200).json({ message: 'Cập nhật đánh giá thành công!', review: updatedReview });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Lỗi server khi cập nhật đánh giá.', error: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;

  const t = await database.transaction();
  try {
    const review = await Review.findByPk(reviewId);

    if (!review) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đánh giá này.' });
    }

    if (review.user_id !== userId) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền xóa đánh giá này.' });
    }

    // Lấy danh sách ảnh để xóa trên Cloudinary
    const images = await ReviewImage.findAll({ where: { review_id: reviewId } });
    for (const image of images) {
      const publicId = image.image_url.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`Uploads/${publicId}`);
    }

    // Xóa review (ảnh sẽ tự động xóa do CASCADE)
    await review.destroy({ transaction: t });

    await t.commit();
    res.status(200).json({ message: 'Đã xóa đánh giá thành công.' });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ message: 'Lỗi server khi xóa đánh giá.', error: error.message });
  }
};
