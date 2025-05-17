require('dotenv').config();
const express = require('express');
const cors = require("cors");
const session = require('express-session');  // Đảm bảo import express-session
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs'); // Đảm bảo import fs để kiểm tra thư mục uploads
const app = express();

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

// Tạo thư mục uploads nếu chưa tồn tại
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
    limits: {fileSize: 5 * 1024 * 1024}, // Giới hạn kích thước tệp 5MB
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

// PUBLIC các folder
app.use('/uploads', express.static('uploads')); // Cho phép truy cập thư mục uploads
app.use(express.static("public")); // folder public vẫn giữ nguyên

// Route
const apiRoute = require("./routes/api");
app.use('/api', apiRoute);

app.listen(3000, function () {
    console.log('Web đang chạy:  http://localhost:3000');
});
