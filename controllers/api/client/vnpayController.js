const {VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat} = require('vnpay');
const TempOrder = require('../../../models/tempOrder');
const Order = require('../../../models/order');
const OrderItem = require('../../../models/OrderItem');
const Product = require('../../../models/product');

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
    } = req.body;

    // Kiểm tra thiếu thông tin
    if (!user_id || !name || !phone || !address || !payment_id || !items || items.length === 0 || !vnp_Amount || !vnp_TxnRef) {
      return res.status(400).json({message: 'Thiếu thông tin đơn hàng hoặc thanh toán'});
    }

    // Lưu tạm đơn hàng vào temp_orders
    await TempOrder.create({
      user_id,
      name,
      phone,
      address,
      payment_id,
      items: JSON.stringify(items), // Lưu danh sách item dạng JSON
      amount: vnp_Amount,
      txn_ref: vnp_TxnRef,
    });

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
      vnp_TxnRef: String(vnp_TxnRef),
      vnp_OrderInfo: `Thanh toán đơn hàng tạm #${vnp_TxnRef}`,
      vnp_OrderType: String(ProductCode.Other),
      vnp_ReturnUrl: 'http://localhost:3000/api/check-payment-vnpay',
      vnp_Locale: String(VnpLocale.VN),
      vnp_CreateDate: dateFormat(new Date()),
      vnp_ExpireDate: dateFormat(tomorrow),
    });

    return res.status(201).json(paymentUrl);
  } catch (error) {
    console.error('Lỗi tạo QR thanh toán:', error);
    return res.status(500).json({message: 'Không tạo được link thanh toán', error: error.message});
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


      const tempOrder = await TempOrder.findOne({where: {txn_ref: txnRef}});
      if (!tempOrder) {
        return res.redirect('http://localhost:3001/order-history?message=notfound');
      }

      const newOrder = await Order.create({
        user_id: tempOrder.user_id,
        name: tempOrder.name,
        phone: tempOrder.phone,
        address: tempOrder.address,
        payment_id: tempOrder.payment_id,
        total_price: tempOrder.amount,
        status: 1,
        payment_status: 1
      });

      const items = JSON.parse(tempOrder.items);
      for (const item of items) {
        await OrderItem.create({
          order_id: newOrder.id,
          product_id: item.productId,
          variation_id: item.variationId || null,
          quantity: item.quantity,
          price: item.price,
        });

        await Product.increment(
            {sold: item.quantity},
            {where: {id: item.productId}}
        );
      }

      await TempOrder.destroy({where: {id: tempOrder.id}});

      return res.redirect('http://localhost:3001/order-history?message=success');
    } else {
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
