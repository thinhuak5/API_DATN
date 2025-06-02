const {VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat} = require('vnpay');
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
            vnp_TxnRef
        } = req.body;

        // Kiểm tra thiếu thông tin
        if (!user_id || !name || !phone || !address || !payment_id || !items || items.length === 0 || !vnp_Amount || !vnp_TxnRef) {
            return res.status(400).json({message: 'Thiếu thông tin đơn hàng hoặc thông tin thanh toán'});
        }

        // 1. Tạo order trong DB
        const order = await Order.create({
            user_id,
            name,
            phone,
            address,
            payment_id,
            payment_status: 0, // chưa thanh toán
            status: 1,
            txn_ref: vnp_TxnRef
        });

        // 2. Thêm các orderItems
        for (const item of items) {
            const product = await Product.findByPk(item.productId);
            if (!product) continue;

            await OrderItem.create({
                order_id: order.id,
                product_id: item.productId,
                quantity: item.quantity,
                price: item.price || product.price
            });
        }

        // 3. Tạo link QR thanh toán VNPay
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

        const vnpayResponse = await vnpay.buildPaymentUrl({
            vnp_Amount: String(vnp_Amount / 100),
            vnp_IpAddr: req.ip || '127.0.0.1',
            vnp_TxnRef: String(vnp_TxnRef),
            vnp_OrderInfo: `Thanh toán đơn hàng #${order.id}`,
            vnp_OrderType: String(ProductCode.Other),
            vnp_ReturnUrl: 'http://localhost:3000/api/check-payment-vnpay',
            vnp_Locale: String(VnpLocale.VN),
            vnp_CreateDate: dateFormat(new Date()),
            vnp_ExpireDate: dateFormat(tomorrow),
        });

        return res.status(201).json(vnpayResponse);

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
            // Thanh toán thành công
            return res.redirect('http://localhost:3001/order-history?message=success');
        } else {
            // Thất bại
            return res.redirect('http://localhost:3001/cart?message=failed');
        }
    } catch (error) {
        console.error('Lỗi xử lý callback VNPay:', error);
        return res.redirect('http://localhost:3001/cart?message=error');
    }
};


module.exports = {
    createPaymentQr,
    checkoutVNpay
};
