const categoryModel = require('../../../models/category');
const {Op} = require("sequelize");

// Lấy tất cả danh mục
exports.getAll = async (req, res, next) => {
  try {
    const data = await categoryModel.findAll();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Lỗi server"});
  }
};

// Lấy danh mục con theo danh mục cha (theo parent_id của category = id của categoryparent)
exports.getByParent = async (req, res, next) => {
  try {
    const parentId = req.params.categoryparent_id;
    // Đây phải là parent_id chứ không phải categoryparent_id
    const data = await categoryModel.findAll({
      where: {
        parent_id: parentId,  // <-- sửa chỗ này
      }
    });
    res.json(data);
  } catch (error) {
    console.error("Lỗi chi tiết getByParent:", error);
    res.status(500).json({error: "Lỗi server khi lấy danh mục con theo danh mục cha"});
  }
};

exports.detail = async (req, res, next) => {
  try {
    const category = await categoryModel.findByPk(req.params.id);
    res.json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Lỗi server"});
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = req.body;
    if (req.file) {
      data.images = req.file.filename;
    }
    if (!data.name || typeof data.status === 'undefined') {
      return res.status(400).json({error: "Thiếu dữ liệu bắt buộc"});
    }
    const category = await categoryModel.create(data);
    res.json({message: "Danh mục đã được tạo thành công", category});
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({error: "Lỗi server"});
  }
};

exports.update = async (req, res, next) => {
  try {
    const data = req.body;
    if (req.file) {
      data.images = req.file.filename;
    }
    const [updated] = await categoryModel.update(data, {
      where: {id: req.params.id}
    });
    if (updated === 0) {
      return res.status(404).json({error: "Danh mục không tìm thấy"});
    }
    res.json({message: "Cập nhật danh mục thành công"});
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({error: "Lỗi server"});
  }
};

exports.delete = async (req, res, next) => {
  try {
    await categoryModel.destroy({
      where: {id: req.params.id},
    });
    res.json({message: "Danh mục đã được xóa thành công!"});
  } catch (error) {
    console.error(error);
    res.status(500).json({error: "Lỗi server"});
  }
};