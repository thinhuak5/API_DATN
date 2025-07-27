const Product = require('../../models/product');
const ProductImage = require('../../models/productImage');
const ProductVariation = require('../../models/productVariation');
const { Op } = require("sequelize");

exports.getAll = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      include: [
        {
          model: ProductImage,
          as: "productImages", // Lấy thông tin về các ảnh của sản phẩm
          attributes: ["id", "image_url"], // Lấy id và URL ảnh
        }
      ]
    });
    
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Lỗi server khi lấy danh sách sản phẩm" });
  }
};

exports.detail = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        {
          model: ProductImage,
          as: "productImages", // Lấy thông tin ảnh của sản phẩm
          attributes: ["id", "image_url"], // Lấy id và URL ảnh
        },
        {
          model: ProductVariation,
          as: "variations", // Lấy thông tin biến thể của sản phẩm
          include: [
            {
              model: ProductImage,
              as: "productImages", // Lấy ảnh cho từng biến thể
              attributes: ["id", "image_url"], // Lấy URL ảnh cho biến thể
            }
          ]
        }
      ]
    });

    // Nếu không tìm thấy sản phẩm
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tìm thấy" });
    }

    // Trả về thông tin chi tiết sản phẩm
    res.json(product);
  } catch (error) {
    // Trả lỗi server nếu có lỗi xảy ra
    res.status(500).json({ error: "Lỗi server khi lấy chi tiết sản phẩm" });
  }
};
