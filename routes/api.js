// routes/api.js
const express = require("express");
const router = express.Router();
const upload = require("../config/upload");

const CategoryController = require("../controllers/api/admin/categoryController");
const ProductController = require("../controllers/api/admin/productController");
const UserController = require("../controllers/api/admin/userController");
const OrderController = require("../controllers/api/admin/orderController");
// THÊM/SỬA CHO ĐÚNG:
const AdminReviewController = require("../controllers/api/admin/reviewAdminController");

const CartController = require("../controllers/api/client/cartController");
const AddressController = require("../controllers/api/client/addressController");
const ClientCheckoutController = require("../controllers/api/client/checkoutController");
const ClientOrderHistoryController = require("../controllers/api/client/orderHistoryController");
const ClientReviewController = require("../controllers/api/client/reviewController");
const ContactController = require("../controllers/api/client/contactController");

const DiscountController = require("../controllers/api/admin/discountController");
const statisticsController = require("../controllers/api/admin/statisticsController");
const { createPaymentQr, checkoutVNpay } = require("../controllers/api/client/vnpayController");
const momoController = require("../controllers/api/client/momoController");

const { authenticateToken, requireLogin, isAdmin } = require("../middleware/authMiddleware");

// ===================== PUBLIC / CLIENT APIs =====================

// Products (client)
router.get("/products/list", ProductController.getAll);
router.get("/products/:id", ProductController.detail);

// Reviews (public)
router.get("/variationId/:variationId/reviews", ClientReviewController.getProductReviews);
router.get("/products/eligible-for-review/:productId", authenticateToken, ClientReviewController.checkEligibleForReview);
router.get("/variation/:variationId/eligible-for-review", authenticateToken, ClientReviewController.getEligibleOrderItemsForReview);

// Categories PUBLIC
// routes/api.js (chỉ phần Categories PUBLIC & Home)
router.get("/public/categories", CategoryController.getAllPublic);
router.get("/public/categories/by-parent/:parent_id", CategoryController.getByParentPublic);
router.get("/public/categories/parents", CategoryController.getAllParentsPublic);
router.get("/public/categories/:id", CategoryController.detailPublic);

// NEW: các section hiển thị ở Trang chủ
router.get("/public/home/sections", CategoryController.getHomeSections);


// Auth
router.post("/register", upload.single("avatar"), UserController.register);
router.post("/login", UserController.login);
router.post("/login-google", UserController.loginGoogle);
router.post("/forgot-password", UserController.forgotPassword);
router.post("/reset-password", UserController.resetPassword);

// Contact
router.post("/contact", ContactController.create);

// Cart / Checkout / Orders
router.post("/cart/add", authenticateToken, requireLogin, CartController.addToCart);
router.get("/cart", authenticateToken, CartController.getCart);
router.put("/cart/update/:cart_item_id", authenticateToken, CartController.updateCart);
router.delete("/cart/:cart_item_id", authenticateToken, CartController.removeFromCart);
router.post("/cart/clear-selected-items", authenticateToken, CartController.clearCart);

router.post("/orders/checkout", authenticateToken, ClientCheckoutController.createOrder);
router.get("/orders/history", authenticateToken, ClientOrderHistoryController.getOrderHistory);
router.put("/orders/:id/cancel", authenticateToken, ClientOrderHistoryController.cancelOrder);

// Reviews (CẦN LOGIN)
router.post("/variationId/:variationId/reviews", authenticateToken, upload.array("images", 5), ClientReviewController.createReview);
router.put("/reviews/:reviewId", authenticateToken, upload.array("images", 5), ClientReviewController.updateReview);
router.delete("/reviews/:reviewId", authenticateToken, ClientReviewController.deleteReview);

