const jwt = require('jsonwebtoken');
const User = require('../models/user');
const JWT_SECRET = process.env.JWT_SECRET || 'thinh';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc thiếu "Bearer "' });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findByPk(decoded.userId || decoded.id);
    if (!user) {
      return res.status(403).json({ message: 'User không tồn tại' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

// Cho phép role 0 và 1 vào khu vực admin
const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Chưa xác thực' });
  if (Number(req.user.role) === 0 || Number(req.user.role) === 1) return next();
  return res.status(403).json({ message: 'Truy cập bị từ chối. Yêu cầu quyền Admin.' });
};

// Chỉ Super Admin (role 0)
const isSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Chưa xác thực' });
  if (Number(req.user.role) === 0) return next();
  return res.status(403).json({ message: 'Forbidden: Admin only' });
};

const requireLogin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Bạn cần đăng nhập để tiếp tục.' });
  }
  next();
};

module.exports = { authenticateToken, isAdmin, isSuperAdmin, requireLogin };
