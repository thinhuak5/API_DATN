const Cart = require("../../../models/carts");
const Product = require("../../../models/product");
const ProductImage = require("../../../models/productImage"); 
const ProductVariation = require("../../../models/productVariation"); 

exports.addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, variation_id, quantity } = req.body;



    if (!product_id || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'Thiếu thông tin sản phẩm hoặc số lượng không hợp lệ.' });
    }

    // Kiểm tra sự tồn tại của sản phẩm chính
    const product = await Product.findByPk(product_id);
    if (!product) {
        console.log('Error: Main Product not found for ID:', product_id);
        return res.status(404).json({ message: "Sản phẩm chính không tồn tại." });
    }
    console.log('Main Product found:', product.name);


    // Nếu có variation_id, kiểm tra biến thể tồn tại
    if (variation_id) {
            const parsedVariationId = parseInt(variation_id, 10);
            if (isNaN(parsedVariationId)) {
                console.error('Error: variation_id received is not a valid number:', variation_id);
                return res.status(400).json({ message: "ID biến thể không hợp lệ (phải là số)." });
            }

      const variation = await ProductVariation.findOne({
        where: { id: parsedVariationId, product_id: product_id }, // Thêm product_id để đảm bảo biến thể thuộc về sản phẩm này
        include: [{ model: Product }],
      });

            console.log('Result of ProductVariation.findOne:');
            console.log(variation ? variation.toJSON() : 'No variation found for ID ' + parsedVariationId + ' under product ID ' + product_id);

      if (!variation) { 
        return res.status(400).json({ message: "Biến thể không hợp lệ hoặc không tồn tại cho sản phẩm này." }); 
      }
    }

    // Dữ liệu variation_id để sử dụng trong truy vấn Cart
    const actualVariationIdToUse = variation_id || null;

    // Kiểm tra sản phẩm đã có trong giỏ chưa (cùng product_id và variation_id chính xác)
    const existingItem = await Cart.findOne({
      where: {
        user_id: userId,
        product_id,
        variation_id: actualVariationIdToUse, // Sử dụng biến đã xác định
      },
    });

    if (existingItem) {
        console.log('Existing cart item found. Updating quantity.');
      existingItem.quantity += quantity;
      await existingItem.save();
        console.log('Updated cart item:', existingItem.toJSON());
    } else {
        console.log('No existing cart item found. Creating new one.');
      const newCartItem = await Cart.create({
        user_id: userId,
        product_id,
        variation_id: actualVariationIdToUse,
        quantity,
        status: 0, 
      });
        console.log('Created new cart item:', newCartItem.toJSON());
    }

    return res.status(200).json({ message: "Đã thêm sản phẩm vào giỏ hàng." });
  } catch (error) {
    console.error("Lỗi thêm vào giỏ hàng (Backend Error):", error);
    res.status(500).json({ message: "Lỗi server khi thêm vào giỏ hàng.", error: error.message });
  }
};

// GET /api/cart - Lấy danh sách sản phẩm trong giỏ hàng
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
          attributes: ["id", "name", "price"],
          include: [
            {
              model: ProductImage,
              as: "productImages", // ⬅ đúng alias như model định nghĩa
              attributes: ["image_url"],
              limit: 1,
            },
          ],
        },
        {
          model: ProductVariation,
          as: "variation", // ⬅ đúng alias như model định nghĩa
          attributes: ["id", "name", "value", "price"],
        },
      ],
    });

    console.log('--- getCart Result (Backend) ---');
    cartItems.forEach(item => {
        console.log(`Cart Item: ID=${item.id}, Product ID=${item.product_id}, Variation ID=${item.variation_id}, Quantity=${item.quantity}`);
        if (item.product) {
            console.log(`  Product Name: ${item.product.name}`);
        }
        if (item.variation) {
            console.log(`  Variation Name: ${item.variation.name}, Value: ${item.variation.value}`);
        } else {
            console.log('  No variation associated with this cart item.');
        }
    });

    return res.status(200).json(cartItems);
  } catch (error) {
    console.error("Lỗi khi lấy giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// PUT /api/cart/update/:cart_item_id - Cập nhật số lượng sản phẩm trong giỏ hàng
exports.updateCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.cart_item_id; // <-- Lấy cart item ID từ URL
    const { quantity } = req.body; // <-- Lấy quantity trực tiếp từ body



    // Kiểm tra số lượng hợp lệ
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "Số lượng phải là số nguyên dương." });
    }

    // Tìm mục giỏ hàng cụ thể
    const cartItem = await Cart.findOne({
      where: {
        id: cartItemId, // <-- Tìm theo ID duy nhất của mục giỏ hàng
        user_id: userId,
        status: 0, // Giỏ hàng chưa thanh toán
      },
    });

    if (!cartItem) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm trong giỏ hàng." });
    }
    
    // Cập nhật số lượng
    cartItem.quantity = quantity;
    await cartItem.save();
    console.log('Updated cart item in DB:', cartItem.toJSON());
    return res
      .status(200)
      .json({ message: "Cập nhật số lượng sản phẩm thành công", cartItem });
  } catch (error) {
    console.error("Lỗi khi cập nhật giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi cập nhật giỏ hàng.", error: error.message });
  }
};

