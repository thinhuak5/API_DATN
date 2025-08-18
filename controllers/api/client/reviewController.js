// controllers/api/client/reviewController.js
const path = require('path');
const Review = require('../../../models/review');
const ReviewImage = require('../../../models/ReviewImage');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const ProductVariation = require('../../../models/productVariation');
const User = require('../../../models/user');
const database = require('../../../models/database');
const { Op } = require('sequelize');
const cloudinary = require('cloudinary').v2;

/* Bật Cloudinary chỉ khi đủ ENV */
const CLOUDINARY_ENABLED =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

if (CLOUDINARY_ENABLED) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/* Helper: rút public_id từ URL Cloudinary */
function extractPublicIdFromUrl(url) {
  try {
    if (!url) return null;
    const afterUpload = url.split('/upload/')[1];
    if (!afterUpload) return null;
    const noVersion = afterUpload.replace(/^v\d+\//, '');
    const noQuery = noVersion.split('?')[0];
    const lastDot = noQuery.lastIndexOf('.');
    return lastDot > -1 ? noQuery.slice(0, lastDot) : noQuery;
  } catch {
    return null;
  }
}

/* Helper: chuyển file multer -> URL public */
function toPublicUrlFromFile(file, req) {
  if (!file) return '';
  const p = String(file.path || '');
  if (/^https?:\/\//i.test(p)) return p; // Cloudinary (secure_url/url) đã là URL

  const base = process.env.FILE_BASE_URL || `${req.protocol}://${req.get('host')}`;
  // Lấy tên file an toàn kể cả path Windows
  const filename = (file.filename ||
    path.basename(p).replace(/\\/g, '/').split('/').pop() ||
    `${Date.now()}`).trim();

  return `${base}/uploads/${filename}`;
}

/* Tạo review: POST /api/variationId/:variationId/reviews */
exports.createReview = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user?.id;
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Bạn cần đăng nhập.' });
    }

    const variation_id = Number(req.body.variation_id || req.params.variationId);
    const { rating, comment, order_item_id } = req.body;
    const ratingNum = parseInt(rating, 10);

    if (!variation_id) {
      await t.rollback();
      return res.status(400).json({ message: 'Thiếu ID biến thể sản phẩm (variation_id).' });
    }
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      await t.rollback();
      return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5.' });
    }
    if (!order_item_id) {
      await t.rollback();
      return res.status(400).json({ message: 'Thiếu thông tin mục đơn hàng (order_item_id).' });
    }

    const pv = await ProductVariation.findByPk(variation_id, { transaction: t });
    if (!pv) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy biến thể sản phẩm.' });
    }

    const orderItem = await OrderItem.findByPk(order_item_id, { transaction: t });
    if (!orderItem) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy mục đơn hàng.' });
    }
    if (Number(orderItem.variation_id) !== Number(variation_id)) {
      await t.rollback();
      return res.status(400).json({ message: 'Mục đơn hàng không khớp với biến thể cần đánh giá.' });
    }

    const associatedOrder = await Order.findByPk(orderItem.order_id, { transaction: t });
    if (!associatedOrder) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng tương ứng.' });
    }
    if (Number(associatedOrder.user_id) !== Number(userId)) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn chỉ có thể đánh giá đơn hàng của chính bạn.' });
    }
    if (![3, 4].includes(Number(associatedOrder.status))) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn chỉ có thể đánh giá sau khi đơn đã giao/hoàn thành.' });
    }

    const existingReview = await Review.findOne({
      where: { order_item_id },
      transaction: t,
    });
    if (existingReview) {
      await t.rollback();
      return res.status(409).json({ message: 'Mục đơn hàng này đã được đánh giá.' });
    }

    const newReview = await Review.create(
      {
        user_id: userId,
        variation_id,
        order_item_id,
        rating: ratingNum,
        comment: comment ?? '',
        status: 0, // chờ duyệt
      },
      { transaction: t }
    );

    // Lưu ảnh → luôn convert sang URL public
    if (req.files && req.files.length > 0) {
      const imagesData = req.files.map((file) => ({
        review_id: newReview.id,
        image_url: toPublicUrlFromFile(file, req),
      }));
      await ReviewImage.bulkCreate(imagesData, { transaction: t });
    }

    await t.commit();

    const finalReview = await Review.findByPk(newReview.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: ReviewImage, as: 'images', attributes: ['id', 'image_url'] },
      ],
    });

    return res.status(201).json({ message: 'Cảm ơn bạn đã đánh giá sản phẩm!', review: finalReview });
  } catch (error) {
    await t.rollback();
    console.error('createReview error:', error);
    return res.status(500).json({ message: 'Lỗi server khi tạo đánh giá.', error: error.message });
  }
};

