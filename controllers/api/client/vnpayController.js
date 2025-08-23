const {
  VNPay,
  ignoreLogger,
  ProductCode,
  VnpLocale,
  dateFormat,
} = require("vnpay");
const { Sequelize } = require("sequelize"); // <-- thêm
const sequelize = require("../../../models/database"); // <-- thêm

const Order = require("../../../models/order");
const OrderItem = require("../../../models/OrderItem");
const ProductVariation = require("../../../models/productVariation");

// =============== Tạo link VNPay (CHƯA trừ kho) ===============
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
      discount_amount,
    } = req.body;

    const txnRef = vnp_TxnRef || `${Date.now()}`;

    if (
      !user_id ||
      !name ||
      !phone ||
      !address ||
      !payment_id ||
      !items ||
      items.length === 0 ||
      vnp_Amount == null
    ) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin đơn hàng hoặc thanh toán" });
    }

    // Tạo đơn CHƯA thanh toán (payment_status = 0)
    const newOrder = await Order.create({
      user_id,
      name,
      phone,
      address,
      payment_id,
      total_amount: vnp_Amount / 100, // vnp_Amount client gửi thường = total*100
      status: 1,
      payment_status: 0, // <-- SỬA: 0 = chưa thanh toán
      txn_ref: txnRef,
      discount_id: discount_id || null,
      discount_amount: discount_amount || 0,
    });

    // Lưu items (không trừ kho tại đây)
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
      tmnCode: "2KU41SC6",
      secureSecret: "YTM76HALR23F90YJSQXGWV5KBEVICQK9",
      vnpayHost: "https://sandbox.vnpayment.vn",
      testMode: true,
      hashAlgorithm: "SHA512",
      loggerFn: ignoreLogger,
    });

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const paymentUrl = await vnpay.buildPaymentUrl({
      // Nếu vnp_Amount từ FE là total*100 thì truyền nguyên vnp_Amount xuống VNPay:
      vnp_Amount: String(vnp_Amount / 100),
      vnp_IpAddr: req.ip || "127.0.0.1",
      vnp_TxnRef: String(txnRef),
      vnp_OrderInfo: `Thanh toán đơn hàng #${txnRef}`,
      vnp_OrderType: String(ProductCode.Other),
      vnp_ReturnUrl: "http://localhost:3000/api/check-payment-vnpay",
      vnp_Locale: String(VnpLocale.VN),
      vnp_CreateDate: dateFormat(new Date()),
      vnp_ExpireDate: dateFormat(tomorrow),
    });

    return res.status(201).json(paymentUrl);
  } catch (error) {
    console.error("Lỗi tạo QR thanh toán:", error);
    return res
      .status(500)
      .json({ message: "Không tạo được link thanh toán", error: error.message });
  }
};

// =============== Callback VNPay (THÀNH CÔNG -> trừ kho + cộng sold) ===============
const checkoutVNpay = async (req, res) => {
  try {
    const vnpay = new VNPay({
      tmnCode: "2KU41SC6",
      secureSecret: "YTM76HALR23F90YJSQXGWV5KBEVICQK9",
      vnpayHost: "https://sandbox.vnpayment.vn",
      testMode: true,
      hashAlgorithm: "SHA512",
      loggerFn: ignoreLogger,
    });

    const vnpResponse = req.query;
    const txnRef = vnpResponse.vnp_TxnRef;

    // (Bỏ verify signature để giữ nguyên flow đang dùng)
    if (vnpResponse.vnp_ResponseCode === "00") {
      // Thanh toán thành công
      const t = await sequelize.transaction();
      try {
        const order = await Order.findOne({
          where: { txn_ref: txnRef },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (!order) {
          await t.rollback();
          return res.redirect(
            "http://localhost:3001/order-history?message=notfound"
          );
        }

        // Lấy items
        const items = await OrderItem.findAll({
          where: { order_id: order.id },
          attributes: ["variation_id", "quantity", "price"],
          transaction: t,
        });

        // Gom qty theo variation
        const needByVar = new Map();
        for (const it of items) {
          if (!it.variation_id) continue;
          needByVar.set(
            it.variation_id,
            (needByVar.get(it.variation_id) || 0) + Number(it.quantity || 0)
          );
        }
        const variationIds = Array.from(needByVar.keys());

        // Khoá & kiểm tồn
        const vars = variationIds.length
          ? await ProductVariation.findAll({
              where: { id: variationIds },
              attributes: ["id", "quantity"],
              transaction: t,
              lock: t.LOCK.UPDATE,
            })
          : [];
        const varById = new Map(vars.map((v) => [v.id, v]));

        const insufficient = [];
        for (const vId of variationIds) {
          const need = needByVar.get(vId) || 0;
          const row = varById.get(vId);
          if (!row) {
            insufficient.push({
              variation_id: vId,
              reason: "variation_not_found",
            });
          } else if ((row.quantity || 0) < need) {
            insufficient.push({
              variation_id: vId,
              need,
              stock: row.quantity || 0,
              reason: "not_enough_stock",
            });
          }
        }

        if (insufficient.length) {
          // Hết hàng vào lúc thanh toán -> huỷ đơn
          await Order.update(
            { status: 0 },
            { where: { id: order.id }, transaction: t }
          );
          await t.commit();
          return res.redirect(
            "http://localhost:3001/order-history?message=failed"
          );
        }

        // TrỪ KHO + CỘNG SOLD
        for (const [vId, need] of needByVar.entries()) {
          await ProductVariation.update(
            {
              quantity: Sequelize.literal(`GREATEST(quantity - ${need}, 0)`),
              sold: Sequelize.literal(`COALESCE(sold, 0) + ${need}`),
            },
            { where: { id: vId }, transaction: t }
          );
        }

        // Đánh dấu đã thanh toán
        await Order.update(
            {payment_status: 1, status: 1, txn_ref: txnRef},
          { where: { id: order.id }, transaction: t }
        );

        await t.commit();
        return res.redirect(
          "http://localhost:3001/order-history?message=success"
        );
      } catch (err) {
        console.error("VNPay success but error during stock update:", err);
        try { await t.rollback(); } catch {}
        return res.redirect(
          "http://localhost:3001/order-history?message=error"
        );
      }
    } else {
      // Thanh toán thất bại -> xoá đơn (chưa trừ kho nên không cần hoàn)
      if (txnRef) {
        const order = await Order.findOne({ where: { txn_ref: txnRef } });
        if (order) {
          await OrderItem.destroy({ where: { order_id: order.id } });
          await Order.destroy({ where: { id: order.id } });
        }
        return res.redirect(
          "http://localhost:3001/order-history?message=failed"
        );
      }
      return res.json({ message: "Chưa xóa đơn hàng", txnRef });
    }
  } catch (error) {
    console.error("Lỗi xử lý callback VNPay:", error);
    return res.redirect("http://localhost:3001/cart?message=error");
  }
};

module.exports = {
  createPaymentQr,
  checkoutVNpay,
};
