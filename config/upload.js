const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
        // thư mục upload, tự tạo trước khi code
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
        // date.now thời gian hiện tại
        //file.originalname tên file đã upload
    }
})

const upload = multer({storage: storage});
module.exports = upload;