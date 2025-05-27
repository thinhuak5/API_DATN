const categoryParentModel = require('../../../models/categoryparent');
const { Op } = require("sequelize");

// Lấy tất cả category parent
exports.getAll = async (req, res, next) => {
    try {
        const data = await categoryParentModel.findAll();
        res.json(data);
        console.log("Dữ liệu nhận được:", data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi server khi lấy category parent" });
    }
     
};

// Chi tiết category parent
exports.detail = async (req, res, next) => {
    try {
        const categoryParent = await categoryParentModel.findByPk(req.params.id);
        res.json(categoryParent);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi server" });
    }
};

// Thêm mới category parent
exports.create = async (req, res, next) => {
    try {
        const data = req.body;

        if (req.file) {
            data.image = req.file.filename;
        }

        if (!data.name || typeof data.status === 'undefined') {
            return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc" });
        }

        const categoryParent = await categoryParentModel.create(data);
        res.json({ message: "Danh mục cha đã được tạo thành công", categoryParent });
    } catch (error) {
        console.error("Error creating category parent:", error);
        res.status(500).json({ error: "Lỗi server" });
    }
};

// Cập nhật category parent
exports.update = async (req, res, next) => {
    try {
        const data = req.body;

        if (req.file) {
            data.image = req.file.filename;
        }

        const [updated] = await categoryParentModel.update(data, {
            where: { id: req.params.id }
        });

        if (updated === 0) {
            return res.status(404).json({ error: "Danh mục cha không tìm thấy" });
        }

        res.json({ message: "Cập nhật danh mục cha thành công" });
    } catch (error) {
        console.error("Error updating category parent:", error);
        res.status(500).json({ error: "Lỗi server" });
    }
};

// Xóa category parent
exports.delete = async (req, res, next) => {
    try {
        const deleted = await categoryParentModel.destroy({
            where: { id: req.params.id }
        });
        res.json({ message: "Danh mục cha đã được xóa thành công!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Lỗi server" });
    }
};
