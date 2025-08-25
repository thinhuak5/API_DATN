const Cart = require("../../../models/carts");
const Product = require("../../../models/product");
const ProductImage = require("../../../models/productImage");
const ProductVariation = require("../../../models/productVariation");
const database = require("../../../models/database");

/* ========================= ADD TO CART ========================= */
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

    // Sản phẩm chính
    const product = await Product.findByPk(product_id, { transaction: t });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ message: "Sản phẩm chính không tồn tại." });
    }

    let actualVariationIdToUse = null;
    let available = null;

    if (variation_id) {
      const parsedVariationId = parseInt(variation_id, 10);
      if (isNaN(parsedVariationId)) {
        await t.rollback();
        return res.status(400).json({ message: "ID biến thể không hợp lệ." });
      }

      // Lấy biến thể kèm product để chắc chắn đúng sản phẩm; đồng thời lấy quantity để check tồn
      const variation = await ProductVariation.findOne({
        where: { id: parsedVariationId, product_id },
        include: [{ model: Product, as: "product" }],
        attributes: ["id", "product_id", "quantity"],
        transaction: t,
        lock: t.LOCK.UPDATE, // tránh race add đồng thời
      });

      if (!variation) {
        await t.rollback();
        return res.status(400).json({ message: "Biến thể không tồn tại cho sản phẩm này." });
      }

      actualVariationIdToUse = parsedVariationId;
      available = Math.max(0, Number(variation.quantity) || 0);
    }

    // Tìm item đã có trong giỏ
    const existingItem = await Cart.findOne({
      where: { user_id: userId, variation_id: actualVariationIdToUse, status: 0 },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    // Nếu có biến thể, kiểm tra vượt tồn
    if (actualVariationIdToUse !== null) {
      const currentQty = existingItem ? Number(existingItem.quantity) || 0 : 0;
      const desired = currentQty + quantity;
      if (desired > available) {
        await t.rollback();
        return res.status(409).json({
          code: "insufficient_stock",
          message: `Chỉ còn ${available} sản phẩm trong kho.`,
          available,
        });
      }
    }

    // Lưu DB
    if (existingItem) {
      existingItem.quantity = (Number(existingItem.quantity) || 0) + quantity;
      await existingItem.save({ transaction: t });
    } else {
      await Cart.create(
        {
          user_id: userId,
          variation_id: actualVariationIdToUse,
          quantity,
          status: 0,
        },
        { transaction: t }
      );
    }

    await t.commit();
    return res.status(200).json({ message: "Đã thêm sản phẩm vào giỏ hàng." });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi thêm vào giỏ hàng:", error);
    return res.status(500).json({ message: "Lỗi server khi thêm vào giỏ hàng.", error: error.message });
  }
};

/* ========================= GET CART ========================= */
exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const items = await Cart.findAll({
      where: { user_id: userId, status: 0 },
      include: [
        {
          model: ProductVariation,
          as: "variation",
          attributes: ["id", "name", "price", "quantity", "product_id"], // 👈 trả về quantity
          include: [
            {
              model: ProductImage,
              as: "productImages",
              attributes: ["image_url"],
              limit: 1,
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Format cho FE
    const result = items.map((ci) => {
      const json = ci.toJSON();
      const { variation } = json;

      if (variation) {
        if (variation.productImages && variation.productImages.length) {
          variation.image_url = variation.productImages[0].image_url;
        } else {
          variation.image_url = null;
        }
        delete variation.productImages;
      }

      return json;
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("Lỗi khi lấy giỏ hàng:", err);
    return res.status(500).json({
      message: "Lỗi server khi lấy giỏ hàng.",
      error: err.message,
    });
  }
};

/* ========================= UPDATE CART ========================= */
exports.updateCart = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const cartItemId = req.params.cart_item_id;
    const { quantity } = req.body;

    // Validate
    if (!Number.isInteger(quantity) || quantity <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Số lượng phải là số nguyên dương." });
    }

    // Tìm cart item + variation để check tồn
    const cartItem = await Cart.findOne({
      where: { id: cartItemId, user_id: userId, status: 0 },
      include: [
        {
          model: ProductVariation,
          as: "variation",
          attributes: ["id", "quantity"],
        },
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!cartItem) {
      await t.rollback();
      return res.status(404).json({ message: "Không tìm thấy sản phẩm trong giỏ hàng." });
    }

    const available = Math.max(0, Number(cartItem.variation?.quantity) || 0);
    if (quantity > available) {
      await t.rollback();
      return res.status(409).json({
        code: "insufficient_stock",
        message: `Chỉ còn ${available} sản phẩm trong kho.`,
        available,
      });
    }

    // Cập nhật
    cartItem.quantity = quantity;
    await cartItem.save({ transaction: t });

    await t.commit();
    return res.status(200).json({ message: "Cập nhật số lượng sản phẩm thành công", cartItem });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi cập nhật giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật giỏ hàng.", error: error.message });
  }
};

/* ========================= REMOVE ONE ========================= */
exports.removeFromCart = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const cartItemId = req.params.cart_item_id;

    const cartItem = await Cart.findOne({
      where: { id: cartItemId, user_id: userId, status: 0 },
      transaction: t,
    });

    if (!cartItem) {
      await t.rollback();
      return res.status(404).json({ message: "Không tìm thấy sản phẩm trong giỏ hàng." });
    }

    await cartItem.destroy({ transaction: t });
    await t.commit();
    return res.status(200).json({ message: "Xóa sản phẩm khỏi giỏ thành công." });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi xóa giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi xóa giỏ hàng.", error: error.message });
  }
};

/* ========================= CLEAR SELECTED ========================= */
exports.clearCart = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const { selectedCartItemIds } = req.body;

    if (!selectedCartItemIds || !Array.isArray(selectedCartItemIds) || selectedCartItemIds.length === 0) {
      await t.rollback();
      return res.status(200).json({ message: "Không có sản phẩm nào được chọn để xóa khỏi giỏ hàng." });
    }

    const validCartItems = await Cart.findAll({
      where: { user_id: userId, id: selectedCartItemIds, status: 0 },
      transaction: t,
    });

    if (validCartItems.length !== selectedCartItemIds.length) {
      await t.rollback();
      return res.status(400).json({ message: "Một số mục giỏ hàng không hợp lệ hoặc không thuộc về bạn." });
    }

    await Cart.destroy({
      where: { user_id: userId, id: selectedCartItemIds, status: 0 },
      transaction: t,
    });

    await t.commit();
    return res.status(200).json({ message: "Đã xóa các sản phẩm được chọn khỏi giỏ hàng sau khi đặt hàng thành công." });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi xóa các sản phẩm được chọn khỏi giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi xóa giỏ hàng.", error: error.message });
  }
};

/* ========================= DELETE PAID ITEMS ========================= */
exports.deletePaidCartItems = async (req, res) => {
  const t = await database.transaction();
  try {
    const userId = req.user.id;
    const { cartItemIds } = req.body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "Danh sách sản phẩm không hợp lệ." });
    }

    const validCartItems = await Cart.findAll({
      where: { user_id: userId, id: cartItemIds, status: 0 },
      transaction: t,
    });

    if (validCartItems.length !== cartItemIds.length) {
      await t.rollback();
      return res.status(400).json({ message: "Một số mục giỏ hàng không hợp lệ hoặc không thuộc về bạn." });
    }

    const deleted = await Cart.destroy({
      where: { id: cartItemIds, user_id: userId, status: 0 },
      transaction: t,
    });

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
