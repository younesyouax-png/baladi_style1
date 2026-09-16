require("dotenv").config();

const express = require("express");
const session = require("express-session");
const multer = require("multer");
const mongoose = require("mongoose");
const dns = require("dns");
const { name } = require("ejs");

const app = express();

dns.setServers([
    "8.8.8.8",
    "1.1.1.1"
]);

// ==================== MULTER ====================

const upload = multer({
    dest: "public/uploads/"
});

// ==================== MONGOOSE ====================

const products_schema = new mongoose.Schema({
    Image: String,
    name: String,
    description: String,
    price: Number,
    sizes: [String],
    quantity_S: Number,
    quantity_M: Number,
    quantity_L: Number,
    quantity_XL: Number,
    date: Date,
    category: String
});

const Product = mongoose.model("Product", products_schema);
const order_schema = new mongoose.Schema({

    productId: mongoose.Schema.Types.ObjectId,

    productName: String,

    name: String,

    phone: String,

    address: String,

    size: String,

    quantity: Number,

    date: Date

});

const Order = mongoose.model("Order", order_schema);

// ==================== MIDDLEWARE ====================

app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 30
        }
    })
);

// ==================== ADMIN MIDDLEWARE ====================

function requireAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect("/admin");
    }
}

// ==================== MONGODB ====================

mongoose
    .connect(process.env.DB)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });

// ==================== ADD PRODUCT ====================

app.post(
    "/dashboard/add_product",
    requireAdmin,
    upload.single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).send("Please select an image");
            }

            const {
                name,
                description,
                price,
                sizes,
                quantity_S,
                quantity_M,
                quantity_L,
                category,
                quantity_XL
            } = req.body;
            

            const new_product = new Product({
                Image: req.file.filename,
                name,
                description,
                price,
                sizes,
                quantity_S,
                quantity_M,
                quantity_L,
                quantity_XL,
                date: new Date(),
                category:category
            });

            await new_product.save();

            res.redirect("/dashboard/products");

        } catch (err) {
            console.error(err);
            res.status(500).send("Server error");
        }
    }
);
app.post("/order", async (req, res) => {
    try {

        const {
            productId,
            name,
            phone,
            address,
            size,
            quantity
        } = req.body;

        const orderQuantity = Number(quantity);

        // التحقق من البيانات
        if (
            !productId ||
            !name ||
            !phone ||
            !address ||
            !size ||
            orderQuantity < 1
        ) {
            return res.status(400).send("Invalid order information");
        }

        // تحديد مخزون المقاس
        let stockField;

        if (size === "S") {
            stockField = "quantity_S";
        } else if (size === "M") {
            stockField = "quantity_M";
        } else if (size === "L") {
            stockField = "quantity_L";
        } else if (size === "XL") {
            stockField = "quantity_XL";
        } else {
            return res.status(400).send("Invalid size");
        }

        // البحث عن المنتج
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        // معرفة الكمية الموجودة
        const availableQuantity = product[stockField];

        // التأكد من توفر الكمية
        if (availableQuantity < orderQuantity) {
            return res.status(400).send("Not enough stock");
        }

        // إنقاص المخزون
        product[stockField] = availableQuantity - orderQuantity;

        await product.save();

        // إنشاء الطلب
        const newOrder = new Order({
            productId: product._id,
            productName: product.name,
            name: name,
            phone: phone,
            address: address,
            size: size,
            quantity: orderQuantity,
            date: new Date()
        });

        await newOrder.save();

        // العودة إلى المنتجات
        res.redirect("/products");

    } catch (err) {

        console.error("ORDER ERROR:", err);

        res.status(500).send("Server error");
    }
});

app.get("/dashboard/orders", requireAdmin, async (req, res) => {
    const orders = await Order.find().sort({ _id: 1 });
    res.render("order_dash", { orders });
});

// ==================== PRODUCTS ====================

app.get("/", async (req, res) => {
    try {
        const products = await Product
            .find()
            .sort({ date: -1 })
            .limit(6);

        res.render("landing", {
            products
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// ==================== ADMIN LOGIN PAGE ====================

app.get("/admin", (req, res) => {
    res.render("login");
});

// ==================== LOGIN ====================

app.post("/login", (req, res) => {

    const { username, password } = req.body;

    if (
        username === process.env.admin_username &&
        password === process.env.admin_password
    ) {

        req.session.isAdmin = true;

        res.redirect("/dashboard");

    } else {

        res.render("login");

    }
});

// ==================== DASHBOARD ====================

app.get("/dashboard", requireAdmin, (req, res) => {
    res.render("dashboard");
});

// ==================== DASHBOARD PRODUCTS ====================

app.get("/dashboard/products", requireAdmin, async (req, res) => {

    try {

        const products = await Product
            .find()
            .sort({ date: -1 });

        res.render("products", {
            products
        });

    } catch (err) {

        console.error(err);
        res.status(500).send("Server error");

    }

});

// ==================== DASHBOARD ORDERS ====================

app.get("/dashboard/orders", requireAdmin, async (req, res) => {

    try {

        const orders = await Order
            .find()
            .sort({ _id: 1 });


        res.render("order_dash", {
            orders
        });

    } catch (err) {

        console.error(err);

        res.status(500).send("Server error");

    }

});
// ==================== ADD PRODUCT PAGE ====================

app.get("/add_product", requireAdmin, (req, res) => {
    res.render("add");
});

// ==================== LOGOUT ====================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/admin");
    });

});
app.get('/products',async(req,res)=>{
   const products =await Product.find().sort({date:-1})
    res.render('all_products',{products})

})
app.post(
    "/dashboard/delete_product/:id",
    requireAdmin,
    async (req, res) => {
        try {
            await Product.findByIdAndDelete(req.params.id);

            res.redirect("/dashboard/products");

        } catch (err) {
            console.error("Delete product error:", err);
            res.status(500).send("Server error");
        }
    }
);
app.post("/dashboard/delete_order/:id", requireAdmin, async (req, res) => {

    try {

        await Order.findByIdAndDelete(req.params.id);

        res.redirect("/dashboard/orders");

    } catch (err) {

        console.error(err);

        res.status(500).send("Server error");

    }

});

// ==================== SERVER ====================

app.listen(process.env.PORT, () => {

    console.log(
        `Server is running on http://localhost:${process.env.PORT}`
    );

});