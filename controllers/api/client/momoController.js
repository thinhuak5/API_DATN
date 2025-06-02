const crypto = require('crypto');
const axios = require('axios');

const createMomoPayment = async (req, res) => {
    try {
        const partnerCode = "MOMO";
        const accessKey = "F8BBA842ECF85";
        const secretkey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";

        // Nhận từ frontend
        let {amount, orderId} = req.body;

        if (!amount || !orderId) {
            return res.status(400).json({message: "Thiếu thông tin 'amount' hoặc 'orderId'."});
        }

        // Chuyển sang chuỗi nếu là số
        amount = amount.toString();
        orderId = orderId.toString();

        const requestId = partnerCode + Date.now();
        const orderInfo = "Thanh Toán MoMo";
        const redirectUrl = "https://momo.vn/return";
        const ipnUrl = "https://callback.url/notify"; // URL nhận callback thanh toán
        const requestType = "captureWallet";
        const extraData = ""; // có thể truyền userId hoặc info khác

        // Tạo raw signature đúng định dạng
        const rawSignature =
            `accessKey=${accessKey}` +
            `&amount=${amount}` +
            `&extraData=${extraData}` +
            `&ipnUrl=${ipnUrl}` +
            `&orderId=${orderId}` +
            `&orderInfo=${orderInfo}` +
            `&partnerCode=${partnerCode}` +
            `&redirectUrl=${redirectUrl}` +
            `&requestId=${requestId}` +
            `&requestType=${requestType}`;

        console.log("-----RAW SIGNATURE-----");
        console.log(rawSignature);

        // Tạo signature HMAC SHA256
        const signature = crypto
            .createHmac('sha256', secretkey)
            .update(rawSignature)
            .digest('hex');

        console.log("-----SIGNATURE-----");
        console.log(signature);

        // Gửi dữ liệu đến Momo
        const requestBody = {
            partnerCode,
            accessKey,
            requestId,
            amount,
            orderId,
            orderInfo,
            redirectUrl,
            ipnUrl,
            extraData,
            requestType,
            signature,
            lang: 'en',
        };

        const response = await axios.post(
            'https://test-payment.momo.vn/v2/gateway/api/create',
            requestBody,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        // Trả về link thanh toán cho frontend
        return res.status(201).json({payUrl: response.data.payUrl});

    } catch (error) {
        console.error("Lỗi tạo thanh toán MoMo:", error.response?.data || error.message);
        return res.status(500).json({message: 'Không thể tạo thanh toán Momo'});
    }
};

module.exports = {createMomoPayment};
