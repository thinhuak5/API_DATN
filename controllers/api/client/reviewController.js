
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
        const { productId } = req.params;
        const { rating, comment, order_item_id } = req.body;

        // Validation
        if (!rating || rating < 1 || rating > 5) {
            await t.rollback();
            return res.status(400).json({ message: 'Điểm đánh giá phải từ 1 đến 5.' });
        }
        if (!order_item_id) {
            await t.rollback();
            return res.status(400).json({ message: 'Thiếu thông tin mục đơn hàng (order_item_id).'});
        }

        // Kiểm tra orderItem và order status
        const orderItem = await OrderItem.findOne({
            where: { id: order_item_id, product_id: productId },
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
            product_id: productId,
            order_item_id: order_item_id,
            rating: parseInt(rating, 10),
            comment: comment,
            status: 1
        }, { transaction: t });

        // Xử lý hình ảnh (Cloudinary)
        if (req.files && req.files.length > 0) {
            const imagesData = req.files.map(file => ({
                review_id: newReview.id,
                image_url: file.path // Lưu URL đầy đủ từ Cloudinary
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
        console.error("Lỗi khi tạo đánh giá:", error);
        res.status(500).json({ message: 'Lỗi server khi tạo đánh giá.', error: error.message });
    }
};

exports.getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        const reviews = await Review.findAll({
            where: {
                product_id: productId,
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
        console.error("Lỗi khi lấy đánh giá sản phẩm:", error);
        res.status(500).json({ message: 'Lỗi server khi lấy đánh giá.', error: error.message });
    }
};

exports.getEligibleOrderItemsForReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        if (!productId) {
            return res.status(400).json({ message: "Thiếu ID sản phẩm." });
        }

        const orderItems = await OrderItem.findAll({
            where: {
                product_id: productId,
            },
            include: [
                {
                    model: Order,
                    as: 'order',
                    where: {
                        user_id: userId,
                        status: { [Op.in]: [3, 4] }
                    },
                    required: true,
                    attributes: ['id', 'createdAt', 'status']
                },
                {
                    model: Review,
                    as: 'review',
                    required: false,
                    attributes: ['id']
                }
            ],
            order: [['id', 'DESC']]
        });

        const eligibleItems = orderItems
            .filter(item => !item.review)
            .map(item => ({
                id: item.id,
                product_id: item.product_id,
                order_id: item.order.id,
                order_date: item.order.createdAt,
            }));

        if (eligibleItems.length > 0) {
            return res.status(200).json({
                message: "Lấy danh sách mục có thể đánh giá thành công.",
                eligibleItems: eligibleItems
            });
        } else {
            const anyPurchasedAndCompleted = await OrderItem.findOne({
                where: { product_id: productId },
                include: [{
                    model: Order,
                    as: 'order',
                    where: { user_id: userId, status: { [Op.in]: [3, 4] } },
                    required: true
                }]
            });

            if (anyPurchasedAndCompleted) {
                return res.status(200).json({
                    message: "Bạn đã đánh giá tất cả các lần mua hợp lệ cho sản phẩm này hoặc không còn mục nào khác để đánh giá.",
                    eligibleItems: []
                });
            } else {
                return res.status(200).json({
                    message: "Bạn cần mua sản phẩm này và đơn hàng phải ở trạng thái đã giao/hoàn thành để có thể viết đánh giá.",
                    eligibleItems: []
                });
            }
        }

    } catch (error) {
        console.error("Lỗi khi lấy các mục đơn hàng có thể đánh giá:", error);
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
        console.error("Lỗi khi cập nhật đánh giá:", error);
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
        console.error("Lỗi khi xóa đánh giá:", error);
        res.status(500).json({ message: 'Lỗi server khi xóa đánh giá.', error: error.message });
    }
};
