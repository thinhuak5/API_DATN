// controllers/api/admin/productController.js
const { Product, ProductVariation, ProductImage, ProductVariationSpec, OrderItem } = require("../../../models");
const sequelize = require("../../../models/database");
const cloudinary = require("cloudinary").v2;

exports.getAll = async (req, res) => {
  try {
    const data = await Product.findAll({
      include: [
        {
          model: ProductVariation,
          as: "variations",
          include: [
            { model: ProductImage, as: "productImages", attributes: ["id", "image_url", "variations_id"] },
            { model: ProductVariationSpec, as: "specs", attributes: ["id", "label", "value", "sort_order"] },
          ],
        },
      ],
      order: [
        ["id", "DESC"],
        [{ model: ProductVariation, as: "variations" }, "id", "ASC"],
        [{ model: ProductVariation, as: "variations" }, { model: ProductImage, as: "productImages" }, "id", "ASC"],
        [{ model: ProductVariation, as: "variations" }, { model: ProductVariationSpec, as: "specs" }, "sort_order", "ASC"],
      ],
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
      include: [
        {
          model: ProductVariation,
          as: "variations",
          include: [
            { model: ProductImage, as: "productImages", attributes: ["id", "image_url", "variations_id"] },
            { model: ProductVariationSpec, as: "specs", attributes: ["id", "label", "value", "sort_order"] },
          ],
        },
      ],
      order: [
        [{ model: ProductVariation, as: "variations" }, "id", "ASC"],
        [{ model: ProductVariation, as: "variations" }, { model: ProductVariationSpec, as: "specs" }, "sort_order", "ASC"],
      ],
    });
    if (!product) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    return res.json(product);
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết sản phẩm:", error);
    return res.status(500).json({ error: "Lỗi server khi lấy chi tiết sản phẩm" });
  }
};

