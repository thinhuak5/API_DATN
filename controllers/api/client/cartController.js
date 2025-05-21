// Controller: CartController.js
const Cart = require('../../../models/carts');
const Product = require('../../../models/product');

exports.addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { product_id, quantity } = req.body;

        // Lấy giá sản phẩm
        const product = await Product.findByPk(product_id);
        if (!product) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }

        // Kiểm tra giỏ hàng xem sản phẩm đã có chưa
        let cartItem = await Cart.findOne({
            where: {
                user_id: userId,
                product_id: product_id,
                status: 0  // Trạng thái giỏ hàng
            }
        });

        if (cartItem) {
            // Cập nhật số lượng nếu sản phẩm đã có trong giỏ
            const newQuantity = cartItem.quantity + quantity;
            if (newQuantity <= 10) { // Giới hạn số lượng tối đa là 10
                cartItem.quantity = newQuantity;
                await cartItem.save();
                return res.status(200).json({ message: 'Cập nhật giỏ hàng thành công', cartItem });
            } else {
                return res.status(400).json({ message: 'Số lượng tối đa là 10 sản phẩm' });
            }
        } else {
            // Thêm sản phẩm mới vào giỏ hàng
            const newCartItem = await Cart.create({
                user_id: userId,
                product_id,
                quantity,
                price: product.price,
                status: 0  // Giỏ hàng chưa hoàn tất
            });
            return res.status(200).json({ message: 'Thêm sản phẩm vào giỏ thành công', newCartItem });
        }
    } catch (error) {
        console.error('Lỗi khi thêm sản phẩm vào giỏ hàng:', error);
        return res.status(500).json({ message: 'Lỗi server', error });
    }
};

// GET /api/cart - Lấy danh sách sản phẩm trong giỏ hàng
exports.getCart = async (req, res) => {
    try {
        const userId = req.user.id;

        const cartItems = await Cart.findAll({
            where: {
                user_id: userId,
                status: 0
            },
            include: [
                {
                    model: Product,
                    attributes: ['id', 'name', 'images', 'price']
                }
            ]
        });

        return res.status(200).json(cartItems);
    } catch (error) {
        console.error("Lỗi khi lấy giỏ hàng:", error);
        return res.status(500).json({ message: 'Lỗi server', error });
    }
};

// DELETE /api/cart/:product_id - Xoá sản phẩm khỏi giỏ
exports.removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const productId = req.params.product_id;

        const cartItem = await Cart.findOne({
            where: {
                user_id: userId,
                product_id: productId,
                status: 0
            }
        });

        if (!cartItem) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ hàng' });
        }

        await cartItem.destroy();

        return res.status(200).json({ message: 'Xoá sản phẩm khỏi giỏ thành công' });
    } catch (error) {
        console.error("Lỗi khi xoá giỏ hàng:", error);
        return res.status(500).json({ message: 'Lỗi server', error });
    }
};
// DELETE /api/cart/clear - Xoá toàn bộ giỏ hàng của người dùng sau khi đặt hàng
// controllers/CartController.js

// New version: Clears only selected items
exports.clearCart = async (req, res) => { // This will now be called by /cart/clear-selected
    try {
        const userId = req.user.id;
        const { selectedProductIds } = req.body;

        if (!selectedProductIds || !Array.isArray(selectedProductIds) || selectedProductIds.length === 0) {
            return res.status(200).json({ message: 'Không có sản phẩm nào được chọn để xóa khỏi giỏ hàng.' });
        }

        await Cart.destroy({
            where: {
                user_id: userId,
                product_id: selectedProductIds,
                status: 0
            }
        });

        return res.status(200).json({ message: 'Đã xóa các sản phẩm được chọn khỏi giỏ hàng sau khi đặt hàng thành công.' });
    } catch (error) {
        console.error("Lỗi khi xóa các sản phẩm được chọn khỏi giỏ hàng:", error);
        return res.status(500).json({ message: 'Lỗi server khi xóa giỏ hàng', error: error.message });
    }
};

// If you still need a function to clear EVERYTHING from the cart
exports.clearAllCartItems = async (req, res) => { // Rename this from clearCart if it deletes everything
    try {
        const userId = req.user.id;
        await Cart.destroy({
            where: {
                user_id: userId,
                status: 0 // Assuming status 0 means "in cart"
            }
        });
        return res.status(200).json({ message: 'Đã xóa toàn bộ giỏ hàng sau khi đặt hàng' });
    } catch (error) {
        console.error("Lỗi khi xóa toàn bộ giỏ hàng:", error);
        return res.status(500).json({ message: 'Lỗi server khi xóa giỏ hàng', error: error.message });
    }
};

exports.updateCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const productId = req.params.product_id;
        const { quantity } = req.body.cart.quantity;
        console.log(req.body.cart.quantity); // lỗi cập nhật giỏ hàng ở API

        // Kiểm tra số lượng hợp lệ
        if (quantity <= 0) {
            return res.status(400).json({ message: 'Số lượng phải lớn hơn 0' });
        }

        // Kiểm tra sản phẩm trong giỏ hàng
        const cartItem = await Cart.findOne({
            where: {
                user_id: userId,
                product_id: productId,
                status: 0 // Giỏ hàng chưa thanh toán
            }
        });

        if (!cartItem) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ hàng' });
        }
        cartItem.quantity = req.body.cart.quantity;
        console.log(cartItem.quantity);

        await cartItem.save();
        return res.status(200).json({ message: 'Cập nhật số lượng sản phẩm thành công', cartItem });
        // Cập nhật số lượng nếu sản phẩm có trong giỏ
        /*     if (10) { // Giới hạn số lượng tối đa là 10
              cartItem.quantity = quantity;
              await cartItem.save();
              return res.status(200).json({ message: 'Cập nhật số lượng sản phẩm thành công', cartItem });
            } else {
              return res.status(400).json({ message: 'Số lượng tối đa là 10 sản phẩm' });
            } */
    } catch (error) {
        console.error("Lỗi khi cập nhật giỏ hàng:", error);
        return res.status(500).json({ message: 'Lỗi server', error });
    }

};
