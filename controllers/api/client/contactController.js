const nodemailer = require('nodemailer');
const ContactMessage = require('../../../models/contactMessage');

const contactController = {
  // Gửi liên hệ từ người dùng
  create: async (req, res) => {
    try {
      const { name, email, message } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin bắt buộc" });
      }

      const newMessage = await ContactMessage.create({
        name,
        email,
        message,
        replied: false,
        replyContent: null,
      });

      res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
      console.error('Lỗi khi gửi liên hệ:', error);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  },

  // Lấy tất cả phản hồi
  getAll: async (_req, res) => {
    try {
      const messages = await ContactMessage.findAll({ order: [['createdAt', 'DESC']] });
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Lỗi khi lấy danh sách liên hệ:', error);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  },

  // Trả lời phản hồi và gửi email
  reply: async (req, res) => {
    try {
      const { id } = req.params;
      const { replyContent, subject } = req.body;

      const message = await ContactMessage.findByPk(id);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi' });
      }

      // Cấu hình Gmail
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'daynvpc08855@gmail.com',
          pass: 'gafkhxjzbnqnekxk', // Mật khẩu ứng dụng Gmail
        },
      });

      // Email HTML đẹp
      const mailOptions = {
        from: '"Hỗ trợ khách hàng" <daynvpc08855@gmail.com>',
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
              📧 Email này được gửi từ hệ thống phản hồi tự động của website Book Man. Vui lòng không trả lời trực tiếp email này.
            </p>
          </div>
        `,
      };

      // Gửi email
      await transporter.sendMail(mailOptions);

      // Cập nhật DB
      message.replyContent = replyContent;
      message.replied = true;
      await message.save();

      res.json({ success: true, message: 'Đã gửi email phản hồi thành công!', data: message });
    } catch (error) {
      console.error('Lỗi khi gửi phản hồi:', error);
      res.status(500).json({ success: false, message: 'Lỗi khi gửi email phản hồi' });
    }
  },

  // Lấy 1 phản hồi theo ID
  getOne: async (req, res) => {
    try {
      const { id } = req.params;
      const message = await ContactMessage.findByPk(id);

      if (!message) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy phản hồi' });
      }

      res.json({ success: true, data: message });
    } catch (error) {
      console.error('Lỗi khi lấy phản hồi:', error);
      res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  },
};

module.exports = contactController;