/* Lấy review theo variation: GET /api/variationId/:variationId/reviews */
exports.getProductReviews = async (req, res) => {
  try {
    const { variationId } = req.params;

    const reviews = await Review.findAll({
      where: { variation_id: variationId, status: 1 },
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: ReviewImage, as: 'images', attributes: ['id', 'image_url'] },
      ],
      order: [['id', 'DESC']],
    });

    const total = reviews.length;
    const sum = reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0);
    const average = total ? Number((sum / total).toFixed(1)) : 0;

    return res.status(200).json({
      message: total ? 'Lấy danh sách đánh giá thành công.' : 'Sản phẩm này chưa có đánh giá nào.',
      reviews,
      totalReviews: total,
      averageRating: average,
    });
  } catch (error) {
    console.error('getProductReviews error:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy đánh giá.', error: error.message });
  }
};

/* Kiểm tra quyền review theo productId:
   GET /api/products/eligible-for-review/:productId?variationId=... */
exports.checkEligibleForReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { variationId } = req.query;

    let variationIds = [];
    if (variationId) {
      variationIds = [Number(variationId)];
    } else {
      const variations = await ProductVariation.findAll({
        where: { product_id: productId },
        attributes: ['id'],
      });
      variationIds = variations.map((v) => v.id);
    }

    if (variationIds.length === 0) {
      return res.status(200).json({ eligible: false, eligibleItems: [], count: 0 });
    }

    const orderItems = await OrderItem.findAll({
      where: { variation_id: { [Op.in]: variationIds } },
      include: [
        {
          model: Order,
          as: 'order',
          where: { user_id: userId, status: { [Op.in]: [3, 4] } },
          required: true,
        },
      ],
      order: [['id', 'DESC']],
    });

    if (!orderItems.length) {
      return res.status(200).json({ eligible: false, eligibleItems: [], count: 0 });
    }

    const orderItemIds = orderItems.map((i) => i.id);
    const reviewed = await Review.findAll({
      where: { order_item_id: { [Op.in]: orderItemIds } },
      attributes: ['order_item_id'],
    });
    const reviewedSet = new Set(reviewed.map((r) => r.order_item_id));

    const eligibleItems = orderItems
      .filter((i) => !reviewedSet.has(i.id))
      .map((i) => ({
        order_item_id: i.id,
        variation_id: i.variation_id,
        order_id: i.order_id,
      }));

    return res.status(200).json({
      eligible: eligibleItems.length > 0,
      eligibleItems,
      count: eligibleItems.length,
    });
  } catch (error) {
    console.error('checkEligibleForReview error:', error);
    return res.status(500).json({ message: 'Lỗi server khi kiểm tra quyền review.', error: error.message });
  }
};

/* (Tuỳ chọn) GET /api/variation/:variationId/eligible-for-review */
exports.getEligibleOrderItemsForReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const { variationId } = req.params;
    if (!variationId) {
      return res.status(400).json({ message: 'Thiếu ID biến thể.' });
    }

    const items = await OrderItem.findAll({
      where: { variation_id: variationId },
      include: [
        {
          model: Order,
          as: 'order',
          where: { user_id: userId, status: { [Op.in]: [3, 4] } },
          required: true,
        },
      ],
    });

    if (!items.length) {
      return res.status(200).json({ eligibleItems: [], count: 0 });
    }

    const ids = items.map((i) => i.id);
    const reviewed = await Review.findAll({
      where: { order_item_id: { [Op.in]: ids } },
      attributes: ['order_item_id'],
    });
    const reviewedSet = new Set(reviewed.map((r) => r.order_item_id));

    const eligibleItems = items
      .filter((i) => !reviewedSet.has(i.id))
      .map((i) => ({
        order_item_id: i.id,
        variation_id: i.variation_id,
        order_id: i.order_id,
      }));

    return res.status(200).json({ eligibleItems, count: eligibleItems.length });
  } catch (error) {
    console.error('getEligibleOrderItemsForReview error:', error);
    return res.status(500).json({ message: 'Lỗi server khi xử lý yêu cầu.', error: error.message });
  }
};

