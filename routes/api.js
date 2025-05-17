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


/*const AuthController = require('../controllers/client/authController'); */

/* router.post('/register',upload.single('avatar'), AuthController.register ); */
/* -----API Admin----- */

// Danh mục admin
router.get('/categories/list', CategoryController.getAll);
router.get('/categories/:id', CategoryController.detail);
router.post('/categories/add', CategoryController.create); //Thêm sản danh mục có hình ảnh
router.put('/categories/:id', CategoryController.update); //Cập nhật danh mục có hình ảnh
router.delete('/categories/:id', CategoryController.delete);
// router.post('/categories',  CategoryController.create);  // Thêm danh mục không hình ảnh
// router.put('/categories/:id',  CategoryController.update); // sửa danh mục không hình ảnh
// router.patch('/categories/:id',  CategoryController.update);

// Sản Phẩm Admin
router.get('/products/list', ProductController.getAll);
router.get('/products/:id', ProductController.detail);
router.post('/products/add', upload.single('images'), ProductController.create);
router.put('/products/:id', upload.single('images'), ProductController.update);
router.delete('/products/:id', ProductController.delete);

// Sản Phẩm Admin
// router.post('/register', UserController.register);
router.post('/register', upload.single('avatar'), UserController.register);
router.post('/login', UserController.login);

// Sản Phẩm Admin
// router.post('/register', UserController.register);
// router.post('/login', UserController.login);

// Lấy danh sách user
router.get('/users/list', UserController.getAll);

// Lấy thông tin user theo ID
router.get('/users/:id', UserController.detail);

// Đăng ký user kèm avatar

// Cập nhật thông tin user, hỗ trợ upload avatar nếu có
router.put('/users/:id', UserController.update);

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
// Xoá sản phẩm khỏi giỏ
router.delete('/cart/:product_id', authenticateToken, CartController.removeFromCart);
router.put('/cart/update/:product_id', authenticateToken, CartController.updateCart);

/*
router.post('/comments',CommentController.create);
router.put('/comments/:id',CommentController.update);
router.patch('/comments/:id',CommentController.update);
router.delete('/comments/:id',CommentController.delete);



// // Tai Khoan
// ---  USERS ---
router.patch('/users/:id', upload.single('avatar'), UserController.update);
 */
//

// // đơn hàng
// router.get('/oders',Category.getAll);
// router.get('/oders',Category.detail);
// router.post('/oders',Category.create);

// // giỏ hàng
// router.get('/carts',Category.getAll);
// router.get('/carts',Category.detail);
// router.post('/carts',Category.create);

// Checkout - API MỚI
// Cần middleware authenticateToken để đảm bảo chỉ user đã đăng nhập mới checkout được
router.post('/orders/checkout', authenticateToken, ClientCheckoutController.createOrder);
router.get('/orders/history', authenticateToken, ClientOrderHistoryController.getOrderHistory);

module.exports = router;
