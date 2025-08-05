const express = require("express");
const router = express.Router();
const upload = require("../config/upload");
const CategoryController = require("../controllers/api/admin/categoryController");
const ProductController = require("../controllers/api/admin/productController");
const UserController = require("../controllers/api/admin/userController");
const CommentController = require("../controllers/api/admin/commentController");
const OrderController = require("../controllers/api/admin/orderController");
const CartController = require("../controllers/api/client/cartController");
const ClientCheckoutController = require("../controllers/api/client/checkoutController"); // Controller checkout mới
const {
  authenticateToken,
  requireLogin,
  isAdmin,
} = require("../middleware/authMiddleware");
const ClientOrderHistoryController = require("../controllers/api/client/orderHistoryController");
const {
  createPaymentQr,
  checkoutVNpay,
} = require("../controllers/api/client/vnpayController");
const momoController = require("../controllers/api/client/momoController");
const ClientReviewController = require("../controllers/api/client/reviewController");
const AdminReviewController = require("../controllers/api/admin/reviewAdminController");

const DiscountController = require("../controllers/api/admin/discountController");
const {
  deletePaidCartItems,
} = require("../controllers/api/client/cartController");
const statisticsController = require('../controllers/api/admin/statisticsController');
const ContactController = require("../controllers/api/client/contactController");
/*const AuthController = require('../controllers/client/authController'); */

/* router.post('/register',upload.single('avatar'), AuthController.register ); */
/* -----API Admin----- */


// Route thống kê tổng quan
router.get('/statistics', statisticsController.getStatistics);

router.get('/statistics/weekly-revenue', statisticsController.getWeeklyRevenue);
router.get("/categories/list", CategoryController.getAll);
router.get('/categories/list', CategoryController.getAll); // Lấy tất cả danh mục (cha + con)
router.get('/categories/parents', CategoryController.getAllParents); // Lấy tất cả danh mục cha (parent_id = NULL)
router.get('/categories/by-parent/:parent_id', CategoryController.getByParent); // Lấy tất cả danh mục con của 1 cha
router.get('/categories/:id', CategoryController.detail); // Lấy chi tiết danh mục
router.post('/categories/add', upload.single('images'), CategoryController.create); // Thêm mới danh mục (cha hoặc con)
router.put('/categories/:id', upload.single('images'), CategoryController.update); // Cập nhật danh mục
router.delete('/categories/:id', CategoryController.delete); // Xóa danh mục


// Sản Phẩm Admin
router.get("/products/list", ProductController.getAll);
router.get("/products/:id", ProductController.detail);
router.post(
  "/products/add",
  upload.array("images", 10),
  ProductController.create
);
router.put(
  "/products/:id",
  upload.array("images", 10),
  ProductController.update
);
router.delete("/products/:id", ProductController.delete);

// Sản Phẩm Admin
// router.post('/register', UserController.register);
router.post('/register', upload.single('avatar'), UserController.register);
router.post('/login', UserController.login);
router.post('/login-google', UserController.loginGoogle);

// Sản Phẩm Admin
// router.post('/register', UserController.register);
// router.post('/login', UserController.login);

// Lấy danh sách user
router.get("/users/list", UserController.getAll);

// Lấy thông tin user theo ID
router.get("/users/:id", UserController.detail);

// Đăng ký user kèm avatar

// Cập nhật thông tin user, hỗ trợ upload avatar nếu có
router.put("/users/:id", upload.single("avatar"), UserController.update);

// Xóa user
router.delete("/users/:id", UserController.delete);

// // bình luận 
router.get('/comments', CommentController.getAll);
router.get('/comments/:id', CommentController.detail);
router.post('/comments', CommentController.create);
router.put('/comments/:id', CommentController.update);
router.delete('/comments/:id', CommentController.delete);

// oder 
router.get('/oders', OrderController.getAll);
router.get('/oders/:id', OrderController.detail);
router.put('/oders/:id', OrderController.update);
router.post('/oders', OrderController.create);
router.delete('/oders/:id', OrderController.delete);


// thêm sản phẩm vào giỏ hàng
router.post(
  "/cart/add",
  authenticateToken,
  requireLogin,
  CartController.addToCart
);

// Lấy danh sách sản phẩm trong giỏ
router.get("/cart", authenticateToken, CartController.getCart);

