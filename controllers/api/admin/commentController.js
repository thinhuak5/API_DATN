const commentModel = require('../../../models/comment');
const {Op} = require("sequelize");

exports.getAll = async (req, res, next) => {
    try {
        const data = await commentModel.findAll();
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Lỗi server khi lấy danh sách bình luận"});
    }
};

exports.detail = async (req, res, next) => {
    try {
        const comment = await commentModel.findByPk(req.params.id);
        if (!comment) {
            return res.status(404).json({error: "Không tìm thấy bình luận"});
        }
        res.json(comment);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Lỗi server khi lấy chi tiết bình luận"});
    }
};

exports.create = async (req, res, next) => {
    console.log(req.body);
    try {
        const {content, date, status, product_id, user_id} = req.body;

        if (!content || !date || status === undefined || !product_id || !user_id) {
            return res.status(400).json({error: "Thiếu dữ liệu bắt buộc"});
        }

        const comment = await commentModel.create({content, date, status, product_id, user_id});
        res.status(201).json(comment);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: "Lỗi server khi tạo bình luận"});
    }
};

exports.update = async (req, res, next) => {
    try {
        const data = req.body;

        const [updated] = await commentModel.update(data, {
            where: {
                id: req.params.id
            },
        });

        if (updated === 0) {
            return res.status(404).json({error: "Không tìm thấy bình luận để cập nhật"});
        }

        const updatedComment = await commentModel.findByPk(req.params.id);
        res.json(updatedComment);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Lỗi server khi cập nhật bình luận"});
    }
};

exports.delete = async (req, res, next) => {
    try {
        const deleted = await commentModel.destroy({
            where: {
                id: req.params.id,
            },
        });

        if (deleted === 0) {
            return res.status(404).json({error: "Không tìm thấy bình luận để xoá"});
        }

        res.json({message: "Xoá bình luận thành công"});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: "Lỗi server khi xoá bình luận"});
    }
};
