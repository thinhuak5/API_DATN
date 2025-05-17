const User = require('../../../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class UserController {

    // Đăng ký người dùng
    static async register(req, res) {
        const {username, name, email, phone, password, avatar, status, role} = req.body;

        // Kiểm tra các trường bắt buộc
        if (!username || !name || !email || !phone || !password) {
            return res.status(400).json({message: "Vui lòng điền đầy đủ thông tin!"});
        }

        console.log("Trường đăng ký:", {username, name, email, phone});

        try {
            console.log("Đang kiểm tra email có tồn tại không...");
            const existingUser = await User.findOne({where: {email}});
            if (existingUser) {
                return res.status(400).json({message: 'Email đã tồn tại!'});
            }

            console.log("Mã hóa mật khẩu...");
            /*           console.log("Mật khẩu mã hóa thành công:", hashedPassword); */

            // Nếu không có avatar, sử dụng avatar mặc định
            const avatarValue = avatar || 'default-avatar.jpg'; // Đặt ảnh mặc định

            // Nếu status hoặc role không có, sử dụng giá trị mặc định
            const newUser = await User.create({
                username,
                name,
                email,
                password: password,
                phone,
                avatar: avatarValue,  // Dùng avatarValue thay vì avatar
                status: status || 1,   // Status mặc định là 1 (kích hoạt)
                role: role || 2        // Role mặc định là 2 (người dùng bình thường)
            });

            console.log("Đăng ký người dùng thành công", newUser);

            res.status(201).json({
                message: "Đăng ký thành công!",
                user: {
                    username: newUser.username,
                    name: newUser.name,
                    email: newUser.email,
                    password: newUser.password,
                    phone: newUser.phone,
                    avatar: newUser.avatar,
                    status: newUser.status,
                    role: newUser.role
                }
            });

        } catch (error) {
            console.error("Lỗi server: ", error);
            res.status(500).json({message: "Lỗi server", error: error.message});
        }
    }

    // Đăng nhập người dùng
    static async login(req, res) {
        try {
            const {email, password} = req.body;
            console.log(req.body);

            const user = await User.findOne({where: {email}});
            if (!user) {
                return res.status(400).json({message: "Email hoặc mật khẩu không chính xác!"});
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({message: "Email hoặc mật khẩu không chính xác!"});
            }

            const token = jwt.sign({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }, process.env.JWT_SECRET || 'thinh', {expiresIn: "1h"});


            return res.status(200).json({
                message: "Đăng nhập thành công!",
                token
            });

        } catch (error) {
            console.error("Lỗi server:", error);
            return res.status(500).json({message: "Lỗi server, vui lòng thử lại!", error: error.message});
        }
    }

    static async getAll(req, res) {
        try {
            const data = await User.findAll();
            res.json(data);
        } catch (err) {
            console.error(err);
            res.status(500).json({err: "Lỗi server"});
        }
    }

// Lấy thông tin chi tiết người dùng
    static async detail(req, res) {
        try {
            const userId = req.params.id;
            const user = await User.findByPk(userId);

            if (!user) {
                return res.status(404).json({error: "Người dùng không tìm thấy"});
            }
            console.log(user);

            // Gửi phản hồi JSON đúng cách
            res.json(user);  // Đảm bảo chỉ gọi res.json một lần
        } catch (err) {
            console.error("Lỗi khi lấy dữ liệu người dùng:", err);
            res.status(500).json({error: "Lỗi server"});
        }
    }


    // Cập nhật thông tin người dùng
    static async update(req, res) {
        try {
            const data = req.body;

            if (req.file) {
                data.avatar = req.file.filename;
            }

            const user = await User.update(data, {
                where: {id: req.params.id},
            });

            res.json(user);
        } catch (err) {
            console.error(err);
            res.status(500).json({err: "Lỗi server"});
        }
    }

    // Xóa người dùng
    static async delete(req, res) {
        try {
            const user = await User.destroy({
                where: {id: req.params.id},
            });

            res.json(user);
        } catch (err) {
            console.error(err);
            res.status(500).json({err: "Lỗi server"});
        }
    }
}

module.exports = UserController;
