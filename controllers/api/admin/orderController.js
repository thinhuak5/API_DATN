const orderModel = require("../../../models/order");
const orderItemModel = require("../../../models/OrderItem");
const productVariationModel = require("../../../models/productVariation");
const productImageModel = require("../../../models/productImage");
const productModel = require("../../../models/product");

exports.getAll = async (req, res) => {
  try {
    // Lấy tất cả đơn hàng kèm item, biến thể, ảnh
    const orders = await orderModel.findAll({
      include: [
        {
          model: orderItemModel,
          as: "items",
          include: [
            {
              model: productVariationModel,
              as: "variation",
              attributes: ["id", "name", "value", "price"],
              include: [
                {
                  model: productImageModel,
                  as: "productImages",
                  attributes: ["image_url"],
                  limit: 1, // Lấy ảnh đầu tiên
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Xử lý tổng tiền và ảnh gọn
    const data = orders.map((order) => {
      const o = order.toJSON();
      o.items = o.items.map((item) => {
        // Gắn image_url vào variation cho gọn
        if (
            item.variation &&
            item.variation.productImages &&
            item.variation.productImages.length > 0
        ) {
          item.variation.image_url = item.variation.productImages[0].image_url;
        } else {
          item.variation.image_url = null;
        }
        delete item.variation.productImages;
        return item;
      });
      // Tổng tiền cho từng đơn
      o.totalAmount = o.items.reduce((sum, item) => {
        const price = Number(item.variation?.price ?? item.price) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + price * qty;
      }, 0);
      return o;
    });

    res.json(data);
  } catch (error) {
    console.error("Lỗi getAll orders:", error);
    res.status(500).json({error: "Lỗi server"});
  }
};

exports.detail = async (req, res) => {
  try {
    const order = await orderModel.findByPk(req.params.id, {
      include: [
        {
          model: orderItemModel,
          as: "items",
          include: [
            {
              model: productVariationModel,
              as: "variation",
              attributes: ["id", "name", "value", "price"],
              include: [
                {
                  model: productImageModel,
                  as: "productImages",
                  attributes: ["image_url"],
                  limit: 1,
                },
              ],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({error: "Đơn hàng không tồn tại"});
    }

    // Gắn image_url như trên
    const o = order.toJSON();
    o.items = o.items.map((item) => {
      if (
          item.variation &&
          item.variation.productImages &&
          item.variation.productImages.length > 0
      ) {
        item.variation.image_url = item.variation.productImages[0].image_url;
      } else {
        item.variation.image_url = null;
      }
      delete item.variation.productImages;
      return item;
    });
    o.totalAmount = o.items.reduce((sum, item) => {
      const price = Number(item.variation?.price ?? item.price) || 0;
      const qty = Number(item.quantity) || 0;
      return sum + price * qty;
    }, 0);

    res.json(o);
  } catch (error) {
    res.status(500).json({error: "Lỗi server"});
  }
};

exports.create = async (req, res) => {
  try {
    const {user_id, payments, payment_status, status, address, phone, name} =
        req.body;
    const newOrder = await orderModel.create({
      user_id,
      payments,
      payment_status,
      status,
      address,
      phone,
      name,
    });
    res
        .status(201)
        .json({message: "Đơn hàng đã được tạo thành công!", order: newOrder});
  } catch (error) {
    res.status(500).json({error: "Lỗi khi tạo đơn hàng"});
  }
};
exports.update = async (req, res) => {
  try {
    const {payment_status, status} = req.body;
    const orderId = req.params.id;

    const [updated] = await orderModel.update(
        {payment_status, status},
        {where: {id: orderId}}
    );

    if (updated === 0) {
      return res.status(404).json({error: "Đơn hàng không tìm thấy"});
    }

    if (payment_status === 1) {
      const orderItems = await orderItemModel.findAll({
        where: {
          order_id: orderId,
        },
      });

      const productIds = orderItems.map((item) => item.product_id);

      const products = await productModel.findAll({
        where: {
          id: productIds,
        },
      });

      for (const product of products) {
        const orderItem = orderItems.find(
            (item) => item.product_id === product.id
        );

        if (orderItem) {
          const newQuantity = product.quantity - orderItem.quantity;

          await product.update({
            quantity: newQuantity < 0 ? 0 : newQuantity,
          });

          console.log(
              `Đã cập nhật sản phẩm ID ${product.id}: còn ${newQuantity}`
          );
        }
      }
    }

    if (payment_status === 1) {
      const orderItems = await orderItemModel.findAll({
        where: {
          order_id: orderId,
        },
      });

      const productIds = orderItems.map((item) => item.product_id);

      const products = await productModel.findAll({
        where: {
          id: productIds,
        },
      });

      for (const product of products) {
        const orderItem = orderItems.find(
            (item) => item.product_id === product.id
        );

        if (orderItem) {
          const newQuantity = product.quantity - orderItem.quantity;

          await product.update({
            quantity: newQuantity < 0 ? 0 : newQuantity,
          });

          console.log(
              `Đã cập nhật sản phẩm ID ${product.id}: còn ${newQuantity}`
          );
        }
      }
    }

    res.status(200).json({message: "Cập nhật đơn hàng thành công!"});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Lỗi khi cập nhật đơn hàng"});
  }
};

exports.delete = async (req, res) => {
  try {
    const deleted = await orderModel.destroy({where: {id: req.params.id}});
    if (deleted === 0) {
      return res.status(404).json({error: "Đơn hàng không tồn tại"});
    }
    res.json({message: "Xóa đơn hàng thành công"});
  } catch (error) {
    res.status(500).json({error: "Lỗi server"});
  }
};
