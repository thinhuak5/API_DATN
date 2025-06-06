const productModel = require('../../../models/product');

exports.getAll = async (req, res) => {
    try {
        const data = await productModel.findAll();
        res.json(data);
    } catch (error) {
        res.status(500).json({error: "Lỗi server"});
    }
};

exports.detail = async (req, res) => {
    try {
        const product = await productModel.findByPk(req.params.id);
        res.json(product);
    } catch (error) {
        res.status(500).json({error: "Lỗi server"});
    }
};

exports.create = async (req, res) => {
    try {
        const {name, description, price, discount_price, view, status, category_id, quantity, minStock} = req.body;
        const image = req.file ? req.file.filename : null;
        const newProduct = await productModel.create({
            name,
            description,
            price,
            discount_price,
            view,
            status,
            category_id,
            quantity,
            minStock,
            images: image
        });
        res.status(200).json({message: "Sản phẩm đã được thêm thành công!", product: newProduct});
    } catch (err) {
        res.status(500).json({error: "Đã xảy ra lỗi khi thêm sản phẩm"});
    }
};

exports.update = async (req, res) => {
    try {
        const {
            name, description, price, discount_price, view, status, category_id, old_image,
            quantity, minStock
        } = req.body;

        // Dùng ảnh mới nếu có, nếu không dùng ảnh cũ
        const images = req.file ? req.file.filename : old_image;

        const updatedProduct = await productModel.update(
            {
                name, description, price, discount_price, view, status, category_id, images,
                quantity,    // thêm quantity
                minStock     // thêm minStock
            },
            {where: {id: req.params.id}}
        );

        if (updatedProduct[0] === 0) {
            return res.status(404).json({error: 'Sản phẩm không tìm thấy'});
        }

        res.status(200).json({message: "Cập nhật sản phẩm thành công!"});
    } catch (error) {
        console.error("Lỗi cập nhật:", error);
        res.status(500).json({error: "Đã xảy ra lỗi khi cập nhật sản phẩm"});
    }
};


exports.delete = async (req, res) => {
    try {
        const product = await productModel.destroy({where: {id: req.params.id}});
        res.json(product);
    } catch (error) {
        res.status(500).json({error: "Lỗi server"});
    }
};
