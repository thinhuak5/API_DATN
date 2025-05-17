const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

const checkJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Authorization header không hợp lệ:', authHeader);
        return res.status(401).json({message: 'Token không hợp lệ!'});
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token hợp lệ:', decoded);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Lỗi khi giải mã token:', error);
        return res.status(401).json({message: 'Token không hợp lệ!'});
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 1) {
        return res.status(403).json({message: "Bạn không có quyền !"});
    }
    next();
};

module.exports = {checkJWT, isAdmin};