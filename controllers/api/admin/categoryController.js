const categoryModel = require('../../../models/category');
const { Op } = require("sequelize");

// Lấy tất cả danh mục (bao gồm cả cha và con)
exports.getAll = async (req, res, next) => {
  try {
    const data = await categoryModel.findAll();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Lấy tất cả danh mục cha (parent_id = NULL)
exports.getAllParents = async (req, res, next) => {
  try {
    const data = await categoryModel.findAll({
      where: { parent_id: null }
    });
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server khi lấy danh mục cha" });
  }
};

// Lấy danh mục con theo id danh mục cha
exports.getByParent = async (req, res, next) => {
  try {
    const parentId = req.params.parent_id;  // Sử dụng parent_id chứ không phải categoryparent_id nữa!
    const data = await categoryModel.findAll({
      where: { parent_id: parentId }
    });
    res.json(data);
  } catch (error) {
    console.error("Lỗi chi tiết getByParent:", error);
    res.status(500).json({ error: "Lỗi server khi lấy danh mục con theo danh mục cha" });
  }
};

// Lấy chi tiết danh mục theo id
exports.detail = async (req, res, next) => {
  try {
    const category = await categoryModel.findByPk(req.params.id);
    if (!category) {
      // Trả về lỗi nếu không tìm thấy
      return res.status(404).json({ error: "Không tìm thấy danh mục" });
    }
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Lỗi server" });
  }
};

// Thêm mới danh mục (cha hoặc con đều dùng hàm này, nếu tạo cha thì không gửi parent_id)
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

// Cập nhật danh mục
// Cập nhật danh mục
exports.update = async (req, res, next) => {
  try {
    const data = req.body;
    // Không cho phép parent_id = id chính nó!
    if (data.parent_id && String(data.parent_id) === String(req.params.id)) {
      return res.status(400).json({ error: "Không thể chọn chính nó làm danh mục cha!" });
    }
    if (req.file) {
      data.images = req.file.path;
    }
    const [updated] = await categoryModel.update(data, {
      where: { id: req.params.id }
    });
    if (updated === 0) {return res.status(404).json({ error: "Danh mục không tìm thấy" });
    }
    res.json({ message: "Cập nhật danh mục thành công" });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Lỗi server" });
  }
};


// Xóa danh mục
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