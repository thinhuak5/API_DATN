const {
  Product,
  ProductImage,
  ProductVariation,
  OrderItem,
} = require("../../../models"); // Đảm bảo import đúng các models
const sequelize = require("../../../models/database"); // Import sequelize instance cho transaction

exports.getAll = async (req, res, next) => {
  try {
    const data = await Product.findAll({
      include: [{ model: ProductImage, as: "productImages" }],
    });
    res.json(data); // Đổi sang trả về JSON để test API, hoặc dùng res.render nếu có view
  } catch (error) {
    console.error("Lỗi khi lấy tất cả sản phẩm:", error);
    res.status(500).json({ error: "Lỗi server khi lấy danh sách sản phẩm" });
  }
};

exports.detail = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: ProductImage, as: "productImages" },
        { model: ProductVariation, as: "variations" },
      ],
    });
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }
    res.json(product);
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
    res.status(500).json({ error: "Lỗi server khi lấy chi tiết sản phẩm" });
  }
};

exports.create = async (req, res) => {
  let newProduct = null;
  const t = await sequelize.transaction(); // Bắt đầu transaction
  try {
    const {
      name,
      description,
      price,
      discount_price,
      view,
      status,
      category_id,
      quantity,
      minStock,
      categoryparent_id,
      variations, // Chuỗi JSON từ FE
      imageUrls, // <-- nhận từ middleware router (nếu có)
    } = req.body;

    const uploadedFiles = req.files; // Multer sẽ là mảng file

    // Tạo sản phẩm chính
    newProduct = await Product.create(
      {
        name,
        description,
        price,
        discount_price,
        view: view || 0,
        status,
        category_id,
        quantity: quantity || 0,
        minStock: minStock || 0,
        categoryparent_id,
      },
      { transaction: t }
    );

    // Lưu nhiều hình ảnh (ưu tiên lấy từ imageUrls nếu có, fallback sang req.files)
    let productImages = [];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      productImages = imageUrls.map((url) => ({
        product_id: newProduct.id,
        image_url: url,
      }));
    } else if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
      productImages = uploadedFiles.map((file) => ({
        product_id: newProduct.id,
        image_url: file.path, // Cloudinary trả về file.path là URL
      }));
    }
    if (productImages.length > 0) {
      await ProductImage.bulkCreate(productImages, { transaction: t });
    }

    // Lưu nhiều biến thể
    if (variations) {
      let parsedVariations = [];
      try {
        parsedVariations = JSON.parse(variations);
      } catch (e) {
        throw new Error("Dữ liệu biến thể không hợp lệ!"); // Ném lỗi để transaction rollback
      }
      if (Array.isArray(parsedVariations) && parsedVariations.length > 0) {
        const productVariations = parsedVariations.map((variant) => ({
          product_id: newProduct.id,
          name: variant.name,
          value: variant.value,
          price: variant.price !== "" ? parseFloat(variant.price) : null,
          quantity: parseInt(variant.quantity, 10) || 0,
          minStock:
            variant.minStock !== undefined ? parseInt(variant.minStock, 10) : 0,
          type: variant.type || "regular",
        }));
        await ProductVariation.bulkCreate(productVariations, {
          transaction: t,
        });
      }
    }

    await t.commit(); // Commit transaction nếu mọi thứ thành công
    res.status(200).json({
      message: "Sản phẩm, hình ảnh và biến thể đã được thêm thành công!",
      product: newProduct,
      images: productImages.map((img) => img.image_url), // trả về danh sách URL ảnh
    });
  } catch (err) {
    await t.rollback(); // Rollback transaction nếu có lỗi
    console.error("Lỗi tạo sản phẩm:", err);
    res.status(500).json({
      error: "Đã xảy ra lỗi khi thêm sản phẩm và các thuộc tính liên quan",
      details: err.message,
    });
  }
};

