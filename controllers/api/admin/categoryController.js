// controllers/api/admin/categoryController.js
const categoryModel = require('../../../models/category');
const { Op } = require("sequelize");

/**
 * Trả về TẤT CẢ danh mục (cha + con)
 * Dùng cho ADMIN và PUBLIC khi FE cần đủ dữ liệu để build cây
 */
exports.getAll = async (req, res, next) => {
  try {
    const data = await categoryModel.findAll();
    // Trả về mảng thô cho FE dễ dùng
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

/**
 * Trả về tất cả danh mục CHA (parent_id = NULL)
 * Hữu ích khi cần chỉ danh mục gốc
 */
exports.getAllParents = async (req, res, next) => {
  try {
    const data = await categoryModel.findAll({
      where: { parent_id: null }
    });
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server khi lấy danh mục cha" });
  }
};

/**
 * Trả về tất cả danh mục CON theo id cha
 */
exports.getByParent = async (req, res, next) => {
  try {
    const parentId = req.params.parent_id;
    const data = await categoryModel.findAll({
      where: { parent_id: parentId }
    });
    res.json(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error("Lỗi chi tiết getByParent:", error);
    res.status(500).json({ error: "Lỗi server khi lấy danh mục con theo danh mục cha" });
  }
};

/**
 * Trả về chi tiết 1 danh mục
 */
exports.detail = async (req, res, next) => {
  try {
    const category = await categoryModel.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

/**
 * Thêm mới danh mục (cha hoặc con: nếu tạo cha thì không gửi parent_id)
 */
exports.create = async (req, res, next) => {
  try {
    const data = req.body;
    if (req.file) {
      data.images = req.file.path;
    }
    if (!data.name || typeof data.status === 'undefined') {
      return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc" });
    }
    // parent_id có thể là null hoặc là id cha
    const category = await categoryModel.create(data);
    res.json({ message: "Danh mục đã được tạo thành công", category });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

/**
 * Cập nhật danh mục
 */
exports.update = async (req, res, next) => {
  try {
    const data = req.body;

    // Không cho phép tự làm cha của chính mình
    if (data.parent_id && String(data.parent_id) === String(req.params.id)) {
      return res.status(400).json({ error: "Không thể chọn chính nó làm danh mục cha!" });
    }

    if (req.file) {
      data.images = req.file.path;
    }

    const [updated] = await categoryModel.update(data, {
      where: { id: req.params.id }
    });

    if (updated === 0) {
      return res.status(404).json({ error: "Danh mục không tìm thấy" });
    }

    res.json({ message: "Cập nhật danh mục thành công" });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

/**
 * Xoá danh mục
 */
exports.delete = async (req, res, next) => {
  try {
    await categoryModel.destroy({
      where: { id: req.params.id }
    });
    res.json({ message: "Danh mục đã được xóa thành công!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
  }
};
