const Discount = require('../../../models/discount');
const { Op } = require('sequelize');

// Lấy tất cả mã giảm giá
exports.getAll = async (req, res) => {
  try {
    const discounts = await Discount.findAll();
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ error:error });
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
    res.status(500).json({ error: 'Lỗi server khi tạo mã giảm giá', detail: error.message });
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
    res.status(500).json({ error: 'Lỗi server khi cập nhật mã giảm giá' });
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
    console.log('Checking discount code:', code, 'for order value:', orderValue);
    
    const now = new Date();
    console.log('Current date:', now);
    
    // Tìm mã giảm giá không có điều kiện ngày để debug
    const allDiscounts = await Discount.findAll({
      where: {
        code,
      }
    });
    
    console.log('All matching discounts by code:', allDiscounts.map(d => ({
      id: d.id,
      code: d.code,
      status: d.status,
      start_date: d.start_date,
      end_date: d.end_date,
      quantity: d.quantity,
      discount_type: d.discount_type,
      discount_value: d.discount_value
    })));
    
    // Tìm mã giảm giá với đầy đủ điều kiện
    const discount = await Discount.findOne({
      where: {
        code,
        status: true,
        [Op.and]: [
          {
            [Op.or]: [
              { start_date: null },
              { start_date: { [Op.lte]: now } }
            ]
          },
          {
            [Op.or]: [
              { end_date: null },
              { end_date: { [Op.gte]: now } }
            ]
          }
        ],
        quantity: { [Op.gt]: 0 },
      },
    });
    
    console.log('Found valid discount:', discount ? discount.toJSON() : 'None');
    
    if (!discount) {
      return res.status(404).json({ error: 'Mã giảm giá không hợp lệ hoặc đã hết hạn' });
    }
    
    if (discount.min_order_value && orderValue < discount.min_order_value) {
      console.log(`Order value ${orderValue} is less than minimum required ${discount.min_order_value}`);
      return res.status(400).json({ error: `Đơn hàng phải tối thiểu ${discount.min_order_value.toLocaleString()} VNĐ` });
    }
    
    // Đảm bảo trả về đầy đủ thông tin mã giảm giá
    const discountResponse = {
      id: discount.id,
      code: discount.code,
      description: discount.description,
      discount_type: discount.discount_type,
      discount_value: discount.discount_value,
      min_order_value: discount.min_order_value,
      max_discount_value: discount.max_discount_value
    };
    
    console.log('Returning discount data:', discountResponse);
    res.json(discountResponse);
  } catch (error) {
    console.error('Error checking discount:', error);
    res.status(500).json({ error: 'Lỗi server khi kiểm tra mã giảm giá' });
  }
}; 