exports.update = async (req, res) => {
  const t = await sequelize.transaction(); // Bắt đầu transaction
  try {
    const {
      name,
      description,
      price,
      discount_price,
      view,
      status,
      category_id,
      quantity,
      minStock,
      categoryparent_id,
      variations, // Dữ liệu biến thể từ frontend, cần chứa 'id' cho biến thể hiện có
      removed_images, // Các URL ảnh cần xóa
      imageUrls, // <-- nhận từ middleware router (nếu có)
    } = req.body;

    const productId = req.params.id;

    // 1. Cập nhật sản phẩm chính
    const [updated] = await Product.update(
      {
        name,
        description,
        price,
        discount_price,
        view,
        status,
        category_id,
        quantity,
        minStock,
        categoryparent_id,
      },
      { where: { id: productId }, transaction: t }
    );

    if (!updated) {
      await t.rollback();
      return res.status(404).json({ error: "Sản phẩm không tìm thấy" });
    }

    // 2. Xử lý ảnh: Xóa ảnh bị xóa, thêm ảnh mới
    if (removed_images) {
      const removedArr = JSON.parse(removed_images);
      if (Array.isArray(removedArr) && removedArr.length > 0) {
        await ProductImage.destroy({
          where: {
            product_id: productId,
            image_url: removedArr,
          },
          transaction: t,
        });
      }
    }

    const uploadedFiles = req.files;
    let productImages = [];
    if (Array.isArray(imageUrls) && imageUrls.length > 0) {
      productImages = imageUrls.map((url) => ({
        product_id: productId,
        image_url: url,
      }));
    } else if (Array.isArray(uploadedFiles) && uploadedFiles.length > 0) {
      productImages = uploadedFiles.map((file) => ({
        product_id: productId,
        image_url: file.path, // Cloudinary trả về file.path là URL
      }));
    }
    if (productImages.length > 0) {
      await ProductImage.bulkCreate(productImages, { transaction: t });
    }

    // 3. Cập nhật biến thể: Cập nhật biến thể hiện có, tạo mới và xóa biến thể không còn
    if (variations) {
      let parsedVariations = [];
      try {
        parsedVariations = JSON.parse(variations);
      } catch (e) {
        throw new Error("Dữ liệu biến thể không hợp lệ!");
      }

      const existingVariations = await ProductVariation.findAll({
        where: { product_id: productId },
        transaction: t,
      });

      const variationsToCreate = [];
      const variationIdsToKeep = new Set();

      for (const incomingVariant of parsedVariations) {
        if (incomingVariant.id) {
          // Nếu có ID, đây là biến thể hiện có cần cập nhật
          variationIdsToKeep.add(incomingVariant.id);
          await ProductVariation.update(
            {
              name: incomingVariant.name,
              value: incomingVariant.value,
              price:
                incomingVariant.price !== ""
                  ? parseFloat(incomingVariant.price)
                  : null,
              quantity: parseInt(incomingVariant.quantity, 10) || 0,
              minStock:
                incomingVariant.minStock !== undefined
                  ? parseInt(incomingVariant.minStock, 10)
                  : 0,
              type: incomingVariant.type || "regular",
            },
            {
              where: { id: incomingVariant.id, product_id: productId },
              transaction: t,
            }
          );
        } else {
          // Nếu không có ID, đây là biến thể mới cần tạo
          variationsToCreate.push({
            product_id: productId,
            name: incomingVariant.name,
            value: incomingVariant.value,
            price:
              incomingVariant.price !== ""
                ? parseFloat(incomingVariant.price)
                : null,
            quantity: parseInt(incomingVariant.quantity, 10) || 0,
            minStock:
              incomingVariant.minStock !== undefined
                ? parseInt(incomingVariant.minStock, 10)
                : 0,
            type: incomingVariant.type || "regular",
          });
        }
      }

      if (variationsToCreate.length > 0) {
        await ProductVariation.bulkCreate(variationsToCreate, {
          transaction: t,
        });
      }

      // Tìm các biến thể hiện có trong DB nhưng không có trong dữ liệu gửi lên (cần xóa)
      const variationIdsToDelete = existingVariations
        .filter(
          (existingVariant) => !variationIdsToKeep.has(existingVariant.id)
        )
        .map((existingVariant) => existingVariant.id);

      if (variationIdsToDelete.length > 0) {
        // Kiểm tra xem các biến thể cần xóa có liên kết với OrderItem hay không
        const variationsLinkedToOrders = await ProductVariation.findAll({
          where: {
            id: variationIdsToDelete,
          },
          include: [
            {
              model: OrderItem,
              as: "orderItems",
              attributes: ["id"],
            },
          ],
          transaction: t,
        });

        const undeletableVariationIds = variationsLinkedToOrders
          .filter((v) => v.orderItems && v.orderItems.length > 0)
          .map((v) => v.id);

        const actuallyDeletableVariationIds = variationIdsToDelete.filter(
          (id) => !undeletableVariationIds.includes(id)
        );

        if (undeletableVariationIds.length > 0) {
          await t.rollback();
          const details = variationsLinkedToOrders
            .filter((v) => v.orderItems && v.orderItems.length > 0)
            .map((v) => ({ id: v.id, name: v.name, value: v.value }));

          return res.status(400).json({
            error:
              "Không thể xóa một số biến thể vì chúng được liên kết với các đơn hàng hiện có.",
            details: details,
          });
        }

        // Chỉ xóa những biến thể không có liên kết với đơn hàng
        if (actuallyDeletableVariationIds.length > 0) {
          await ProductVariation.destroy({
            where: { id: actuallyDeletableVariationIds },
            transaction: t,
          });
        }
      }
    }

    await t.commit(); // Commit transaction nếu mọi thứ thành công
    res
      .status(200)
      .json({
        message: "Cập nhật sản phẩm thành công!",
        images: productImages.map((img) => img.image_url),
      });
  } catch (error) {
    await t.rollback(); // Rollback transaction nếu có lỗi
    console.error("Lỗi cập nhật sản phẩm:", error);
    res.status(500).json({
      error: "Đã xảy ra lỗi khi cập nhật sản phẩm",
      details: error.message,
    });
  }
};

