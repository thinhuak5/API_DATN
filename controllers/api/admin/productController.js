// controllers/api/admin/productController.js

const { Product, ProductVariation, ProductImage, OrderItem } = require("../../../models");
const sequelize = require("../../../models/database");
const cloudinary = require('cloudinary').v2;
exports.getAll = async (req, res) => {
  try {
    const data = await Product.findAll({
      include: [{
        model: ProductVariation,
        as: "variations",
        include: [{
          model: ProductImage,
          as: "productImages",
          attributes: ["id","image_url","variations_id"]
        }]
      }]
    });
    return res.json(data);
  } catch (error) {
    console.error("Lỗi khi lấy tất cả sản phẩm:", error);
    return res.status(500).json({ error: "Lỗi server khi lấy danh sách sản phẩm" });
  }
};

exports.detail = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{
        model: ProductVariation,
        as: "variations",
        include: [{
          model: ProductImage,
          as: "productImages",
          attributes: ["id","image_url","variations_id"]
        }]
      }]
    });
    if (!product) {
      return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    }
    return res.json(product);
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
    return res.status(500).json({ error: "Lỗi server khi lấy chi tiết sản phẩm" });
  }
};

exports.create = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      name, description, price, discount_price,
      view, status, category_id, quantity, minStock, categoryparent_id,
      variations  // JSON string
    } = req.body;

    // 1) tạo product
    const newProduct = await Product.create({
      name, description, price, discount_price,
      view: view || 0, status,
      category_id, quantity: quantity || 0,
      min_stock: minStock || 0, categoryparent_id
    }, { transaction: t });

    // 2) parse metadata
    const parsedVars = JSON.parse(variations);

    // 3) nhóm file upload theo variation_idx
    const files = req.files || [];
    const idxs  = req.body.variation_idx || [];
    const filesMap = {};
    if (files.length) {
      const arrIdx = Array.isArray(idxs) ? idxs : [idxs];
      arrIdx.forEach((idxStr, i) => {
        const idxNum = parseInt(idxStr, 10);
        filesMap[idxNum] = filesMap[idxNum] || [];
        filesMap[idxNum].push(files[i]);
      });
    }

    // 4) tạo từng biến thể + ảnh đi kèm
    for (let i = 0; i < parsedVars.length; i++) {
      const v = parsedVars[i];
      const createdVar = await ProductVariation.create({
        product_id: newProduct.id,
        name:  v.name,
        value: v.value,
        price: v.price !== "" ? parseFloat(v.price) : null,
        quantity: parseInt(v.quantity,10) || 0,
        min_stock: parseInt(v.minStock,10) || 0,
        type: v.type || "regular"
      }, { transaction: t });

      const bucket = filesMap[i] || [];
      if (bucket.length) {
        const imgs = bucket.map(file => ({
          variations_id: createdVar.id,
          image_url:     file.path
        }));
        await ProductImage.bulkCreate(imgs, { transaction: t });
      }
    }

    await t.commit();
    return res.status(201).json({
      message: "Tạo sản phẩm + biến thể + ảnh thành công!",
      product: newProduct
    });

  } catch (err) {
    await t.rollback();
    console.error("Lỗi tạo sản phẩm:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const t = await sequelize.transaction();
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
      variations, // JSON string, mỗi biến thể có thể có mảng removedImages
      removedImages, // Mảng URLs ảnh cần xóa
      removedVariationImages, // JSON string object { idx: [url1, url2], … }
    } = req.body;
    const productId = req.params.id;

    // 1) Cập nhật thông tin sản phẩm
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
        min_stock: minStock,
        categoryparent_id,
      },
      { where: { id: productId }, transaction: t }
    );
    if (!updated) throw new Error("Không tìm thấy sản phẩm");

    // 2) Xóa ảnh sản phẩm cũ đã được yêu cầu xóa
    if (removedImages) {
      const toRemove = JSON.parse(removedImages); // Mảng URL ảnh cần xóa
      if (toRemove.length) {
        // Xóa ảnh khỏi Cloudinary
        for (let url of toRemove) {
          const publicId = url.split('/').pop().split('.')[0]; // Lấy public_id từ URL
          await cloudinary.uploader.destroy(publicId); // Xóa ảnh trên Cloudinary
        }

        // Sau khi xóa ảnh trên Cloudinary, xóa ảnh khỏi cơ sở dữ liệu
        await ProductImage.destroy({
          where: {
            image_url: toRemove, // URL ảnh cần xóa
          },
          transaction: t,
        });
      }
    }

    // 3) Nhóm file mới upload
    const files = req.files || [];
    const idxs = req.body.variation_idx || [];
    const filesMap = {};
    if (files.length) {
      const arrIdx = Array.isArray(idxs) ? idxs : [idxs];
      arrIdx.forEach((idxStr, i) => {
        const idxNum = parseInt(idxStr, 10);
        filesMap[idxNum] = filesMap[idxNum] || [];
        filesMap[idxNum].push(files[i]);
      });
    }

    // 4) Cập nhật hoặc tạo mới biến thể
    const parsedVars = JSON.parse(variations || "[]");
    const removedVarImgsMap = JSON.parse(removedVariationImages || "{}");

    // Lấy tất cả các biến thể hiện tại để biết ID
    const existingVars = await ProductVariation.findAll({
      where: { product_id: productId },
      transaction: t,
    });

    for (let i = 0; i < parsedVars.length; i++) {
      const v = parsedVars[i];
      if (v.id) {
        // Cập nhật biến thể
        await ProductVariation.update(
          {
            name: v.name,
            value: v.value,
            price: v.price !== "" ? parseFloat(v.price) : null,
            quantity: parseInt(v.quantity, 10) || 0,
            min_stock: parseInt(v.minStock, 10) || 0,
            type: v.type || "regular",
          },
          {
            where: { id: v.id, product_id: productId },
            transaction: t,
          }
        );

        // Xóa ảnh biến thể cũ nếu người dùng chọn xóa
        const toRem = removedVarImgsMap[i] || [];
        if (toRem.length) {
          // Xóa ảnh khỏi Cloudinary
          for (let url of toRem) {
            const publicId = url.split('/').pop().split('.')[0]; // Lấy public_id từ URL
            await cloudinary.uploader.destroy(publicId); // Xóa ảnh trên Cloudinary
          }

          // Sau khi xóa ảnh trên Cloudinary, xóa ảnh khỏi cơ sở dữ liệu
          await ProductImage.destroy({
            where: {
              variations_id: v.id,
              image_url: toRem, // URL ảnh cần xóa
            },
            transaction: t,
          });
        }

        // Thêm ảnh mới cho biến thể
        const bucket = filesMap[i] || [];
        if (bucket.length) {
          const imgs = bucket.map((f) => ({
            variations_id: v.id,
            image_url: f.path,
          }));
          await ProductImage.bulkCreate(imgs, { transaction: t });
        }
      }
    }

    await t.commit();
    return res.json({ message: "Cập nhật thành công!" });
  } catch (err) {
    await t.rollback();
    console.error("Lỗi cập nhật sản phẩm:", err);
    return res.status(400).json({ error: err.message });
  }
};


exports.delete = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const productId = req.params.id;

    // 1) ensure no variation in orders
    const vars = await ProductVariation.findAll({
      where:{ product_id: productId },
      include:[{ model: OrderItem, as:'orderItems', attributes:['id'] }],
      transaction: t
    });
    if (vars.some(v=>v.orderItems.length)) {
      throw new Error("Có biến thể đang nằm trong đơn hàng, không thể xóa.");
    }

    // 2) delete images, variations, product
    const varIds = vars.map(v=>v.id);
    if (varIds.length) {
      await ProductImage.destroy({ where:{ variations_id: varIds }, transaction: t });
      await ProductVariation.destroy({ where:{ id: varIds },       transaction: t });
    }
    const deleted = await Product.destroy({ where:{ id: productId }, transaction: t });
    if (!deleted) throw new Error("Không tìm thấy sản phẩm.");

    await t.commit();
    return res.json({ message: "Xóa sản phẩm thành công!" });

  } catch (err) {
    await t.rollback();
    console.error("Lỗi xóa sản phẩm:", err);
    return res.status(400).json({ error: err.message });
  }
};
