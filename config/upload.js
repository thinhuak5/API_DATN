// config/upload.js
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

/** Bật Cloudinary khi đủ ENV */
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

/** Chuẩn hoá URL public cho file đã upload */
const attachPublicUrls = (req, _res, next) => {
  // base ưu tiên ENV, nếu có đuôi /uploads thì cắt bỏ
  const rawBase =
    process.env.FILE_BASE_URL || `${req.protocol}://${req.get("host")}`;
  const base = rawBase.replace(/\/+$/, "").replace(/\/uploads\/?$/, "");

  const normalizeOne = (f) => {
    if (!f) return;
    // Nếu là Cloudinary => có secure_url/url
    if (f.secure_url || f.url) {
      f.path = f.secure_url || f.url;
      return;
    }
    // Multer disk: filename luôn là "timestamp-name.ext"
    let filename = f.filename || f.originalname || path.basename(f.path || "");
    // đề phòng lỡ chứa "uploads/xxx"
    filename = filename.replace(/^uploads[\\/]/i, "");
    f.path = `${base}/uploads/${filename}`;
  };

  if (req.file) normalizeOne(req.file);
  if (Array.isArray(req.files)) req.files.forEach(normalizeOne);
  next();
};

let upload;

/** Storage chọn theo ENV */
if (CLOUDINARY_ENABLED) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: async (_req, file) => ({
      folder: process.env.CLOUDINARY_FOLDER || "uploads",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
      transformation: [{ width: 1600, height: 1600, crop: "limit" }],
      public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`,
    }),
  });
  upload = multer({ storage });
} else {
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) =>
      cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`),
  });

  const fileFilter = (_req, file, cb) => {
    if (file.mimetype?.startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ cho phép tải lên hình ảnh!"), false);
  };

  upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });
}

module.exports = upload;
module.exports.attachPublicUrls = attachPublicUrls;
module.exports.CLOUDINARY_ENABLED = CLOUDINARY_ENABLED;
module.exports.cloudinary = cloudinary;