// === Address + User (client) ===
// Chỉ xem/chỉnh SỐNG cho CHÍNH CHỦ ở nhánh client.
// (Admin có route Riêng ở /api/admin/users/* để quản trị người dùng)
router.get("/users/:id", authenticateToken, (req, res, next) => {
  if (String(req.params.id) !== String(req.user.id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  return UserController.detail(req, res, next);
});

router.put("/users/:id", authenticateToken, upload.single("avatar"), (req, res, next) => {
  if (String(req.params.id) !== String(req.user.id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  // Controller sẽ hiểu đây là nhánh client (không /api/admin) và chỉ cho sửa name/phone/avatar
  return UserController.update(req, res, next);
});

router.get("/users/:id/addresses", authenticateToken, AddressController.getMyAddresses);
router.post("/users/:id/addresses", authenticateToken, AddressController.createAddress);
router.put("/users/:id/addresses/:id", authenticateToken, AddressController.updateAddress);
router.delete("/users/:id/addresses/:id", authenticateToken, AddressController.deleteAddress);
router.patch("/users/:id/addresses/:id/default", authenticateToken, AddressController.setDefaultAddress);
router.put("/users/:id/addresses-bulk", authenticateToken, AddressController.replaceAllAddresses);

// Payment
router.post("/create-qr", createPaymentQr);
router.get("/check-payment-vnpay", checkoutVNpay);
router.get("/vnpay-return", checkoutVNpay);
router.post("/vnpay-success", authenticateToken, CartController.deletePaidCartItems);
router.post("/payments/momo", authenticateToken, momoController.createMomoPayment);

// Discount (client check)
router.post("/discounts/check", DiscountController.check);

// ===================== ADMIN =====================
router.use("/admin", authenticateToken, isAdmin);

// Statistics
router.get("/admin/statistics", statisticsController.getStatistics);
router.get("/admin/statistics/revenue", statisticsController.getRevenueStatistics);

// Categories (admin)
router.get("/admin/categories/list", CategoryController.getAll);
router.get("/admin/categories/parents", CategoryController.getAllParents);
router.get("/admin/categories/by-parent/:parent_id", CategoryController.getByParent);
router.get("/admin/categories/:id", CategoryController.detail);
router.post("/admin/categories/add", upload.single("images"), CategoryController.create);
router.put("/admin/categories/:id", upload.single("images"), CategoryController.update);
router.delete("/admin/categories/:id", CategoryController.delete);

// Products (admin)
router.get("/admin/products/list", ProductController.getAll);
router.get("/admin/products/:id", ProductController.detail);
router.post("/admin/products/add", upload.array("images"), ProductController.create);
router.put("/admin/products/:id", upload.array("images"), ProductController.update);
router.delete("/admin/products/:id", ProductController.delete);

// Users (admin) — role 0 mới có quyền sửa/xóa (đã kiểm trong controller)
router.get("/admin/users/list", UserController.getAll);
router.get("/admin/users/:id", UserController.detail);
router.put("/admin/users/:id", upload.single("avatar"), UserController.update);
router.delete("/admin/users/:id", UserController.delete);

// Orders (admin)
router.get("/admin/orders", OrderController.getAll);
router.get("/admin/orders/:id", OrderController.detail);
router.put("/admin/orders/:id", OrderController.update);
router.post("/admin/orders", OrderController.create);
router.delete("/admin/orders/:id", OrderController.delete);

// Contact (admin)
router.get("/admin/contact", ContactController.getAll);
router.get("/admin/contact/:id", ContactController.getOne);
router.post("/admin/contact/reply/:id", ContactController.reply);

// Reviews (admin)
const adminReviewRouter = express.Router();
adminReviewRouter.get("/", AdminReviewController.getAllReviews);
adminReviewRouter.get("/:reviewId", AdminReviewController.getReviewDetails);
adminReviewRouter.patch("/:reviewId/status", AdminReviewController.updateReviewStatus);
adminReviewRouter.delete("/:reviewId", AdminReviewController.deleteReview);
router.use("/admin/reviews", adminReviewRouter);

// Discounts (admin)
router.get("/admin/discounts", DiscountController.getAll);
router.get("/admin/discounts/:id", DiscountController.detail);
router.post("/admin/discounts", DiscountController.create);
router.put("/admin/discounts/:id", DiscountController.update);
router.delete("/admin/discounts/:id", DiscountController.delete);

module.exports = router;
