// controllers/api/client/reviewController.js
const Review = require('../../../models/review');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const Product = require('../../../models/product');
const User = require('../../../models/user'); // <--- DÒNG ĐƯỢC THÊM VÀO
const {Op} = require('sequelize');

// Controller cho phép người dùng tạo đánh giá cho sản phẩm họ đã mua
exports.createReview = async (req, res) => {
    try {
        const userId = req.user.id; // Lấy từ middleware authenticateToken
        const {productId} = req.params; // Lấy productId từ URL
        const {rating, comment, order_item_id} = req.body;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({message: 'Điểm đánh giá phải từ 1 đến 5.'});
        }

        if (!order_item_id) {
            return res.status(400).json({message: 'Thiếu thông tin mục đơn hàng (order_item_id).'});
        }

        // 1. Kiểm tra xem OrderItem có tồn tại và thuộc về người dùng hiện tại không
        const orderItem = await OrderItem.findOne({
            where: {
                id: order_item_id,
                product_id: productId // Đảm bảo OrderItem này là của đúng sản phẩm đang xem
            },
            include: [{
                model: Order,
                as: 'order',
                where: {user_id: userId},
                required: true // Đảm bảo OrderItem này thuộc về user_id đang đăng nhập
            }]
        });

        if (!orderItem) {
            return res.status(403).json({message: 'Bạn chỉ có thể đánh giá sản phẩm bạn đã mua từ mục đơn hàng này.'});
        }

        // 2. Kiểm tra xem Order liên quan đã hoàn thành chưa (ví dụ status = 3 là đã giao, 4 là hoàn thành)
        // Bạn cần định nghĩa rõ các trạng thái này trong model Order của mình
        // Giả sử Order có status: 1 (Chờ xác nhận), 2 (Đang xử lý), 3 (Đang giao), 4 (Hoàn thành), 5 (Đã hủy)
        const associatedOrder = await Order.findByPk(orderItem.order_id);
        if (!associatedOrder || ![3, 4].includes(associatedOrder.status)) { // Chỉ cho phép đánh giá khi đơn hàng đã giao hoặc hoàn thành
            return res.status(403).json({message: 'Bạn chỉ có thể đánh giá sản phẩm sau khi đơn hàng đã được giao hoặc hoàn thành.'});
        }


        // 3. Kiểm tra xem người dùng đã đánh giá cho order_item_id này chưa
        const existingReview = await Review.findOne({
            where: {
                // user_id: userId, // Không cần user_id ở đây vì order_item_id đã là unique
                // product_id: productId, // Cũng không cần vì order_item_id đã gắn với product
                order_item_id: order_item_id // order_item_id đã là unique trong bảng reviews
            }
        });

        if (existingReview) {
            // Nếu muốn kiểm tra user_id để thông báo "Bạn đã đánh giá..." thì giữ lại điều kiện user_id
            // const existingReviewForUser = await Review.findOne({
            //     where: {
            //         user_id: userId,
            //         order_item_id: order_item_id
            //     }
            // });
            // if (existingReviewForUser) {
            //    return res.status(409).json({ message: 'Bạn đã đánh giá sản phẩm này từ mục đơn hàng này rồi.' });
            // }
            // Nếu chỉ check order_item_id (nghĩa là item này đã được ai đó đánh giá - điều này không nên xảy ra nếu logic đúng)
            return res.status(409).json({message: 'Mục đơn hàng này đã được đánh giá.'});
        }

        // 4. Tạo đánh giá mới
        const newReview = await Review.create({
            user_id: userId,
            product_id: productId, // Lưu lại productId để dễ truy vấn review theo sản phẩm
            order_item_id: order_item_id,
            rating: parseInt(rating, 10),
            comment: comment,
            status: 1 // Mặc định là đã duyệt, hoặc 0 nếu cần duyệt
        });

        res.status(201).json({message: 'Cảm ơn bạn đã đánh giá sản phẩm!', review: newReview});

    } catch (error) {
        console.error("Lỗi khi tạo đánh giá:", error);
        if (error.name === 'SequelizeUniqueConstraintError') { // Do order_item_id là unique
            return res.status(409).json({message: 'Mục đơn hàng này đã được đánh giá.'});
        }
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
                status: 1 // Chỉ lấy các đánh giá đã được duyệt
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'avatar'] // Chỉ lấy các thông tin cần thiết của user
                }
            ],
            order: [['review_date', 'DESC']] // Sắp xếp theo ngày mới nhất (hoặc createdAt nếu review_date không dùng)
        });

        // if (!reviews || reviews.length === 0) { // Vẫn trả về 200 nếu không có reviews
        //     return res.status(200).json({ message: 'Sản phẩm này chưa có đánh giá nào.', reviews: [], totalReviews: 0, averageRating: 0 });
        // }

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

// (Tùy chọn) Controller cho admin quản lý đánh giá
// controllers/api/admin/reviewAdminController.js (bạn có thể tạo file riêng)

// exports.getAllReviewsForAdmin = async (req, res) => { ... }
// exports.updateReviewStatus = async (req, res) => { ... } // Thay đổi status (approve/reject)
// exports.deleteReviewByAdmin = async (req, res) => { ... }