// const multer = require('multer');
// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'uploads/');
//         // thư mục upload, tự tạo trước khi code
//     },
//     filename: function (req, file, cb) {
//         cb(null, `${Date.now()}-${file.originalname}`);
//         // date.now thời gian hiện tại
//         //file.originalname tên file đã upload
//     }
// })

// const upload = multer({storage: storage});
// module.exports = upload;


const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Cấu hình Cloudinary
cloudinary.config({
    cloud_name: 'dpcybmljb',      // Thay bằng cloud_name của bạn
    api_key: '922923592596195',            // Thay bằng api_key của bạn
    api_secret: 'Q16PLsqe2uaHtegpBRZL3iIpCqM'       // Thay bằng api_secret của bạn
});

// Cấu hình storage cho Multer sử dụng Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads', // Tên thư mục trên Cloudinary
        allowed_formats: ['jpg', 'png', 'jpeg'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    }
});

const upload = multer({ storage: storage });
module.exports = upload;