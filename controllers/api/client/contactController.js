const ContactMessage = require('../../../models/contactMessage'); // ✅ Đúng

const contactController = {
    // Gửi tin nhắn từ người dùng
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

    // Lấy danh sách tất cả tin nhắn (cho admin)
    getAll: async (req, res) => {
        try {
            const messages = await ContactMessage.findAll({
                order: [['createdAt', 'DESC']],
            });

            res.json({ success: true, data: messages });
        } catch (error) {
            console.error('Lỗi khi lấy danh sách liên hệ:', error);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
        }
    },

    // Trả lời tin nhắn
    reply: async (req, res) => {
        try {
            const { id } = req.params;
            const { replyContent } = req.body;

            const message = await ContactMessage.findByPk(id);
            if (!message) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn' });
            }

            message.replyContent = replyContent;
            message.replied = true;
            await message.save();

            res.json({ success: true, message: 'Đã trả lời phản hồi', data: message });
        } catch (error) {
            console.error('Lỗi khi trả lời:', error);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
        }
    },
    // Lấy 1 tin nhắn theo ID (cho form trả lời)
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
    }

};

module.exports = contactController;
