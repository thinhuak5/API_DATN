const productModel = require('../../models/product');
const ProductImage = require('../../models/productImage');
const ProductVariation = require('../../models/productVariation');
const { Op } = require("sequelize");

exports.getAll = async (req, res, next) => {
  const data = await Product.findAll({
    include: [{ model: ProductImage, as: "productImages" }],
  });
  res.json(data); // Đổi sang trả về JSON để test API, hoặc dùng res.render nếu có view
};

exports.detail = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: ProductImage, as: "productImages" },
        { model: ProductVariation, as: "variations" },
      ],
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server" });
  }
};