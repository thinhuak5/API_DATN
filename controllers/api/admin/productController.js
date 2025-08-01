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
          attributes: ["id", "image_url", "variations_id"]
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
          attributes: ["id", "image_url", "variations_id"]
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

    // 4) tạo từng biến thể + ảnh đi kèm
    for (let i = 0; i < parsedVars.length; i++) {
      const v = parsedVars[i];
      const createdVar = await ProductVariation.create({
        product_id: newProduct.id,
        name: v.name,
        value: v.value,
        price: v.price !== "" ? parseFloat(v.price) : null,
        quantity: parseInt(v.quantity, 10) || 0,
        min_stock: parseInt(v.min_stock ?? v.minStock ?? 0, 10) || 0,
        type: v.type || "regular"
      }, { transaction: t });

      const bucket = filesMap[i] || [];
      if (bucket.length) {
        const imgs = bucket.map(file => ({
          variations_id: createdVar.id,
          image_url: file.path
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


// ⚡️UPDATE — ĐÃ THÊM xử lý XÓA BIẾN THỂ khi cập nhật
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
      variations, // JSON string
      removedImages, // JSON string array of URLs
      removedVariationImages, // JSON string: { idx: [url1, url2] }
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
      const toRemove = JSON.parse(removedImages);
      if (Array.isArray(toRemove) && toRemove.length) {
        for (let url of toRemove) {
          const publicId = url.split('/').pop().split('.')[0];
          await cloudinary.uploader.destroy(publicId).catch(()=>{});
        }
        await ProductImage.destroy({
          where: {
            image_url: toRemove,
          },
          transaction: t,
        });
      }
    }

    // 3) Nhóm file mới upload theo biến thể (theo index biến thể trong mảng)
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

    // 4) Lấy biến thể hiện có trên DB
    const oldVars = await ProductVariation.findAll({ where: { product_id: productId }, transaction: t });
    const oldVarIds = oldVars.map(v => v.id);

    // 5) Parse biến thể gửi lên từ FE
    const parsedVars = JSON.parse(variations || "[]");
    const newVarIds = parsedVars.filter(v => v.id).map(v => v.id);

    // 6) Xác định biến thể bị xóa (id cũ mà không còn trong newVarIds)
    const toDeleteVarIds = oldVarIds.filter(id => !newVarIds.includes(id));
    if (toDeleteVarIds.length) {
      // Xóa ảnh của biến thể bị xóa
      await ProductImage.destroy({ where: { variations_id: toDeleteVarIds }, transaction: t });
      // Xóa biến thể
      await ProductVariation.destroy({ where: { id: toDeleteVarIds }, transaction: t });
    }

    // 7) Xử lý xóa ảnh biến thể (được chỉ định cụ thể)
    const removedVarImgsMap = JSON.parse(removedVariationImages || "{}");

    // 8) Cập nhật hoặc tạo mới biến thể, thêm ảnh nếu có
    for (let i = 0; i < parsedVars.length; i++) {
      const v = parsedVars[i];
      if (v.id) {
        // Cập nhật biến thể cũ
        await ProductVariation.update(
            {
              name: v.name,
              value: v.value,
              price: v.price !== "" ? parseFloat(v.price) : null,
              quantity: parseInt(v.quantity, 10) || 0,
              min_stock: parseInt(v.min_stock ?? v.minStock ?? 0, 10) || 0,
              type: v.type || "regular",
            },
            {
              where: { id: v.id, product_id: productId },
              transaction: t,
            }
        );
        // Xóa ảnh biến thể nếu có yêu cầu xóa
        const toRem = removedVarImgsMap[i] || [];
        if (toRem.length) {
          for (let url of toRem) {
            const publicId = url.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(publicId).catch(()=>{});
          }
          await ProductImage.destroy({
            where: {
              variations_id: v.id,
              image_url: toRem,
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
      } else {
        // Tạo mới biến thể
        const createdVar = await ProductVariation.create({
          product_id: productId,
          name: v.name,
          value: v.value,
          price: v.price !== "" ? parseFloat(v.price) : null,
          quantity: parseInt(v.quantity, 10) || 0,
          min_stock: parseInt(v.min_stock ?? v.minStock ?? 0, 10) || 0,
          type: v.type || "regular",
        }, { transaction: t });
        // Thêm ảnh mới cho biến thể
        const bucket = filesMap[i] || [];
        if (bucket.length) {
          const imgs = bucket.map((f) => ({
            variations_id: createdVar.id,
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
      where: { product_id: productId },
      include: [{ model: OrderItem, as: 'orderItems', attributes: ['id'] }],
      transaction: t
    });
    if (vars.some(v => v.orderItems.length)) {
      throw new Error("Có biến thể đang nằm trong đơn hàng, không thể xóa.");
    }

    // 2) delete images, variations, product
    const varIds = vars.map(v => v.id);
    if (varIds.length) {
      await ProductImage.destroy({ where: { variations_id: varIds }, transaction: t });
      await ProductVariation.destroy({ where: { id: varIds }, transaction: t });
    }
    const deleted = await Product.destroy({ where: { id: productId }, transaction: t });
    if (!deleted) throw new Error("Không tìm thấy sản phẩm.");

    await t.commit();
    return res.json({ message: "Xóa sản phẩm thành công!" });

  } catch (err) {
    await t.rollback();
    console.error("Lỗi xóa sản phẩm:", err);
    return res.status(400).json({ error: err.message });
  }
};
