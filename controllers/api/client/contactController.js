// controllers/api/client/contactController.js
const nodemailer = require('nodemailer');
const ContactMessage = require('../../../models/contactMessage');

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");

// Lấy cấu hình SMTP từ ENV (hỗ trợ cả SMTP_* và EMAIL_*)
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER;
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS;

// Tạo transporter (Gmail + App Password)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // dùng 465 -> secure true
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

const contactController = {
  // PUBLIC: tạo liên hệ
  create: async (req, res) => {
    try {
      const { name, email, message } = req.body || {};
      if (!name?.trim() || !email?.trim() || !message?.trim()) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
      }
      if (!isEmail(email)) {
        return res.status(400).json({ success: false, message: "Email không hợp lệ" });
      }
      if (message.length > 5000) {
        return res.status(400).json({ success: false, message: "Nội dung quá dài (<= 5000 ký tự)" });
      }

      const newMessage = await ContactMessage.create({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        replied: false,
        replyContent: null,
      });

      // Tuỳ chọn: gửi thông báo vào hộp thư CSKH (không làm fail API nếu lỗi)
      if (SMTP_USER && SMTP_PASS) {
        transporter.sendMail({
          from: `"Contact Bot" <${SMTP_USER}>`,
          to: SMTP_USER,
          subject: `New contact from ${name}`,
          html: `
            <h3>New contact</h3>
            <p><b>Name:</b> ${name}</p>
            <p><b>Email:</b> ${email}</p>
            <pre style="white-space:pre-wrap">${message}</pre>
          `,
        }).catch(e => console.error("Notify mail failed:", e?.message || e));
      }

      return res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
      console.error('Lỗi khi gửi liên hệ:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  },

  // ADMIN: danh sách (timestamps:false -> sắp theo id)
  getAll: async (_req, res) => {
    try {
      const messages = await ContactMessage.findAll({ order: [['id', 'DESC']] });
      return res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách liên hệ:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  },

  // ADMIN: chi tiết
  getOne: async (req, res) => {
    try {
      const { id } = req.params;
      const message = await ContactMessage.findByPk(id);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi' });
      }
      return res.json({ success: true, data: message });
    } catch (error) {
      console.error('Lỗi khi lấy phản hồi:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  },

  // ADMIN: trả lời + gửi email
  reply: async (req, res) => {
    try {
      const { id } = req.params;
      const { replyContent, subject } = req.body || {};

      if (!replyContent?.trim()) {
        return res.status(400).json({ success: false, message: 'Thiếu nội dung phản hồi' });
      }

      if (!SMTP_USER || !SMTP_PASS) {
        console.error('SMTP ENV missing:', { SMTP_USER: !!SMTP_USER, SMTP_PASS: !!SMTP_PASS });
        return res.status(500).json({ success: false, message: 'Thiếu cấu hình EMAIL_USER/EMAIL_PASS (hoặc SMTP_USER/SMTP_PASS)' });
      }

      const message = await ContactMessage.findByPk(id);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi' });
      }

      // Kiểm tra kết nối SMTP để báo lỗi cấu hình rõ ràng
      try {
        await transporter.verify();
      } catch (verr) {
        console.error('SMTP verify failed:', verr);
        return res.status(502).json({
          success: false,
          message: `Không kết nối được SMTP: ${verr?.response || verr?.message || 'unknown'}`,
        });
      }

      // Gửi email
      try {
        await transporter.sendMail({
          from: `"Hỗ trợ khách hàng" <${SMTP_USER}>`, // FROM phải trùng account
          to: message.email,
          subject: subject || 'Phản hồi từ Book Man',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;">
              <h2 style="color: #1a73e8;">📬 Phản hồi từ Book Man</h2>
              <p>Chào <strong>${message.name}</strong>,</p>
              <div style="margin: 15px 0; padding: 15px; background-color: #f1f1f1; border-left: 4px solid #1a73e8;">
                ${replyContent}
              </div>
              <p>Nếu bạn có bất kỳ câu hỏi nào khác, vui lòng phản hồi email này.</p>
              <br />
              <p style="font-style: italic;">Trân trọng,</p>
              <p><strong>Đội ngũ hỗ trợ Book Man</strong></p>
              <hr style="margin: 30px 0;">
              <p style="font-size: 12px; color: #888;">
                📧 Email này được gửi từ hệ thống phản hồi tự động của website Book Man.
              </p>
            </div>
          `,
        });
      } catch (mailErr) {
        console.error('Mailer error:', mailErr);
        return res.status(502).json({
          success: false,
          message: mailErr?.response || mailErr?.message || 'Gửi email thất bại (kiểm tra App Password/cấu hình SMTP)',
        });
      }

      // Cập nhật DB
      message.replyContent = replyContent;
      message.replied = true;
      await message.save();

      return res.json({ success: true, message: 'Đã gửi email phản hồi thành công!', data: message });
    } catch (error) {
      console.error('Lỗi khi gửi phản hồi:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  },
};

module.exports = contactController;