exports.create = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, description, price, discount_price, view, status, category_id, quantity, categoryparent_id, variations } = req.body;

    // 1) tạo product
    const newProduct = await Product.create(
      {
        name,
        description,
        price,
        discount_price,
        view: view || 0,
        status,
        category_id,
        quantity: quantity || 0,
        categoryparent_id,
      },
      { transaction: t }
    );

    // 2) parse variations
    const parsedVars = JSON.parse(variations || "[]");

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

    // 4) tạo từng biến thể + ảnh + specs
    for (let i = 0; i < parsedVars.length; i++) {
      const v = parsedVars[i];
      const createdVar = await ProductVariation.create(
        {
          product_id: newProduct.id,
          name: v.name,
          price: v.price !== "" ? parseFloat(v.price) : null,
          quantity: parseInt(v.quantity, 10) || 0,
          type: v.type || "regular",
        },
        { transaction: t }
      );

      // ảnh
      const bucket = filesMap[i] || [];
      if (bucket.length) {
        const imgs = bucket.map((file) => ({
          variations_id: createdVar.id,
          image_url: file.path,
        }));
        await ProductImage.bulkCreate(imgs, { transaction: t });
      }

      // specs
      if (Array.isArray(v.specs) && v.specs.length) {
        const specsPayload = v.specs.map((s) => ({
          variation_id: createdVar.id,
          label: s.label,
          value: s.value,
          sort_order: s.sort_order ?? 0,
        }));
        await ProductVariationSpec.bulkCreate(specsPayload, { transaction: t });
      }
    }

    await t.commit();
    return res.status(201).json({
      message: "Tạo sản phẩm + biến thể + ảnh + specs thành công!",
      product: newProduct,
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
        categoryparent_id,
      },
      { where: { id: productId }, transaction: t }
    );
    if (!updated) throw new Error("Không tìm thấy sản phẩm");

    // 2) Xóa ảnh sản phẩm/biến thể theo URL (nếu có)
    if (removedImages) {
      const toRemove = JSON.parse(removedImages || "[]");
      if (Array.isArray(toRemove) && toRemove.length) {
        for (let url of toRemove) {
          const publicId = url.split("/").pop().split(".")[0];
          await cloudinary.uploader.destroy(publicId).catch(() => {});
        }
        await ProductImage.destroy({ where: { image_url: toRemove }, transaction: t });
      }
    }

    // nhóm file mới theo biến thể
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

    // 3) Biến thể hiện có
    const oldVars = await ProductVariation.findAll({ where: { product_id: productId }, transaction: t });
    const oldVarIds = oldVars.map((v) => v.id);

    // 4) Parse biến thể mới
    const parsedVars = JSON.parse(variations || "[]");
    const newVarIds = parsedVars.filter((v) => v.id).map((v) => v.id);

    // 5) Xóa biến thể bị bỏ
    const toDeleteVarIds = oldVarIds.filter((id) => !newVarIds.includes(id));
    if (toDeleteVarIds.length) {
      await ProductImage.destroy({ where: { variations_id: toDeleteVarIds }, transaction: t });
      await ProductVariationSpec.destroy({ where: { variation_id: toDeleteVarIds }, transaction: t });
      await ProductVariation.destroy({ where: { id: toDeleteVarIds }, transaction: t });
    }

    // 6) Xóa ảnh biến thể theo chỉ định
    const removedVarImgsMap = JSON.parse(removedVariationImages || "{}");

    // 7) Upsert biến thể + ảnh + specs
    for (let i = 0; i < parsedVars.length; i++) {
      const v = parsedVars[i];

      if (v.id) {
        // update
        await ProductVariation.update(
          {
            name: v.name,
            price: v.price !== "" ? parseFloat(v.price) : null,
            quantity: parseInt(v.quantity, 10) || 0,
            type: v.type || "regular",
          },
          { where: { id: v.id, product_id: productId }, transaction: t }
        );

        // xóa ảnh chỉ định
        const toRem = removedVarImgsMap[i] || [];
        if (toRem.length) {
          for (let url of toRem) {
            const publicId = url.split("/").pop().split(".")[0];
            await cloudinary.uploader.destroy(publicId).catch(() => {});
          }
          await ProductImage.destroy({
            where: { variations_id: v.id, image_url: toRem },
            transaction: t,
          });
        }

        // thêm ảnh mới
        const bucket = filesMap[i] || [];
        if (bucket.length) {
          const imgs = bucket.map((f) => ({
            variations_id: v.id,
            image_url: f.path,
          }));
          await ProductImage.bulkCreate(imgs, { transaction: t });
        }

        // specs: xóa hết rồi tạo lại (đơn giản, an toàn)
        await ProductVariationSpec.destroy({ where: { variation_id: v.id }, transaction: t });
        if (Array.isArray(v.specs) && v.specs.length) {
          const specsPayload = v.specs.map((s) => ({
            variation_id: v.id,
            label: s.label,
            value: s.value,
            sort_order: s.sort_order ?? 0,
          }));
          await ProductVariationSpec.bulkCreate(specsPayload, { transaction: t });
        }
      } else {
        // create
        const createdVar = await ProductVariation.create(
          {
            product_id: productId,
            name: v.name,
            price: v.price !== "" ? parseFloat(v.price) : null,
            quantity: parseInt(v.quantity, 10) || 0,
            type: v.type || "regular",
          },
          { transaction: t }
        );

        // ảnh mới
        const bucket = filesMap[i] || [];
        if (bucket.length) {
          const imgs = bucket.map((f) => ({
            variations_id: createdVar.id,
            image_url: f.path,
          }));
          await ProductImage.bulkCreate(imgs, { transaction: t });
        }

        // specs
        if (Array.isArray(v.specs) && v.specs.length) {
          const specsPayload = v.specs.map((s) => ({
            variation_id: createdVar.id,
            label: s.label,
            value: s.value,
            sort_order: s.sort_order ?? 0,
          }));
          await ProductVariationSpec.bulkCreate(specsPayload, { transaction: t });
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

    const vars = await ProductVariation.findAll({
      where: { product_id: productId },
      include: [{ model: OrderItem, as: "orderItems", attributes: ["id"] }],
      transaction: t,
    });
    if (vars.some((v) => v.orderItems.length)) {
      throw new Error("Có biến thể đang nằm trong đơn hàng, không thể xóa.");
    }

    const varIds = vars.map((v) => v.id);
    if (varIds.length) {
      await ProductImage.destroy({ where: { variations_id: varIds }, transaction: t });
      await ProductVariationSpec.destroy({ where: { variation_id: varIds }, transaction: t });
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
