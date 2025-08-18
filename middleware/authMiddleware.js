const jwt = require('jsonwebtoken');
const User = require('../models/user'); 
const JWT_SECRET = process.env.JWT_SECRET || 'thinh'; 

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    console.log(JWT_SECRET);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn("Thiếu hoặc sai định dạng token trong header");
        return res.status(401).json({message: 'Token không hợp lệ hoặc thiếu "Bearer "'});
    }

    const token = authHeader.split(" ")[1]; // Lấy phần sau "Bearer"

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findByPk(decoded.userId || decoded.id);
        if (!user) {
            console.warn("Token hợp lệ nhưng không tìm thấy user:", decoded);
            return res.status(403).json({message: 'User không tồn tại'});
        }

        req.user = user;
        next();
    } catch (err) {
        console.error("Lỗi xác thực token:", err.message);
        return res.status(403).json({message: 'Token không hợp lệ hoặc đã hết hạn'});
    }
};


// Middleware kiểm tra quyền Admin (ví dụ)
// Cho phép role 0 và 1
const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Chưa xác thực' });
  // 0: superadmin, 1: admin
  if (req.user.role === 0 || req.user.role === 1) return next();
  return res.status(403).json({ message: 'Truy cập bị từ chối. Yêu cầu quyền Admin.' });
};

const requireLogin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({message: 'Bạn cần đăng nhập để tiếp tục.'});
    }
    next();
};


module.exports = {authenticateToken, isAdmin, requireLogin};