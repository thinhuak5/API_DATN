require('dotenv').config();
const express = require('express');
const cors = require("cors");
const session = require('express-session'); 
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs'); 
const app = express();


const database = require('./models/database');
const Category = require('./models/category');
const CategoryParent = require('./models/categoryparent');
const Product = require('./models/product');

const models = {Category, CategoryParent, Product};

Object.values(models).forEach(model => {
    if (model.associate) {
        model.associate(models);
    }
});




app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

app.use(cors({
    origin: "*",
    methods: "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    allowedHeaders: "Content-Type, Authorization"
}));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {fileSize: 5 * 1024 * 1024},
    fileFilter: function (req, file, cb) {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Chỉ cho phép tải lên hình ảnh!'), false);
        }
    }
});

app.set("view engine", "ejs");
app.set("views", "./views");

app.use('/uploads', express.static('uploads')); 
app.use(express.static("public")); 

const apiRoute = require("./routes/api");
app.use('/api', apiRoute);

app.listen(3000, function () {
    // console.log('Web đang chạy:  http://localhost:3000');
});
