const User = require("../../../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const forgotPasswordRequests = new Map();
const isStrongPassword = (password) => String(password || "").length >= 6;

class UserController {
  // ========== AUTH ==========
  static async register(req, res) {
    const { username, name, email, phone, password, status, role } = req.body;
    if (!username || !name || !email || !phone || !password) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin!" });
    }
    try {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) return res.status(400).json({ message: "Email đã tồn tại!" });

      const avatarValue = (req.file && req.file.path) ? req.file.path : "default-avatar.jpg";
      const hashed = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        username,
        name,
        email,
        password: hashed,
        phone,
        avatar: avatarValue,
        status: Number(status ?? 1),          // 1: hoạt động, 0: khóa
        role: Number(role ?? 2),              // 0: Admin, 1: Nhân viên, 2: Khách hàng
      });

      return res.status(201).json({
        message: "Đăng ký thành công!",
        user: {
          id: newUser.id, username: newUser.username, name: newUser.name,
          email: newUser.email, phone: newUser.phone, avatar: newUser.avatar,
          status: newUser.status, role: newUser.role,
        },
      });
    } catch (error) {
      console.error("Lỗi server: ", error);
      return res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(400).json({ message: "Email hoặc mật khẩu không chính xác!" });

      // Chặn tài khoản đã khóa
      if (Number(user.status) !== 1) {
        return res.status(403).json({ message: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị." });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: "Email hoặc mật khẩu không chính xác!" });

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, avatar: user.avatar },
        process.env.JWT_SECRET || "thinh",
        { expiresIn: "1h" }
      );

      return res.status(200).json({
        message: "Đăng nhập thành công!",
        token,
        user: {
          id: user.id, username: user.username, email: user.email,
          avatar: user.avatar, role: user.role, status: user.status,
        }
      });
    } catch (error) {
      console.error("Lỗi server:", error);
      return res.status(500).json({ message: "Lỗi server, vui lòng thử lại!", error: error.message });
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
        idToken: tokenGoogle, audience: process.env.GOOGLE_CLIENT_ID,
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
          role: 2, // mặc định khách hàng
        });
      }

      // Chặn tài khoản đã khóa
      if (Number(user.status) !== 1) {
        return res.status(403).json({ message: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị." });
      }

      const token = jwt.sign(
        { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, avatar: user.avatar },
        process.env.JWT_SECRET || "thinh",
        { expiresIn: "1h" }
      );

      return res.status(200).json({ message: "Đăng nhập Google thành công!", user, token });
    } catch (error) {
      console.error("Lỗi đăng nhập Google:", error);
      return res.status(500).json({ message: "Lỗi máy chủ", error: error.message });
    }
  }

  // ========== USER CRUD ==========
  static async getAll(req, res) {
    try {
      const data = await User.findAll();
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ err: "Lỗi server" });
    }
  }

  static async detail(req, res) {
    try {
      const userId = req.params.id || req.params.userId || req.user?.id;
      if (!userId) return res.status(400).json({ error: "Thiếu tham số id" });

      const user = await User.findByPk(userId);
      if (!user) return res.status(404).json({ error: "Người dùng không tìm thấy" });

      return res.json(user.toJSON());
    } catch (err) {
      console.error("Lỗi khi lấy dữ liệu người dùng:", err);
      return res.status(500).json({ error: "Lỗi server" });
    }
  }

  /**
   * Update:
   * - Đường admin (/api/admin/users/:id): chỉ Admin (role 0) được sửa, KHÔNG được sửa chính mình;
   *   nếu có từ 2 Admin trở lên thì KHÔNG được sửa tài khoản Admin khác; cho phép đổi status (0/1), role (chỉ 1 hoặc 2), name/phone/avatar.
   * - Đường client (/api/users/:id): chỉ cho chủ tài khoản tự sửa name/phone/avatar; bỏ qua role/status nếu gửi lên.
   */
  static async update(req, res) {
    try {
      const isAdminArea = (req.originalUrl || "").includes("/api/admin");
      const targetId = String(req.params.id);

      if (isAdminArea) {
        // Chỉ Admin mới được sửa ở khu vực admin
        if (Number(req.user.role) !== 0) {
          return res.status(403).json({ message: "Chỉ Admin mới được phép sửa." });
        }

        // Admin không được sửa chính mình
        if (String(req.user.id) === targetId) {
          return res.status(403).json({ message: "Admin không được phép sửa chính mình trong khu vực quản trị." });
        }

        // Lấy thông tin mục tiêu để kiểm tra role
        const target = await User.findByPk(targetId);
        if (!target) {
          return res.status(404).json({ error: "Người dùng không tìm thấy" });
        }

        // Nếu có >= 2 admin thì cấm sửa tài khoản admin khác
        if (Number(target.role) === 0) {
          const adminCount = await User.count({ where: { role: 0 } });
          if (adminCount >= 2) {
            return res.status(403).json({ message: "Hiện có từ 2 tài khoản Admin. Không thể sửa tài khoản Admin khác." });
          }
        }

        // Lọc field cho phép
        const payload = {};
        if (typeof req.body.name !== "undefined") payload.name = req.body.name;
        if (typeof req.body.phone !== "undefined") payload.phone = req.body.phone;

        if (typeof req.body.status !== "undefined") {
          payload.status = Number(req.body.status) === 1 ? 1 : 0;
        }

        if (typeof req.body.role !== "undefined") {
          const nr = Number(req.body.role);
          // Chỉ được set sang 1 (Nhân viên) hoặc 2 (Khách hàng) — không cho set về 0 qua API admin
          if (![1, 2].includes(nr)) {
            return res.status(400).json({ message: "Role không hợp lệ. Chỉ được 1 (Nhân viên) hoặc 2 (Khách hàng)." });
          }
          payload.role = nr;
        }

        if (req.file && req.file.path) payload.avatar = req.file.path;

        const [updated] = await User.update(payload, { where: { id: targetId } });
        if (!updated) return res.status(404).json({ error: "Người dùng không tìm thấy" });

        return res.json({ message: "Cập nhật người dùng thành công" });
      }

      // Khu vực client: chỉ cho chính chủ cập nhật name/phone/avatar
      if (String(req.user.id) !== targetId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const payload = {
        name: req.body.name,
        phone: req.body.phone,
      };
      if (req.file && req.file.path) payload.avatar = req.file.path;

      // Bỏ qua role/status nếu có gửi kèm
      const [updated] = await User.update(payload, { where: { id: targetId } });
      if (!updated) return res.status(404).json({ error: "Người dùng không tìm thấy" });

      return res.json({ message: "Cập nhật người dùng thành công" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ err: "Lỗi server" });
    }
  }

  /**
   * Delete (khu vực admin):
   * - Chỉ Admin (role 0) được xóa
   * - Không được xóa chính mình
   * - Không được xóa tài khoản Admin khác
   */
  static async delete(req, res) {
    try {
      const isAdminArea = (req.originalUrl || "").includes("/api/admin");
      const targetId = String(req.params.id);

      if (isAdminArea) {
        if (Number(req.user.role) !== 0) {
          return res.status(403).json({ message: "Chỉ Admin mới được phép xóa." });
        }
        if (String(req.user.id) === targetId) {
          return res.status(400).json({ message: "Không thể xóa chính mình." });
        }

        // Chặn xóa tài khoản Admin khác
        const target = await User.findByPk(targetId);
        if (!target) {
          return res.status(404).json({ message: "Người dùng không tìm thấy" });
        }
        if (Number(target.role) === 0) {
          return res.status(403).json({ message: "Không thể xóa tài khoản Admin." });
        }
      }

      await User.destroy({ where: { id: targetId } });
      res.json({ message: "Xóa người dùng thành công" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ err: "Lỗi server" });
    }
  }

  // ========== FORGOT/RESET PASSWORD ==========
  static async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const clientIP = req.ip;

      const now = Date.now();
      const userRequests = forgotPasswordRequests.get(clientIP) || [];
      const recent = userRequests.filter(t => now - t < 3600000);
      if (recent.length >= 3) {
        return res.status(429).json({ message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ." });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(200).json({ message: "Email không tồn tại trong hệ thống!" });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000);
      await user.update({ resetToken, resetTokenExpiry });

      recent.push(now);
      forgotPasswordRequests.set(clientIP, recent);

      const resetUrl = `${process.env.FRONTEND_URL}/forgot-password/change?token=${resetToken}`;
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Đặt lại mật khẩu',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Yêu cầu đặt lại mật khẩu</h1>
            <p>Xin chào ${user.name},</p>
            <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào nút bên dưới để đặt lại mật khẩu:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Đặt lại mật khẩu
              </a>
            </div>
            <p>Hoặc copy link sau vào trình duyệt:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p><strong>Lưu ý:</strong> Link này sẽ hết hạn sau 1 giờ.</p>
            <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">Email này được gửi tự động, vui lòng không trả lời.</p>
          </div>
        `
      });

      res.status(200).json({ message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email của bạn." });
    } catch (error) {
      console.error("Lỗi khi gửi email đặt lại mật khẩu:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi gửi email đặt lại mật khẩu. Vui lòng thử lại sau." });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      if (!isStrongPassword(password)) {
        return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
      }

      const user = await User.findOne({ where: { resetToken: token } });
      if (!user) {
        return res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await user.update({ password: hashedPassword, resetToken: null, resetTokenExpiry: null });

      res.status(200).json({ message: "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới." });
    } catch (error) {
      console.error("Lỗi khi đặt lại mật khẩu:", error);
      res.status(500).json({ message: "Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại sau." });
    }
  }
}

module.exports = UserController;
