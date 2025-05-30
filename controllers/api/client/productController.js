const productModel = require('../../models/product');
const {Op} = require("sequelize");

exports.getAll = async (req, res, next) => {


    const data = await productModel.findAll();
    res.render('Client/product', {products: data});
};

exports.detail = async (req, res, next) => {
    const product = await productModel.findByPk(req.params.id);
    res.render('Client/chitiet', {product});
};
