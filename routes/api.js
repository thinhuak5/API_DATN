const express = require('express');
const router = express.Router();
const upload = require('../config/upload');
const CategoryController = require('../controllers/api/admin/categoryController');
const ProductController = require('../controllers/api/admin/productController');
const UserController = require('../controllers/api/admin/userController');
const CommentController = require('../controllers/api/admin/commentController');
const OrderController = require('../controllers/api/admin/orderController');
const CartController = require('../controllers/api/client/cartController');
const ClientCheckoutController = require('../controllers/api/client/checkoutController'); // Controller checkout mới
const {authenticateToken, requireLogin} = require('../middleware/authMiddleware');
const ClientOrderHistoryController = require('../controllers/api/client/orderHistoryController');
const {createPaymentQr, checkoutVNpay} = require('../controllers/api/client/vnpayController');
const categoryParentController = require('../controllers/api/admin/categoryparentController');
const momoController = require('../controllers/api/client/momoController');
const ClientReviewController = require('../controllers/api/client/reviewController');
const DiscountController = require('../controllers/api/admin/discountController');


const ContactController = require('../controllers/api/client/contactController');
/*const AuthController = require('../controllers/client/authController'); */

/* router.post('/register',upload.single('avatar'), AuthController.register ); */
/* -----API Admin----- */

// Danh mục admin
router.get('/categories/list', CategoryController.getAll);
router.get('/categories/by-parent/:categoryparent_id', CategoryController.getByParent);
router.get('/categories/:id', CategoryController.detail);
router.post('/categories/add', upload.single('images'), CategoryController.create); //Thêm sản danh mục có hình ảnh
router.put('/categories/:id', upload.single('images'), CategoryController.update); //Cập nhật danh mục có hình ảnh
router.delete('/categories/:id', CategoryController.delete);


router.get('/categoryparents', categoryParentController.getAll);
router.get('/categoryparents/:id', categoryParentController.detail);
router.post('/categoryparents/add', upload.single('image'), categoryParentController.create);
router.put('/categoryparents/:id', upload.single('image'), categoryParentController.update);
router.delete('/categoryparents/:id', categoryParentController.delete);

// router.post('/categories',  CategoryController.create);  // Thêm danh mục không hình ảnh
// router.put('/categories/:id',  CategoryController.update); // sửa danh mục không hình ảnh
// router.patch('/categories/:id',  CategoryController.update);

// Sản Phẩm Admin
router.get('/products/list', ProductController.getAll);
router.get('/products/:id', ProductController.detail);
router.post('/products/add', upload.array('images', 10), ProductController.create);router.put('/products/:id', upload.array('images', 10), ProductController.update);
router.delete('/products/:id', ProductController.delete);

// Sản Phẩm Admin
// router.post('/register', UserController.register);
router.post('/register', upload.single('avatar'), UserController.register);
router.post('/login', UserController.login);
router.post('/login-google', UserController.loginGoogle);
// quên mật khẩu
router.post('/forgot-password', UserController.forgotPassword);
router.post('/reset-password', UserController.resetPassword);
// Sản Phẩm Admin
// router.post('/register', UserController.register);
// router.post('/login', UserController.login);

// Lấy danh sách user
router.get('/users/list', UserController.getAll);

// Lấy thông tin user theo ID
router.get('/users/:id', UserController.detail);

// Đăng ký user kèm avatar

// Cập nhật thông tin user, hỗ trợ upload avatar nếu có
router.put('/users/:id', upload.single('avatar'),  UserController.update);

// Xóa user
router.delete('/users/:id', UserController.delete);


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
router.post('/cart/add', authenticateToken, requireLogin, CartController.addToCart);

// Lấy danh sách sản phẩm trong giỏ
router.get('/cart', authenticateToken, CartController.getCart);

// Cập nhật số lượng của một MỤC GIỎ HÀNG cụ thể
// Frontend sẽ gửi { quantity: newQuantity } đến endpoint này
router.put('/cart/update/:cart_item_id', authenticateToken, CartController.updateCart);

// Xoá một MỤC GIỎ HÀNG cụ thể khỏi giỏ
router.delete('/cart/:cart_item_id', authenticateToken, CartController.removeFromCart);

// Xóa các MỤC GIỎ HÀNG đã chọn sau khi đặt hàng
// Frontend sẽ gửi { selectedCartItemIds: [...] } trong body
router.post('/cart/clear-selected-items', authenticateToken, CartController.clearCart);


// paymennt VNpay
router.post('/create-qr', createPaymentQr);
router.get('/check-payment-vnpay', checkoutVNpay);


// payment MoMo
router.post('/payments/momo', authenticateToken, momoController.createMomoPayment);

// Checkout - API MỚI
// Cần middleware authenticateToken để đảm bảo chỉ user đã đăng nhập mới checkout được
router.post('/orders/checkout', authenticateToken, ClientCheckoutController.createOrder);
router.get('/orders/history', authenticateToken, ClientOrderHistoryController.getOrderHistory);
router.put('/orders/:id/cancel',authenticateToken, ClientOrderHistoryController.cancelOrder);

// --- ROUTES CHO ĐÁNH GIÁ SẢN PHẨM ---
// Tạo một đánh giá mới cho sản phẩm (cần đăng nhập)
router.post('/products/:productId/reviews', authenticateToken, ClientReviewController.createReview);

// Lấy tất cả đánh giá cho một sản phẩm (công khai)
router.get('/products/:productId/reviews', ClientReviewController.getProductReviews);

router.get('/products/eligible-for-review/:productId', // URL này sẽ được nối sau prefix /api (nếu có)
    authenticateToken,
    ClientReviewController.getEligibleOrderItemsForReview
);
// =----------------------------------------------đây
router.post('/contact', ContactController.create);

// Lấy danh sách tất cả phản hồi (dành cho admin)
router.get('/admin/contact', ContactController.getAll);
router.get('/admin/contact/:id', ContactController.getOne);

// Trả lời phản hồi (admin cập nhật reply)
router.post('/admin/contact/reply/:id', ContactController.reply);

// --- ROUTES CHO MÃ GIẢM GIÁ (DISCOUNT) ---
router.get('/discounts', DiscountController.getAll);
router.get('/discounts/:id', DiscountController.detail);
router.post('/discounts', DiscountController.create);
router.put('/discounts/:id', DiscountController.update);
router.delete('/discounts/:id', DiscountController.delete);
router.post('/discounts/check', DiscountController.check);


module.exports = router;
