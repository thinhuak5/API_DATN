// index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");

const app = express();

/* ========== DB & Models (giữ nguyên) ========== */
const database = require("./models/database");
const Category = require("./models/category");
const Product = require("./models/product");

const models = { Category, Product };
Object.values(models).forEach((model) => {
  if (model.associate) model.associate(models);
});

/* ========== Middlewares chung ========== */
app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS",
    allowedHeaders: "Content-Type, Authorization",
    credentials: false,
  })
);

// Tăng limit để nhận JSON lớn nếu cần
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

/* ========== Static & Uploads ========== */
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, "uploads/");
  },
  filename: function (_req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (_req, file, cb) {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Chỉ cho phép tải lên hình ảnh!"), false);
  },
});
// `upload` hiện chưa dùng trực tiếp ở index.js nhưng để sẵn cho router khác dùng.

app.set("view engine", "ejs");
app.set("views", "./views");
app.use("/uploads", express.static("uploads"));
app.use(express.static("public"));

/* ========== Routes ========== */
const apiRoute = require("./routes/api");
app.use("/api", apiRoute);

// (Optional) endpoint kiểm tra sống
app.get("/health", (_req, res) => res.json({ ok: true }));

/* ========== 404 JSON cho API ========== */
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "API không tồn tại." });
  }
  return next();
});

/* ========== Multer error handler (nếu có upload) ========== */
app.use((err, _req, res, next) => {
  // Nếu không phải lỗi Multer → chuyển xuống handler chung
  if (!(err instanceof multer.MulterError) && err.message !== "Chỉ cho phép tải lên hình ảnh!") {
    return next(err);
  }
  // Lỗi Multer → luôn trả JSON
  const status = err.status || 400;
  return res.status(status).json({
    success: false,
    message: "Lỗi upload file",
    code: err.code || "UPLOAD_ERROR",
    detail: err.message,
  });
});

/* ========== Global error handler (luôn trả JSON, không HTML) ========== */
app.use((err, _req, res, _next) => {
  // Log để debug server
  console.error("GLOBAL ERROR:", err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Lỗi máy chủ";
  // Không để Express render HTML mặc định nữa
  return res.status(status).json({
    success: false,
    message,
  });
});

/* ========== Start server ========== */
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`API đang chạy tại http://localhost:${PORT}`);
});
