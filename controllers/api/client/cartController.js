
const Cart = require("../../../models/carts");
const Product = require("../../../models/product");
const ProductImage = require("../../../models/productImage");
const ProductVariation = require("../../../models/productVariation");
const database = require("../../../models/database");

exports.addToCart = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const { product_id, variation_id, quantity } = req.body;

    // Validation
    if (!product_id || !Number.isInteger(quantity) || quantity < 1) {
      await t.rollback();
      return res.status(400).json({ message: "Thiếu thông tin sản phẩm hoặc số lượng không hợp lệ." });
    }

    // Lấy sản phẩm chính
    const product = await Product.findByPk(product_id, { transaction: t });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Sản phẩm chính không tồn tại." });
    }

    let actualVariationIdToUse = null;
    if (variation_id) {
      const parsedVariationId = parseInt(variation_id, 10);
      if (isNaN(parsedVariationId)) {
        await t.rollback();
        return res.status(400).json({ message: "ID biến thể không hợp lệ." });
      }

      // **Chỉnh lại include với as: 'product'**
      const variation = await ProductVariation.findOne({
        where: { id: parsedVariationId, product_id },
        include: [{ model: Product, as: 'product' }],
        transaction: t,
      });

      if (!variation) {
        await t.rollback();
        return res.status(400).json({ message: "Biến thể không tồn tại cho sản phẩm này." });
      }
      actualVariationIdToUse = parsedVariationId;
    }

    // Check giỏ hàng
    const existingItem = await Cart.findOne({
      where: { user_id: userId, variation_id: actualVariationIdToUse, status: 0 },
      transaction: t,
    });

    if (existingItem) {
      existingItem.quantity += quantity;
      await existingItem.save({ transaction: t });
    } else {
      await Cart.create({
        user_id:     userId,
        variation_id: actualVariationIdToUse,
        quantity,
        status:       0,
      }, { transaction: t });
    }

    await t.commit();
    return res.status(200).json({ message: "Đã thêm sản phẩm vào giỏ hàng." });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi thêm vào giỏ hàng:", error);
    return res.status(500).json({ message: "Lỗi server khi thêm vào giỏ hàng.", error: error.message });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const items = await Cart.findAll({
      where: { user_id: userId, status: 0 },
      include: [
        {
          model: ProductVariation,
          as: "variation",
          attributes: ["id", "name", "value", "price"],
          include: [
            {
              model: ProductImage,
              as: "productImages",
              attributes: ["image_url"]
            }
          ],
        },
      ],
    });

    // Format lại JSON để client dễ dùng
    const result = items.map(ci => {
      const json = ci.toJSON();
      const { variation } = json;

      if (variation) {
        // Gán ảnh đầu tiên từ variation.productImages lên variation.image_url
        if (variation.productImages && variation.productImages.length) {
          variation.image_url = variation.productImages[0].image_url;
        }
        // Xóa mảng không cần thiết
        delete variation.productImages;
      }

      return json;
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("Lỗi khi lấy giỏ hàng:", err);
    return res.status(500).json({
      message: "Lỗi server khi lấy giỏ hàng.",
      error: err.message
    });
  }
};


exports.updateCart = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const cartItemId = req.params.cart_item_id;
    const { quantity } = req.body;

    // Kiểm tra số lượng hợp lệ
    if (!Number.isInteger(quantity) || quantity <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Số lượng phải là số nguyên dương." });
    }

    // Tìm mục giỏ hàng
    const cartItem = await Cart.findOne({
      where: {
        id: cartItemId,
        user_id: userId,
        status: 0,
      },
      transaction: t,
    });

    if (!cartItem) {
      await t.rollback();
      return res.status(404).json({ message: "Không tìm thấy sản phẩm trong giỏ hàng." });
    }

    // Cập nhật số lượng
    cartItem.quantity = quantity;
    await cartItem.save({ transaction: t });
    console.log("Updated cart item in DB:", cartItem.toJSON());

    await t.commit();
    return res.status(200).json({ message: "Cập nhật số lượng sản phẩm thành công", cartItem });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi cập nhật giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật giỏ hàng.", error: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const cartItemId = req.params.cart_item_id;

    const cartItem = await Cart.findOne({
      where: {
        id: cartItemId,
        user_id: userId,
        status: 0,
      },
      transaction: t,
    });

    if (!cartItem) {
      await t.rollback();
      return res.status(404).json({ message: "Không tìm thấy sản phẩm trong giỏ hàng." });
    }

    await cartItem.destroy({ transaction: t });
    console.log("Cart item removed from DB:", cartItemId);

    await t.commit();
    return res.status(200).json({ message: "Xóa sản phẩm khỏi giỏ thành công." });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi xóa giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi xóa giỏ hàng.", error: error.message });
  }
};

exports.clearCart = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const { selectedCartItemIds } = req.body;

    if (!selectedCartItemIds || !Array.isArray(selectedCartItemIds) || selectedCartItemIds.length === 0) {
      await t.rollback();
      return res.status(200).json({ message: "Không có sản phẩm nào được chọn để xóa khỏi giỏ hàng." });
    }

    // Kiểm tra các cartItemId có thuộc về user không
    const validCartItems = await Cart.findAll({
      where: {
        user_id: userId,
        id: selectedCartItemIds,
        status: 0,
      },
      transaction: t,
    });

    if (validCartItems.length !== selectedCartItemIds.length) {
      await t.rollback();
      return res.status(400).json({ message: "Một số mục giỏ hàng không hợp lệ hoặc không thuộc về bạn." });
    }

    // Xóa các mục giỏ hàng
    await Cart.destroy({
      where: {
        user_id: userId,
        id: selectedCartItemIds,
        status: 0,
      },
      transaction: t,
    });
    console.log("Selected cart items cleared from DB for user", userId, ":", selectedCartItemIds);

    await t.commit();
    return res.status(200).json({ message: "Đã xóa các sản phẩm được chọn khỏi giỏ hàng sau khi đặt hàng thành công." });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi xóa các sản phẩm được chọn khỏi giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi xóa giỏ hàng.", error: error.message });
  }
};

exports.deletePaidCartItems = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const { cartItemIds } = req.body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "Danh sách sản phẩm không hợp lệ." });
    }

    // Kiểm tra các cartItemId có thuộc về user không
    const validCartItems = await Cart.findAll({
      where: {
        user_id: userId,
        id: cartItemIds,
        status: 0,
      },
      transaction: t,
    });

    if (validCartItems.length !== cartItemIds.length) {
      await t.rollback();
      return res.status(400).json({ message: "Một số mục giỏ hàng không hợp lệ hoặc không thuộc về bạn." });
    }

    // Xóa các mục giỏ hàng
    const deleted = await Cart.destroy({
      where: {
        id: cartItemIds,
        user_id: userId,
        status: 0,
      },
      transaction: t,
    });
    console.log("Deleted paid cart items from DB:", cartItemIds);

    await t.commit();
    return res.status(200).json({
      message: "Đã xóa sản phẩm đã thanh toán khỏi giỏ hàng.",
      deletedCount: deleted,
    });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi xóa cart (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi xóa giỏ hàng.", error: error.message });
  }
};
