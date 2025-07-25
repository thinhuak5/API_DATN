// controllers/api/client/reviewController.js
const Review = require('../../../models/review');
const ReviewImage = require('../../../models/ReviewImage');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const Product = require('../../../models/product');
const User = require('../../../models/user'); // <--- DÒNG ĐƯỢC THÊM VÀO
const database = require('../../../models/database');
const {Op} = require('sequelize');

exports.createReview = async (req, res) => {
    const t = await database.transaction(); // Bắt đầu transaction
    try {
        const userId = req.user.id;
        const {productId} = req.params;
        const {rating, comment, order_item_id} = req.body;

        // ... (phần validation và kiểm tra orderItem, order status, existing review giữ nguyên) ...
        if (!rating || rating < 1 || rating > 5) {
             return res.status(400).json({message: 'Điểm đánh giá phải từ 1 đến 5.'});
        }
        if (!order_item_id) {
             return res.status(400).json({message: 'Thiếu thông tin mục đơn hàng (order_item_id).'});
        }
        const orderItem = await OrderItem.findOne({ where: { id: order_item_id, product_id: productId }, include: [{ model: Order, as: 'order', where: {user_id: userId}, required: true }]});
        if (!orderItem) {
             return res.status(403).json({message: 'Bạn chỉ có thể đánh giá sản phẩm bạn đã mua từ mục đơn hàng này.'});
        }
        const associatedOrder = await Order.findByPk(orderItem.order_id);
        if (!associatedOrder || ![3, 4].includes(associatedOrder.status)) {
            return res.status(403).json({message: 'Bạn chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã được giao hoặc hoàn thành.'});
        }
        const existingReview = await Review.findOne({ where: { order_item_id: order_item_id } });
        if (existingReview) {
             return res.status(409).json({message: 'Mục đơn hàng này đã được đánh giá.'});
        }
        // --- Kết thúc phần kiểm tra ---

        // 4. Tạo đánh giá mới trong transaction
        const newReview = await Review.create({
            user_id: userId,
            product_id: productId,
            order_item_id: order_item_id,
            rating: parseInt(rating, 10),
            comment: comment,
            status: 1
        }, {transaction: t});

        // 5. Xử lý hình ảnh nếu có
        if (req.files && req.files.length > 0) {
            const imagesData = req.files.map(file => ({
                review_id: newReview.id,
                image_url: file.filename // Lưu tên file đã được multer xử lý
            }));
            await ReviewImage.bulkCreate(imagesData, {transaction: t});
        }

        await t.commit(); // Hoàn thành transaction

        // Lấy lại review với đầy đủ thông tin để trả về
        const finalReview = await Review.findByPk(newReview.id, {
            include: [{model: ReviewImage, as: 'images'}]
        });

        res.status(201).json({message: 'Cảm ơn bạn đã đánh giá sản phẩm!', review: finalReview});

    } catch (error) {
        await t.rollback(); // Hoàn tác transaction nếu có lỗi
        console.error("Lỗi khi tạo đánh giá:", error);
        res.status(500).json({message: 'Lỗi server khi tạo đánh giá.', error: error.message});
    }
};

// Controller lấy tất cả các đánh giá (đã duyệt) cho một sản phẩm
exports.getProductReviews = async (req, res) => {
    try {
        const {productId} = req.params;

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
                    model: ReviewImage, // <--- THÊM VÀO
                    as: 'images',
                    attributes: ['id', 'image_url']
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        
        // ... (Phần tính toán average rating giữ nguyên) ...
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
        res.status(500).json({message: 'Lỗi server khi lấy đánh giá.', error: error.message});
    }
};

exports.getEligibleOrderItemsForReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const {productId} = req.params;

        if (!productId) {
            return res.status(400).json({message: "Thiếu ID sản phẩm."});
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
                        status: {[Op.in]: [3, 4]} // Quan trọng: Đảm bảo status này đúng
                    },
                    required: true,
                    attributes: ['id', 'createdAt', 'status'] // Thêm status để debug nếu cần
                },
                {
                    model: Review,
                    as: 'review',
                    required: false,
                    attributes: ['id']
                }
            ],
            order: [['id', 'DESC']] // Ưu tiên các item mới hơn nếu có nhiều
        });

        const eligibleItems = orderItems
            .filter(item => !item.review) // Chỉ những item chưa có review
            .map(item => ({
                id: item.id,
                product_id: item.product_id,
                order_id: item.order.id,
                order_date: item.order.createdAt, // Ngày tạo đơn hàng
                // order_status: item.order.status // Có thể thêm để client biết trạng thái
            }));

        if (eligibleItems.length > 0) {
            return res.status(200).json({
                message: "Lấy danh sách mục có thể đánh giá thành công.",
                eligibleItems: eligibleItems
            });
        } else {
            // Kiểm tra xem người dùng có từng mua sản phẩm này và đơn hàng đã hoàn thành nhưng đã review hết chưa
            // hoặc chưa từng mua/đơn hàng chưa hoàn thành.
            const anyPurchasedAndCompleted = await OrderItem.findOne({
                where: {product_id: productId},
                include: [{
                    model: Order,
                    as: 'order',
                    where: {user_id: userId, status: {[Op.in]: [3, 4]}},
                    required: true
                }]
            });

            if (anyPurchasedAndCompleted) {
                // Đã mua và hoàn thành, nhưng không còn item nào eligible (có thể đã review hết)
                return res.status(200).json({
                    message: "Bạn đã đánh giá tất cả các lần mua hợp lệ cho sản phẩm này hoặc không còn mục nào khác để đánh giá.",
                    eligibleItems: []
                });
            } else {
                // Chưa mua, hoặc đơn hàng chưa ở trạng thái cho phép đánh giá
                return res.status(200).json({ // Vẫn trả về 200, nhưng với message rõ ràng
                    message: "Bạn cần mua sản phẩm này và đơn hàng phải ở trạng thái đã giao/hoàn thành để có thể viết đánh giá.",
                    eligibleItems: []
                });
            }
        }

    } catch (error) {
        console.error("Lỗi khi lấy các mục đơn hàng có thể đánh giá:", error);
        res.status(500).json({message: "Lỗi server khi xử lý yêu cầu.", error: error.message});
    }
};

exports.updateReview = async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.user.id;
    const { rating, comment, imagesToDelete } = req.body; // imagesToDelete là một mảng ID các ảnh cần xóa

    const t = await database.transaction();
    try {
        const review = await Review.findByPk(reviewId);

        if (!review) {
            await t.rollback();
            return res.status(404).json({ message: 'Không tìm thấy đánh giá này.' });
        }

        // Kiểm tra quyền: chỉ người viết mới được sửa
        if (review.user_id !== userId) {
            await t.rollback();
            return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa đánh giá này.' });
        }

        // Cập nhật rating và comment
        review.rating = rating || review.rating;
        review.comment = comment !== undefined ? comment : review.comment;
        await review.save({ transaction: t });

        // Xóa các ảnh được yêu cầu
        if (imagesToDelete && imagesToDelete.length > 0) {
            // Chuyển chuỗi JSON thành mảng nếu cần
            const idsToDelete = typeof imagesToDelete === 'string' ? JSON.parse(imagesToDelete) : imagesToDelete;
            if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
                 await ReviewImage.destroy({
                    where: {
                        id: { [Op.in]: idsToDelete },
                        review_id: reviewId // Đảm bảo chỉ xóa ảnh của review này
                    },
                    transaction: t
                });
            }
        }

        // Thêm ảnh mới nếu có
        if (req.files && req.files.length > 0) {
            const imagesData = req.files.map(file => ({
                review_id: reviewId,
                image_url: file.filename
            }));
            await ReviewImage.bulkCreate(imagesData, { transaction: t });
        }

        await t.commit();

        // Lấy lại review đã cập nhật để trả về
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

// Controller MỚI cho phép người dùng xóa đánh giá của họ
exports.deleteReview = async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.user.id;

    try {
        const review = await Review.findByPk(reviewId);

        if (!review) {
            return res.status(404).json({ message: 'Không tìm thấy đánh giá này.' });
        }

        if (review.user_id !== userId) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa đánh giá này.' });
        }

        // Xóa review, các ảnh liên quan sẽ tự động bị xóa do 'onDelete: CASCADE'
        await review.destroy();

        res.status(200).json({ message: 'Đã xóa đánh giá thành công.' });
    } catch (error) {
        console.error("Lỗi khi xóa đánh giá:", error);
        res.status(500).json({ message: 'Lỗi server khi xóa đánh giá.', error: error.message });
    }
};

// (Tùy chọn) Controller cho admin quản lý đánh giá
// controllers/api/admin/reviewAdminController.js (bạn có thể tạo file riêng)

// exports.getAllReviewsForAdmin = async (req, res) => { ... }
// exports.updateReviewStatus = async (req, res) => { ... } // Thay đổi status (approve/reject)
// exports.deleteReviewByAdmin = async (req, res) => { ... }