// DELETE /api/cart/:cart_item_id - Xoá sản phẩm khỏi giỏ
exports.removeFromCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cartItemId = req.params.cart_item_id; // <-- Lấy cart item ID từ URL




    const cartItem = await Cart.findOne({
      where: {
        id: cartItemId, // <-- Tìm theo ID duy nhất của mục giỏ hàng
        user_id: userId,
        status: 0,
      },
    });

    if (!cartItem) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm trong giỏ hàng." });
    }

    await cartItem.destroy();
    console.log('Cart item removed from DB:', cartItemId);
    return res
      .status(200)
      .json({ message: "Xoá sản phẩm khỏi giỏ thành công." });
  } catch (error) {
    console.error("Lỗi khi xoá giỏ hàng (Backend Error):", error);
    return res.status(500).json({ message: "Lỗi server khi xoá giỏ hàng.", error: error.message });
  }
};

// POST /api/cart/clear-selected-items - Xóa các mục giỏ hàng đã chọn sau khi đặt hàng
// Đây là hàm cho API clear-selected-items
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { selectedCartItemIds } = req.body; // <-- Chấp nhận mảng các ID của mục giỏ hàng


      if (
      !selectedCartItemIds ||
      !Array.isArray(selectedCartItemIds) ||
      selectedCartItemIds.length === 0
    ) {
      return res
        .status(200)
        .json({
          message: "Không có sản phẩm nào được chọn để xóa khỏi giỏ hàng.",
        });
    }

    // Xóa các mục giỏ hàng dựa trên mảng các ID được cung cấp
    await Cart.destroy({
      where: {
        user_id: userId,
        id: selectedCartItemIds, // <-- Xóa theo ID duy nhất của mục giỏ hàng
        status: 0,
      },
    });
    console.log('Selected cart items cleared from DB for user', userId, ':', selectedCartItemIds);

    return res
      .status(200)
      .json({
        message:
          "Đã xóa các sản phẩm được chọn khỏi giỏ hàng sau khi đặt hàng thành công.",
      });
  } catch (error) {
    console.error("Lỗi khi xóa các sản phẩm được chọn khỏi giỏ hàng (Backend Error):", error);
    return res
      .status(500)
      .json({ message: "Lỗi server khi xóa giỏ hàng", error: error.message });
  }
};

exports.deletePaidCartItems = async (req, res) => {
    const userId = req.user.id; // lấy từ verifyToken
    const {cartItemIds} = req.body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
        return res.status(400).json({message: "Danh sách sản phẩm không hợp lệ."});
    }

    try {
        const deleted = await Cart.destroy({
            where: {
                id: cartItemIds,
                user_id: userId,
                status: 0, // chỉ xóa sản phẩm chưa thanh toán
            },
        });

        return res.status(200).json({
            message: "Đã xóa sản phẩm đã thanh toán khỏi giỏ hàng.",
            deletedCount: deleted,
        });
    } catch (err) {
        console.error("Lỗi xóa cart:", err);
        return res.status(500).json({message: "Lỗi máy chủ khi xóa cart."});
    }
};



