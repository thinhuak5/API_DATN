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
        const data = req.body;

        console.log("Dữ liệu nhận được:", data);  // Log dữ liệu nhận được để debug

        // Kiểm tra và xử lý dữ liệu
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