// Cập nhật số lượng của một MỤC GIỎ HÀNG cụ thể
// Frontend sẽ gửi { quantity: newQuantity } đến endpoint này
router.put(
  "/cart/update/:cart_item_id",
  authenticateToken,
  CartController.updateCart
);

// Xoá một MỤC GIỎ HÀNG cụ thể khỏi giỏ
router.delete(
  "/cart/:cart_item_id",
  authenticateToken,
  CartController.removeFromCart
);

// Xóa các MỤC GIỎ HÀNG đã chọn sau khi đặt hàng
// Frontend sẽ gửi { selectedCartItemIds: [...] } trong body
router.post('/cart/clear-selected-items', authenticateToken, CartController.clearCart); 


// paymennt VNpay
router.post("/create-qr", createPaymentQr);
router.get("/check-payment-vnpay", checkoutVNpay);
router.get("/vnpay-return", checkoutVNpay);
router.post("/vnpay-success", authenticateToken, deletePaidCartItems);

// payment MoMo
router.post(
  "/payments/momo",
  authenticateToken,
  momoController.createMomoPayment
);

// Checkout - API MỚI
// Cần middleware authenticateToken để đảm bảo chỉ user đã đăng nhập mới checkout được
router.post(
  "/orders/checkout",
  authenticateToken,
  ClientCheckoutController.createOrder
);
router.get(
  "/orders/history",
  authenticateToken,
  ClientOrderHistoryController.getOrderHistory
);
router.put(
  "/orders/:id/cancel",
  authenticateToken,
  ClientOrderHistoryController.cancelOrder
);

// --- ROUTES CHO ĐÁNH GIÁ SẢN PHẨM ---
router.post(
  "/variationId/:variationId/reviews",
  authenticateToken,
  upload.array("images", 5), // <--- SỬA ĐỔI: Chấp nhận tối đa 5 file ảnh với field name là 'images'
  ClientReviewController.createReview
);

// Lấy tất cả đánh giá cho một sản phẩm (công khai)
router.get('/variationId/:variationId/reviews', ClientReviewController.getProductReviews);

// Cập nhật một đánh giá đã có (chỉ chủ sở hữu)
router.put(
  "/reviews/:reviewId",
  authenticateToken,
  upload.array("images", 5), // Cũng hỗ trợ upload ảnh mới khi sửa
  ClientReviewController.updateReview
);

// Xóa một đánh giá (chỉ chủ sở hữu)
router.delete(
  "/reviews/:reviewId",
  authenticateToken,
  ClientReviewController.deleteReview
);

router.get(
  "/products/eligible-for-review/:variationId", // URL này sẽ được nối sau prefix /api (nếu có)
  authenticateToken,
  ClientReviewController.getEligibleOrderItemsForReview
);
// =----------------------------------------------đây
router.post("/contact", ContactController.create);

// Lấy danh sách tất cả phản hồi (dành cho admin)
router.get("/admin/contact", ContactController.getAll);
router.get("/admin/contact/:id", ContactController.getOne);

// Trả lời phản hồi (admin cập nhật reply)
router.post('/admin/contact/reply/:id', ContactController.reply);

// --- ADMIN ROUTES CHO QUẢN LÝ ĐÁNH GIÁ ---
// Prefix /admin/reviews
const adminReviewRouter = express.Router();

// Sử dụng middleware cho tất cả các route trong group này
adminReviewRouter.use(authenticateToken, isAdmin);

adminReviewRouter.get("/", AdminReviewController.getAllReviews); // GET /api/admin/reviews
adminReviewRouter.get("/:reviewId", AdminReviewController.getReviewDetails); // GET /api/admin/reviews/123
adminReviewRouter.patch(
  "/:reviewId/status",
  AdminReviewController.updateReviewStatus
); // PATCH /api/admin/reviews/123/status
adminReviewRouter.delete("/:reviewId", AdminReviewController.deleteReview); // DELETE /api/admin/reviews/123

// Gắn router con vào router chính
router.use("/admin/reviews", adminReviewRouter);

// --- MÃ GIẢM GIÁ ADMIN ---
router.get("/discounts", DiscountController.getAll);
router.get("/discounts/:id", DiscountController.detail);
router.post("/discounts", DiscountController.create);
router.put("/discounts/:id", DiscountController.update);
router.delete("/discounts/:id", DiscountController.delete);

// Kiểm tra mã giảm giá hợp lệ
router.post("/discounts/check", DiscountController.check);
module.exports = router;
