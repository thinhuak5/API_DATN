const {VNPay, ignoreLogger, ProductCode, VnpLocale, dateFormat} = require('vnpay');

const createPaymentQr = async (req, res) => {
    try {
        const {vnp_Amount, vnp_TxnRef} = req.body;

        if (!vnp_Amount || !vnp_TxnRef) {
            return res.status(400).json({message: 'Thiếu vnp_Amount hoặc vnp_TxnRef'});
        }

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
            vnp_Amount: String(vnp_Amount), // phải là string
            vnp_IpAddr: req.ip || '127.0.0.1',
            vnp_TxnRef: String(vnp_TxnRef),
            vnp_OrderInfo: 'Thanh toán đơn hàng',
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


module.exports = {
    createPaymentQr,
};
