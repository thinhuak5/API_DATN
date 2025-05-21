const categoryModel = require('../../../models/category');
const {Op} = require("sequelize");

exports.getAll = async (req, res, next) => {
    try {
        const data = await categoryModel.findAll();
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Lỗi server"});
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
        const { name, status, parent_id } = req.body;
        const image = req.file ? req.file.filename : null;

        if (!name || typeof status === 'undefined') {
            return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc" });
        }

        const category = await categoryModel.create({
            name,
            status,
            images: image,
             parent_id: parent_id || null,
        });

        res.json({ message: "Danh mục đã được tạo thành công", category });
    } catch (error) {
        console.error("Error creating category:", error);
        res.status(500).json({ error: "Lỗi server" });
    }
};


exports.update = async (req, res, next) => {
    try {
        const { name, status, old_image, parent_id } = req.body;
        const image = req.file ? req.file.filename : old_image;

        const [updated] = await categoryModel.update({
            name,
            status,
            images: image,
            parent_id: parent_id || null,

        }, {
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


exports.delete = async (req, res, next) => {
    try {
        const category = await categoryModel.destroy({
            where: {
                id: req.params.id,
            },
        });
        res.json({message: "Danh mục đã được xóa thành công!"});
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Lỗi server"});
    }
};