/* Cập nhật review */
exports.updateReview = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;

  const t = await database.transaction();
  try {
    const review = await Review.findByPk(reviewId, { transaction: t });
    if (!review) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đánh giá này.' });
    }
    if (Number(review.user_id) !== Number(userId)) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đánh giá này.' });
    }

    const { rating, comment, imagesToDelete } = req.body;

    if (rating !== undefined) {
      const r = parseInt(rating, 10);
      if (r < 1 || r > 5) {
        await t.rollback();
        return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5.' });
      }
      review.rating = r;
    }
    if (comment !== undefined) {
      review.comment = comment;
    }
    await review.save({ transaction: t });

    let idsToDelete = [];
    if (imagesToDelete) {
      idsToDelete =
        typeof imagesToDelete === 'string'
          ? (() => { try { return JSON.parse(imagesToDelete); } catch { return []; } })()
          : imagesToDelete;
    }
    if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
      const imgs = await ReviewImage.findAll({
        where: { id: { [Op.in]: idsToDelete }, review_id: reviewId },
        transaction: t,
      });

      if (CLOUDINARY_ENABLED) {
        for (const img of imgs) {
          const publicId = extractPublicIdFromUrl(img.image_url);
          if (publicId) {
            try { await cloudinary.uploader.destroy(publicId); } catch {}
          }
        }
      }

      await ReviewImage.destroy({
        where: { id: { [Op.in]: idsToDelete }, review_id: reviewId },
        transaction: t,
      });
    }

    if (req.files && req.files.length > 0) {
      const imagesData = req.files.map((file) => ({
        review_id: reviewId,
        image_url: toPublicUrlFromFile(file, req),
      }));
      await ReviewImage.bulkCreate(imagesData, { transaction: t });
    }

    await t.commit();

    const updatedReview = await Review.findByPk(reviewId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'avatar'] },
        { model: ReviewImage, as: 'images', attributes: ['id', 'image_url'] },
      ],
    });

    return res.status(200).json({ message: 'Cập nhật đánh giá thành công!', review: updatedReview });
  } catch (error) {
    await t.rollback();
    console.error('updateReview error:', error);
    return res.status(500).json({ message: 'Lỗi server khi cập nhật đánh giá.', error: error.message });
  }
};

/* Xoá review */
exports.deleteReview = async (req, res) => {
  const { reviewId } = req.params;
  const userId = req.user.id;

  const t = await database.transaction();
  try {
    const review = await Review.findByPk(reviewId, { transaction: t });
    if (!review) {
      await t.rollback();
      return res.status(404).json({ message: 'Không tìm thấy đánh giá này.' });
    }
    if (Number(review.user_id) !== Number(userId)) {
      await t.rollback();
      return res.status(403).json({ message: 'Bạn không có quyền xóa đánh giá này.' });
    }

    const images = await ReviewImage.findAll({ where: { review_id: reviewId }, transaction: t });

    if (CLOUDINARY_ENABLED) {
      for (const image of images) {
        const publicId = extractPublicIdFromUrl(image.image_url);
        if (publicId) {
          try { await cloudinary.uploader.destroy(publicId); } catch {}
        }
      }
    }

    await ReviewImage.destroy({ where: { review_id: reviewId }, transaction: t });
    await review.destroy({ transaction: t });

    await t.commit();
    return res.status(200).json({ message: 'Đã xóa đánh giá thành công.' });
  } catch (error) {
    await t.rollback();
    console.error('deleteReview error:', error);
    return res.status(500).json({ message: 'Lỗi server khi xóa đánh giá.', error: error.message });
  }
};
