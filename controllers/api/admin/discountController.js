const Discount = require('../../../models/discount');
const { Op } = require('sequelize');

// Lấy tất cả mã giảm giá
exports.getAll = async (req, res) => {
  try {
    const discounts = await Discount.findAll();
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi lấy danh sách mã giảm giá' });
  }
};

// Lấy chi tiết mã giảm giá
exports.detail = async (req, res) => {
  try {
    const discount = await Discount.findByPk(req.params.id);
    if (!discount) return res.status(404).json({ error: 'Không tìm thấy mã giảm giá' });
    res.json(discount);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi lấy chi tiết mã giảm giá' });
  }
};

// Tạo mã giảm giá mới
exports.create = async (req, res) => {
  try {
    const data = req.body;
    const discount = await Discount.create(data);
    res.status(201).json({ message: 'Tạo mã giảm giá thành công', discount });
  } catch (error) {
    res.status(500).json({ error: 'Mã giảm giá đã tồn tại.', detail: error.message });
  }
};

// Cập nhật mã giảm giá
exports.update = async (req, res) => {
  try {
    const id = req.params.id;
    const [updated] = await Discount.update(req.body, { where: { id } });
    if (!updated) return res.status(404).json({ error: 'Không tìm thấy mã giảm giá' });
    const discount = await Discount.findByPk(id);
    res.json({ message: 'Cập nhật mã giảm giá thành công', discount });
  } catch (error) {
    res.status(500).json({ error: 'Mã giảm giá đã tồn tại.' });
  }
};

// Xóa mã giảm giá
exports.delete = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Discount.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ error: 'Không tìm thấy mã giảm giá' });
    res.json({ message: 'Xóa mã giảm giá thành công' });
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi xóa mã giảm giá' });
  }
};

// Kiểm tra mã giảm giá hợp lệ và trả về thông tin nếu hợp lệ
exports.check = async (req, res) => {
  try {
    const { code, orderValue } = req.body;
    const now = new Date();
    const discount = await Discount.findOne({
      where: {
        code,
        status: true,
        start_date: { [Op.lte]: now },
        end_date: { [Op.gte]: now },
        quantity: { [Op.gt]: 0 },
      },
    });
    if (!discount) return res.status(404).json({ error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    if (discount.min_order_value && orderValue < discount.min_order_value) {
      return res.status(400).json({ error: `Đơn hàng phải tối thiểu ${discount.min_order_value}` });
    }
    res.json(discount);
  } catch (error) {
    res.status(500).json({ error: 'Lỗi server khi kiểm tra mã giảm giá' });
  }
}; 