const User = require("../../../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { Op } = require('sequelize');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const forgotPasswordRequests = new Map();

const isStrongPassword = (password) => {
    const minLength = 6;
    return password.length >= minLength
};

class UserController {
  // Đăng ký người dùng
  static async register(req, res) {
    const { username, name, email, phone, password, avatar, status, role } =
      req.body;

    // Kiểm tra các trường bắt buộc
    if (!username || !name || !email || !phone || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin!" });
    }

    console.log("Trường đăng ký:", { username, name, email, phone });

    try {
      console.log("Đang kiểm tra email có tồn tại không...");
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: "Email đã tồn tại!" });
      }

      console.log("Mã hóa mật khẩu...");
      /*           console.log("Mật khẩu mã hóa thành công:", hashedPassword); */

      // Nếu không có avatar, sử dụng avatar mặc định
      const avatarValue = req.file ? req.file.filename : "default-avatar.jpg";

      // Nếu status hoặc role không có, sử dụng giá trị mặc định
      const newUser = await User.create({
        username,
        name,
        email,
        password: password,
        phone,
        avatar: avatarValue, // Dùng avatarValue thay vì avatar
        status: status || 1, // Status mặc định là 1 (kích hoạt)
        role: role || 2, // Role mặc định là 2 (người dùng bình thường)
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
          role: newUser.role,
        },
      });
    } catch (error) {
      console.error("Lỗi server: ", error);
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  }

  // Đăng nhập người dùng
  static async login(req, res) {
    try {
      const { email, password } = req.body;
      console.log(req.body);

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res
          .status(400)
          .json({ message: "Email hoặc mật khẩu không chính xác!" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ message: "Email hoặc mật khẩu không chính xác!" });
      }

      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET || "thinh",
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        message: "Đăng nhập thành công!",
        token,
      });
    } catch (error) {
      console.error("Lỗi server:", error);
      return res
        .status(500)
        .json({
          message: "Lỗi server, vui lòng thử lại!",
          error: error.message,
        });
    }
  }

  static async getAll(req, res) {
    try {
      const data = await User.findAll();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ err: "Lỗi server" });
    }
  }

  // Lấy thông tin chi tiết người dùng
  static async detail(req, res) {
    try {
      const userId = req.params.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return res.status(404).json({ error: "Người dùng không tìm thấy" });
      }
      console.log(user);

      // Gửi phản hồi JSON đúng cách
      res.json(user.toJSON());
    } catch (err) {
      console.error("Lỗi khi lấy dữ liệu người dùng:", err);
      res.status(500).json({ error: "Lỗi server" });
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
        where: { id: req.params.id },
      });

      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ err: "Lỗi server" });
    }
  }

  // Xóa người dùng
  static async delete(req, res) {
    try {
      const user = await User.destroy({
        where: { id: req.params.id },
      });

      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ err: "Lỗi server" });
    }
  }

  static async loginGoogle(req, res) {
    try {
      const { tokenGoogle } = req.body;

      if (!tokenGoogle || typeof tokenGoogle !== "string") {
        return res.status(400).json({ message: "Token không hợp lệ" });
      }

      const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

      const ticket = await client.verifyIdToken({
        idToken: tokenGoogle,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const dataUser = ticket.getPayload();
      if (!dataUser || !dataUser.email) {
        return res.status(400).json({ message: "Token không chứa thông tin email" });
      }
      let user = await User.findOne({ where: { email: dataUser.email } });
      if (!user) {
        user = await User.create({
          username: dataUser.email.split('@')[0],
          name: dataUser.name || "Người dùng Google",
          email: dataUser.email,
          password: "google_auth",
          avatar: dataUser.picture || "default-avatar.jpg",
          status: 1,
          role: 2,
        });
      }
      // Thêm trường picture vào token để frontend lấy avatar
      const token = jwt.sign({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.avatar, // Thêm dòng này
      }, process.env.JWT_SECRET || "thinh", { expiresIn: "1h" });

      return res.status(200).json({
        message: "Đăng nhập Google thành công!",
        user,
        token,
      });

    } catch (error) {
      console.error("Lỗi đăng nhập Google:", error);
      return res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
  }

  // Forgot Password
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const clientIP = req.ip;

      // Check rate limiting
      const now = Date.now();
      const userRequests = forgotPasswordRequests.get(clientIP) || [];
      const recentRequests = userRequests.filter(time => now - time < 3600000); // Last hour

      if (recentRequests.length >= 3) {
        return res.status(429).json({ 
          message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ." 
        });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(200).json({ 
          message: "Email không tồn tại trong hệ thống!" 
        });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); 

      await user.update({
        resetToken,
        resetTokenExpiry
      });


      recentRequests.push(now);
      forgotPasswordRequests.set(clientIP, recentRequests);

      const resetUrl = `${process.env.FRONTEND_URL}/forgot-password/change?token=${resetToken}`;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Đặt lại mật khẩu',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Yêu cầu đặt lại mật khẩu</h1>
            <p>Xin chào ${user.name},</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #007bff; color: white; padding: 12px 24px; 
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Đặt lại mật khẩu
              </a>
            </div>
            <p>Hoặc copy link sau vào trình duyệt:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 1 giờ.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Email này được gửi tự động, vui lòng không trả lời.
            </p>
          </div>
        `
      };

      // Send email
      await transporter.sendMail(mailOptions);

      res.status(200).json({ 
        message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email của bạn." 
      });
    } catch (error) {
      console.error("Lỗi khi gửi email đặt lại mật khẩu:", error);
      res.status(500).json({ 
        message: "Có lỗi xảy ra khi gửi email đặt lại mật khẩu. Vui lòng thử lại sau." 
      });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      if (!isStrongPassword(password)) {
        return res.status(400).json({
          message: "Mật khẩu phải có ít nhất 6 ký tự"
        });
      }

      const user = await User.findOne({
        where: {
          resetToken: token,
          resetTokenExpiry: { [Op.gt]: new Date() }
        }
      });

      if (!user) {
        return res.status(400).json({ 
          message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới." 
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await user.update({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null
      });

      res.status(200).json({ 
        message: "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới." 
      });
    } catch (error) {
      console.error("Lỗi khi đặt lại mật khẩu:", error);
      res.status(500).json({ 
        message: "Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại sau." 
      });
    }
  }
}

module.exports = UserController;