exports.delete = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const productId = req.params.id;

    // 1. Kiểm tra xem có biến thể nào của sản phẩm này đang có trong OrderItem không
    const variationsInOrders = await ProductVariation.findAll({
      where: { product_id: productId },
      include: [
        {
          model: OrderItem,
          as: "orderItems", // <-- Đảm bảo alias này khớp với association
          attributes: ["id"],
        },
      ],
      transaction: t,
    });

    const hasLinkedVariations = variationsInOrders.some(
      (v) => v.orderItems && v.orderItems.length > 0
    );

    if (hasLinkedVariations) {
      await t.rollback();
      const linkedVariationDetails = variationsInOrders
        .filter((v) => v.orderItems && v.orderItems.length > 0)
        .map((v) => ({ id: v.id, name: v.name, value: v.value }));

      return res.status(400).json({
        error:
          "Không thể xóa sản phẩm này. Một hoặc nhiều biến thể của nó đang tồn tại trong các đơn hàng đã đặt.",
        details: linkedVariationDetails,
      });
    }

    // Nếu không có biến thể nào liên quan đến đơn hàng, tiến hành xóa
    await ProductImage.destroy({
      where: { product_id: productId },
      transaction: t,
    });

    await ProductVariation.destroy({
      where: { product_id: productId },
      transaction: t,
    });

    const deletedRowCount = await Product.destroy({
      where: { id: productId },
      transaction: t,
    });

    if (deletedRowCount === 0) {
      await t.rollback();
      return res
        .status(404)
        .json({ message: "Không tìm thấy sản phẩm để xóa." });
    }

    await t.commit();
    res.json({
      message: "Sản phẩm và các dữ liệu liên quan đã được xóa thành công!",
    });
  } catch (error) {
    await t.rollback();
    console.error("Lỗi khi xóa sản phẩm:", error);
    res.status(500).json({
      error: "Đã xảy ra lỗi khi xóa sản phẩm.",
      details: error.message,
    });
  }
};
