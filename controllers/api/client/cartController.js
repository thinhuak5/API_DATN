
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
      console.error("Validation error: Missing product_id or invalid quantity", { product_id, quantity });
      return res.status(400).json({ message: "Thiếu thông tin sản phẩm hoặc số lượng không hợp lệ." });
    }

    // Kiểm tra sản phẩm chính
    const product = await Product.findByPk(product_id, { transaction: t });
    if (!product) {
      await t.rollback();
      console.error("Error: Main Product not found for ID:", product_id);
      return res.status(404).json({ message: "Sản phẩm chính không tồn tại." });
    }
    console.log("Main Product found:", product.name);

    // Kiểm tra biến thể nếu có
    let actualVariationIdToUse = null;
    if (variation_id) {
      const parsedVariationId = parseInt(variation_id, 10);
      if (isNaN(parsedVariationId)) {
        await t.rollback();
        console.error("Error: variation_id is not a valid number:", variation_id);
        return res.status(400).json({ message: "ID biến thể không hợp lệ (phải là số)." });
      }

      const variation = await ProductVariation.findOne({
        where: { id: parsedVariationId, product_id: product_id },
        include: [{ model: Product }],
        transaction: t,
      });

      console.log("Result of ProductVariation.findOne:", variation ? variation.toJSON() : `No variation found for ID ${parsedVariationId} under product ID ${product_id}`);

      if (!variation) {
        await t.rollback();
        return res.status(400).json({ message: "Biến thể không hợp lệ hoặc không tồn tại cho sản phẩm này." });
      }
      actualVariationIdToUse = parsedVariationId;
    }

    // Kiểm tra sản phẩm đã có trong giỏ chưa
    const existingItem = await Cart.findOne({
      where: {
        user_id: userId,
        product_id,
        variation_id: actualVariationIdToUse,
        status: 0, // Chỉ kiểm tra các mục chưa thanh toán
      },
      transaction: t,
    });

    if (existingItem) {
      console.log("Existing cart item found. Updating quantity.");
      existingItem.quantity += quantity;
      await existingItem.save({ transaction: t });
      console.log("Updated cart item:", existingItem.toJSON());
    } else {
      console.log("No existing cart item found. Creating new one.");
      const newCartItem = await Cart.create({
        user_id: userId,
        product_id,
        variation_id: actualVariationIdToUse,
        quantity,
        status: 0,
      }, { transaction: t });
      console.log("Created new cart item:", newCartItem.toJSON());
    }

    await t.commit();
    return res.status(200).json({ message: "Đã thêm sản phẩm vào giỏ hàng." });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi thêm vào giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi thêm vào giỏ hàng.", error: error.message });
  }
};

exports.getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const cartItems = await Cart.findAll({
      where: {
        user_id: userId,
        status: 0,
      },
      include: [
        {
          model: Product,
          attributes: ["id", "name", "price", "discount_price"],
          include: [
            {
              model: ProductImage,
              as: "productImages",
              attributes: ["image_url"],
              limit: 1,
            },
          ],
        },
        {
          model: ProductVariation,
          as: "variation",
          attributes: ["id", "name", "value", "price"],
        },
      ],
    });

    // Chuyển đổi dữ liệu để đảm bảo image_url là URL Cloudinary đầy đủ
    const formattedCartItems = cartItems.map(item => {
      const itemJSON = item.toJSON();
      if (itemJSON.product && itemJSON.product.productImages && itemJSON.product.productImages.length > 0) {
        itemJSON.product.image_url = itemJSON.product.productImages[0].image_url;
        delete itemJSON.product.productImages; // Xóa productImages để giảm payload
      }
      return itemJSON;
    });

    console.log("--- getCart Result (Backend) ---");
    formattedCartItems.forEach(item => {
      console.log(`Cart Item: ID=${item.id}, Product ID=${item.product_id}, Variation ID=${item.variation_id}, Quantity=${item.quantity}`);
      if (item.product) {
        console.log(`  Product Name: ${item.product.name}, Image URL: ${item.product.image_url}`);
      }
      if (item.variation) {
        console.log(`  Variation Name: ${item.variation.name}, Value: ${item.variation.value}`);
      } else {
        console.log("  No variation associated with this cart item.");
      }
    });

    return res.status(200).json(formattedCartItems);
  } catch (error) {
    console.error("Lỗi khi lấy giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi lấy giỏ hàng.", error: error.message });
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
