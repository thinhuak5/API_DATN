const orderModel = require('../../../models/order');
const orderItemModel = require('../../../models/OrderItem');
const productModel = require('../../../models/product');
exports.getAll = async (req, res) => {
    try {
        const data = await orderModel.findAll();
        res.json(data);
    } catch (error) {
        res.status(500).json({error: "Lỗi server"});
    }
};

exports.detail = async (req, res) => {
    try {
        const order = await orderModel.findByPk(req.params.id);
        if (!order) {
            return res.status(404).json({error: "Đơn hàng không tồn tại"});
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({error: "Lỗi server"});
    }
};

exports.create = async (req, res) => {
    try {
        const {user_id, payments, payment_status, status, address, phone, name} = req.body;
        const newOrder = await orderModel.create({user_id, payments, payment_status, status, address, phone, name});
        res.status(201).json({message: "Đơn hàng đã được tạo thành công!", order: newOrder});
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
                    order_id: orderId
                }
            });

            const productIds = orderItems.map(item => item.product_id);

            const products = await productModel.findAll({
                where: {
                    id: productIds
                }
            });

            for (const product of products) {
                const orderItem = orderItems.find(item => item.product_id === product.id);

                if (orderItem) {
                    const newQuantity = product.quantity - orderItem.quantity;

                    await product.update({
                        quantity: newQuantity < 0 ? 0 : newQuantity
                    });

                    console.log(`Đã cập nhật sản phẩm ID ${product.id}: còn ${newQuantity}`);
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
