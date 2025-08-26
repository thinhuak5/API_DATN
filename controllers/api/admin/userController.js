const User = require("../../../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

const forgotPasswordRequests = new Map();
const isStrongPassword = (password) => String(password || "").length >= 6;

class UserController {
  // ========== AUTH ==========
  static async register(req, res) {
    const {username, name, email, password, status, role} = req.body;
    if (!username || !name || !email || !password) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin!" });
    }
    try {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) return res.status(400).json({ message: "Email đã tồn tại!" });
      const hashed = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        username,
        name,
        email,
        password: hashed,
        status: Number(status ?? 1),          // 1: hoạt động, 0: khóa
        role: Number(role ?? 2),              // 0: Admin, 1: Nhân viên, 2: Khách hàng
      });

      return res.status(201).json({
        message: "Đăng ký thành công!",
        user: {
          id: newUser.id, username: newUser.username, name: newUser.name,
          email: newUser.email,
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
        },
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
          username: dataUser.email.split("@")[0],
          name: dataUser.name || "Người dùng Google",
          email: dataUser.email,
          password: "google_auth",
          avatar: dataUser.picture || "default-avatar.jpg",
          status: 1,
          role: 2,
        });
      }

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

  static async update(req, res) {
    try {
      const isAdminArea = (req.originalUrl || "").includes("/api/admin");
      const targetId = String(req.params.id);

      if (isAdminArea) {
        if (Number(req.user.role) !== 0) {
          return res.status(403).json({ message: "Chỉ Admin mới được phép sửa." });
        }
        if (String(req.user.id) === targetId) {
          return res.status(403).json({ message: "Admin không được phép sửa chính mình trong khu vực quản trị." });
        }

        const target = await User.findByPk(targetId);
        if (!target) return res.status(404).json({ error: "Người dùng không tìm thấy" });

        if (Number(target.role) === 0) {
          const adminCount = await User.count({ where: { role: 0 } });
          if (adminCount >= 2) {
            return res.status(403).json({ message: "Hiện có từ 2 tài khoản Admin. Không thể sửa tài khoản Admin khác." });
          }
        }

        const payload = {};
        if (typeof req.body.name !== "undefined") payload.name = req.body.name;
        if (typeof req.body.phone !== "undefined") payload.phone = req.body.phone;
        if (typeof req.body.status !== "undefined") payload.status = Number(req.body.status) === 1 ? 1 : 0;

        if (typeof req.body.role !== "undefined") {
          const nr = Number(req.body.role);
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

      if (String(req.user.id) !== targetId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const payload = { name: req.body.name, phone: req.body.phone };
      if (req.file && req.file.path) payload.avatar = req.file.path;

      const [updated] = await User.update(payload, { where: { id: targetId } });
      if (!updated) return res.status(404).json({ error: "Người dùng không tìm thấy" });

      return res.json({ message: "Cập nhật người dùng thành công" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ err: "Lỗi server" });
    }
  }

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

        const target = await User.findByPk(targetId);
        if (!target) return res.status(404).json({ message: "Người dùng không tìm thấy" });
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
      const { email, scope } = req.body; // scope: "admin" | undefined
      const clientIP = req.ip;

      // Rate limit 3 lần / 1 giờ theo IP
      const now = Date.now();
      const userRequests = forgotPasswordRequests.get(clientIP) || [];
      const recent = userRequests.filter((t) => now - t < 3600000);
      if (recent.length >= 3) {
        return res.status(429).json({ message: "Quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ." });
      }

      const normEmail = String(email || "").trim().toLowerCase();
      if (!normEmail) {
        return res.status(400).json({ message: "Email không được để trống." });
      }

      const user = await User.findOne({ where: { email: normEmail } });

      const safeOk = async () => {
        recent.push(now);
        forgotPasswordRequests.set(clientIP, recent);
        return res.status(200).json({
          message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email của bạn.",
        });
      };

      if (!user) return safeOk();

      // Tạo token + thời hạn 1 giờ
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000);
      await user.update({ resetToken, resetTokenExpiry });

      // Xác định scope admin/client
      const isAdminEndpoint = (req.originalUrl || "").includes("/api/admin/forgot-password");
      const bodyScope = String(scope || "").toLowerCase();
      const isAdminScope = isAdminEndpoint || bodyScope === "admin";

      // Base URL
      const originHeader = req.get("origin") || "";
      let refererOrigin = "";
      try {
        const ref = req.get("referer");
        if (ref) refererOrigin = new URL(ref).origin;
      } catch {}

      const fallbackOrigin = originHeader || refererOrigin || `${req.protocol}://${req.get("host")}`;
      const baseUrl = isAdminScope
        ? (process.env.ADMIN_FRONTEND_URL || process.env.FRONTEND_URL || fallbackOrigin)
        : (process.env.FRONTEND_URL || fallbackOrigin);

      const trimmedBase = String(baseUrl || "").replace(/\/+$/, "");
      const path = isAdminScope ? "/admin/forgot-password/change" : "/forgot-password/change";
      const resetUrl = `${trimmedBase}${path}?token=${resetToken}`;

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: normEmail,
        subject: "Đặt lại mật khẩu",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Yêu cầu đặt lại mật khẩu</h1>
            <p>Xin chào ${user.name || user.username || "bạn"},</p>
            <p>Nhấn nút dưới đây để đặt lại mật khẩu:</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${resetUrl}" style="background:#007bff;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block">
                Đặt lại mật khẩu
              </a>
            </div>
            <p>Hoặc copy link: <br/><span style="word-break:break-all;">${resetUrl}</span></p>
            <p><strong>Lưu ý:</strong> Link hết hạn sau 1 giờ.</p>
          </div>
        `,
      });

      return safeOk();
    } catch (error) {
      console.error("Lỗi khi gửi email đặt lại mật khẩu:", error);
      return res.status(500).json({ message: "Có lỗi xảy ra khi gửi email đặt lại mật khẩu. Vui lòng thử lại sau." });
    }
  }

  static async resetPassword(req, res) {
    try {
      const { token, password } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Thiếu token đặt lại mật khẩu." });
      }
      if (!isStrongPassword(password)) {
        return res.status(400).json({ message: "Mật khẩu phải có ít nhất 6 ký tự" });
      }

      const user = await User.findOne({ where: { resetToken: token } });
      if (!user) {
        return res
          .status(400)
          .json({ message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới." });
      }

      // Kiểm tra hết hạn (nếu có)
      if (user.resetTokenExpiry) {
        let exp = new Date(user.resetTokenExpiry);
        const raw = String(user.resetTokenExpiry);
        // Nếu DB trả về dạng 'YYYY-MM-DD' (không giờ), cho tới hết ngày đó
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) exp = new Date(raw + "T23:59:59.999Z");
        if (exp.getTime() < Date.now()) {
          await user.update({ resetToken: null, resetTokenExpiry: null });
          return res
            .status(400)
            .json({ message: "Token không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới." });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await user.update({
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      });

      return res
        .status(200)
        .json({ message: "Mật khẩu đã được đặt lại thành công. Vui lòng đăng nhập với mật khẩu mới." });
    } catch (error) {
      console.error("Lỗi khi đặt lại mật khẩu:", error);
      return res
        .status(500)
        .json({ message: "Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại sau." });
    }
  }
}

module.exports = UserController;
