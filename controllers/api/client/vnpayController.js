const { VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat } = require('vnpay');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const ProductVariation = require('../../../models/productVariation');

const createPaymentQr = async (req, res) => {
  try {
    const { 
      user_id, 
      name, 
      phone, 
      address, 
      payment_id, 
      items,
      vnp_Amount,
      vnp_TxnRef,
      discount_id,
      discount_amount
    } = req.body;

    // Tạo vnp_TxnRef nếu không có
    const txnRef = vnp_TxnRef || `ORDER_${Date.now()}`;

    // Kiểm tra thiếu thông tin
    if (!user_id || !name || !phone || !address || !payment_id || !items || items.length === 0 || vnp_Amount == null) {
      return res.status(400).json({ message: 'Thiếu thông tin đơn hàng hoặc thanh toán' });
    }

    // Tạo đơn hàng trực tiếp với payment_status = 0 (chưa thanh toán)
    const newOrder = await Order.create({
      user_id,
      name,
      phone,
      address,
      payment_id,
      total_amount: vnp_Amount / 100, // Chia 100 để về đơn vị đồng thực tế
      status: 1,
      payment_status: 0, // Chưa thanh toán
      txn_ref: txnRef,
      discount_id: discount_id || null,
      discount_amount: discount_amount || 0
    });

    // Tạo order items
    for (const item of items) {
      if (item.variationId && item.quantity > 0) {
        await OrderItem.create({
          order_id: newOrder.id,
          variation_id: item.variationId,
          quantity: item.quantity,
          price: item.price,
        });
      }
    }

    // Cấu hình VNPay
    const vnpay = new VNPay({
      tmnCode: '2KU41SC6',
      secureSecret: 'YTM76HALR23F90YJSQXGWV5KBEVICQK9',
      vnpayHost: 'https://sandbox.vnpayment.vn',
      testMode: true,
      hashAlgorithm: 'SHA512',
      loggerFn: ignoreLogger,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const paymentUrl = await vnpay.buildPaymentUrl({
      vnp_Amount: String(vnp_Amount / 100),
      vnp_IpAddr: req.ip || '127.0.0.1',
      vnp_TxnRef: String(txnRef),
      vnp_OrderInfo: `Thanh toán đơn hàng #${txnRef}`,
      vnp_OrderType: String(ProductCode.Other),
      vnp_ReturnUrl: 'http://localhost:3000/api/check-payment-vnpay',
      vnp_Locale: String(VnpLocale.VN),
      vnp_CreateDate: dateFormat(new Date()),
      vnp_ExpireDate: dateFormat(tomorrow),
    });

    return res.status(201).json(paymentUrl);
  } catch (error) {
    console.error('Lỗi tạo QR thanh toán:', error);
    return res.status(500).json({ message: 'Không tạo được link thanh toán', error: error.message });
  }
};

const checkoutVNpay = async (req, res) => {
  try {
    const vnpay = new VNPay({
      tmnCode: '2KU41SC6',
      secureSecret: 'YTM76HALR23F90YJSQXGWV5KBEVICQK9',
      vnpayHost: 'https://sandbox.vnpayment.vn',
      testMode: true,
      hashAlgorithm: 'SHA512',
      loggerFn: ignoreLogger,
    });

    const vnpResponse = req.query;

    if (vnpResponse.vnp_ResponseCode === '00') {
      const txnRef = vnpResponse.vnp_TxnRef;

      // Tìm đơn hàng theo txn_ref
      const order = await Order.findOne({ where: { txn_ref: txnRef } });
      if (!order) {
        return res.redirect('http://localhost:3001/order-history?message=notfound');
      }

      // Cập nhật trạng thái thanh toán thành công
      await Order.update(
        { payment_status: 1 }, // Thanh toán thành công
        { where: { id: order.id } }
      );

      // Cập nhật số lượng bán của các sản phẩm
      const orderItems = await OrderItem.findAll({ where: { order_id: order.id } });
      for (const item of orderItems) {
        await ProductVariation.increment(
          { sold: item.quantity },
          { where: { id: item.variation_id } }
        );
      }

      return res.redirect('http://localhost:3001/order-history?message=success');
    } else {
      // Thanh toán thất bại - có thể xóa đơn hàng hoặc đánh dấu thất bại
      const txnRef = vnpResponse.vnp_TxnRef;
      if (txnRef) {
        // Xóa đơn hàng nếu thanh toán thất bại
        const order = await Order.findOne({ where: { txn_ref: txnRef } });
        if (order) {
          await OrderItem.destroy({ where: { order_id: order.id } });
          await Order.destroy({ where: { id: order.id } });
        }
      }
      return res.redirect('http://localhost:3001/order-history?message=failed');
    }
  } catch (error) {
    console.error('Lỗi xử lý callback VNPay:', error);
    return res.redirect('http://localhost:3001/cart?message=error');
  }
};

module.exports = {
  createPaymentQr,
  checkoutVNpay,
};