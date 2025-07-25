


const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: 'dpcybmljb',      
    api_key: '922923592596195',           
    api_secret: 'Q16PLsqe2uaHtegpBRZL3iIpCqM'      
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads', 
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
    }
});

const upload = multer({ storage: storage });
module.exports = upload;