require("dotenv").config();

const express = require("express");
const session = require("express-session");
const multer = require("multer");
const mongoose = require("mongoose");
const dns = require("dns");
const cloudinary = require("./cloudinary");
const message=false

const app = express();

// ==================================================
// DNS
// ==================================================

dns.setServers([
    "8.8.8.8",
    "1.1.1.1"
]);

// ==================================================
// MULTER
// ==================================================

const upload = multer({
    dest: "tmp/"
});

// ==================================================
// PRODUCT SCHEMA
// ==================================================

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
    quantity_2XL: Number,
    date: Date,
    category: String
});

const Product = mongoose.model("Product", products_schema);

// ==================================================
// ORDER SCHEMA
// ==================================================

const order_schema = new mongoose.Schema({

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },

    productName: {
        type: String,
        required: true
    },

    price: {
        type: Number,
        required: true
    },

    name: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    wilaya: {
        type: String,
        required: true
    },

    commune: {
        type: String,
        required: true
    },

    address: {
        type: String,
        default: ""
    },

    deliveryMethod: {
        type: String,
        enum: ["Home Delivery", "Stop Desk"],
        required: true
    },

    deliveryPrice: {
        type: Number,
        required: true,
        default: 0
    },

    size: {
        type: String,
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    totalPrice: {
        type: Number,
        required: true
    },

    returned: {
        type: Boolean,
        default: false
    },

    date: {
        type: Date,
        default: Date.now
    }

});

const Order = mongoose.model("Order", order_schema);

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.urlencoded({
    extended: true
}));

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

// ==================================================
// ADMIN MIDDLEWARE
// ==================================================

function requireAdmin(req, res, next) {

    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect("/admin");
    }

}

// ==================================================
// MONGODB
// ==================================================

mongoose
    .connect(process.env.DB)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((err) => {
        console.error("MongoDB connection error:", err);
    });

// ==================================================
// ADD PRODUCT
// ==================================================

app.post(
    "/dashboard/add_product",
    upload.single("image"),
    requireAdmin,
    async (req, res) => {

        try {
            

            const {
                name,
                description,
                price,
                sizes,
                quantity_S,
                quantity_M,
                quantity_L,
                quantity_XL,
                quantity_2XL,
                category
            } = req.body;

            const result = await cloudinary.uploader.upload(
                req.file.path,
                {
                    folder: "baladi-style/products"
                }
            );

            const new_product = new Product({

                name,
                description,
                price,
                sizes,
                quantity_S,
                quantity_M,
                quantity_L,
                quantity_XL,
                quantity_2XL,
                category,

                Image: result.secure_url,

                date: new Date()

            });

            await new_product.save();

            res.redirect("/dashboard/products");

        } catch (error) {

            console.error(error);

            res.status(500).send("Error uploading product");

        }

    }
);

// ==================================================
// CREATE ORDER
// ==================================================

app.post("/order", async (req, res) => {

    try {

        const {
            productId,
            name,
            phone,
            address,
            wilaya,
            commune,
            deliveryMethod,
            size,
            quantity
        } = req.body;

        const orderQuantity = Number(quantity);

        // ------------------------------------------
        // Validate customer data
        // ------------------------------------------

        if (
            !productId ||
            !name ||
            !phone ||
            !wilaya ||
            !commune ||
            !deliveryMethod ||
            !size ||
            orderQuantity < 1
        ) {
            return res.status(400).send("Invalid order information");
        }

        // Address required only for Home Delivery

        if (
            deliveryMethod === "Home Delivery" &&
            !address
        ) {
            return res.status(400).send("Address is required");
        }

        // Validate delivery method

        if (
            deliveryMethod !== "Home Delivery" &&
            deliveryMethod !== "Stop Desk"
        ) {
            return res.status(400).send("Invalid delivery method");
        }

        // ------------------------------------------
        // Determine stock field
        // ------------------------------------------

        let stockField;

        if (size === "S") {

            stockField = "quantity_S";

        } else if (size === "M") {

            stockField = "quantity_M";

        } else if (size === "L") {

            stockField = "quantity_L";

        } else if (size === "XL") {

    stockField = "quantity_XL";

} else if (size === "2XL") {

    stockField = "quantity_2XL";

} else {

    return res.status(400).send("Invalid size");

}

        // ------------------------------------------
        // Find product
        // ------------------------------------------

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        // ------------------------------------------
        // Check stock
        // ------------------------------------------

        const availableQuantity =
            Number(product[stockField]) || 0;

        if (availableQuantity < orderQuantity) {
            return res.status(400).send("Not enough stock");
        }

        // ------------------------------------------
        // Delivery prices
        // ------------------------------------------

        const deliveryPrices = {

            "Adrar": {
                home: 1500,
                stopDesk: 800
            },

            "Chlef": {
                home: 850,
                stopDesk: 450
            },

            "Laghouat": {
                home: 950,
                stopDesk: 550
            },

            "Oum El Bouaghi": {
                home: 850,
                stopDesk: 450
            },

            "Batna": {
                home: 850,
                stopDesk: 450
            },

            "Béjaïa": {
                home: 850,
                stopDesk: 450
            },

            "Biskra": {
                home: 900,
                stopDesk: 550
            },

            "Béchar": {
                home: 1200,
                stopDesk: 700
            },

            "Blida": {
                home: 700,
                stopDesk: 400
            },

            "Bouira": {
                home: 850,
                stopDesk: 450
            },

            "Tamanrasset": {
                home: 1800,
                stopDesk: 950
            },

            "Tébessa": {
                home: 900,
                stopDesk: 500
            },

            "Tlemcen": {
                home: 900,
                stopDesk: 450
            },

            "Tiaret": {
                home: 850,
                stopDesk: 450
            },

            "Tizi Ouzou": {
                home: 800,
                stopDesk: 450
            },

            "Alger": {
                home: 500,
                stopDesk: 300
            },

            "Djelfa": {
                home: 950,
                stopDesk: 500
            },

            "Jijel": {
                home: 850,
                stopDesk: 450
            },

            "Sétif": {
                home: 850,
                stopDesk: 450
            },

            "Saïda": {
                home: 850,
                stopDesk: 500
            },

            "Skikda": {
                home: 850,
                stopDesk: 450
            },

            "Sidi Bel Abbès": {
                home: 850,
                stopDesk: 500
            },

            "Annaba": {
                home: 850,
                stopDesk: 450
            },

            "Guelma": {
                home: 900,
                stopDesk: 500
            },

            "Constantine": {
                home: 800,
                stopDesk: 450
            },

            "Médéa": {
                home: 800,
                stopDesk: 450
            },

            "Mostaganem": {
                home: 850,
                stopDesk: 450
            },

            "M'Sila": {
                home: 900,
                stopDesk: 500
            },

            "Mascara": {
                home: 850,
                stopDesk: 500
            },

            "Ouargla": {
                home: 1000,
                stopDesk: 650
            },

            "Oran": {
                home: 850,
                stopDesk: 450
            },

            "El Bayadh": {
                home: 1050,
                stopDesk: 700
            },

            "Illizi": {
                home: 2100,
                stopDesk: 1200
            },

            "Bordj Bou Arreridj": {
                home: 850,
                stopDesk: 500
            },

            "Boumerdès": {
                home: 700,
                stopDesk: 400
            },

            "El Tarf": {
                home: 850,
                stopDesk: 500
            },

            "Tindouf": {
                home: 1700,
                stopDesk: 800
            },

            "Tissemsilt": {
                home: 850,
                stopDesk: 500
            },

            "El Oued": {
                home: 1050,
                stopDesk: 700
            },

            "Khenchela": {
                home: 850,
                stopDesk: 500
            },

            "Souk Ahras": {
                home: 900,
                stopDesk: 500
            },

            "Tipaza": {
                home: 700,
                stopDesk: 400
            },

            "Mila": {
                home: 850,
                stopDesk: 500
            },

            "Aïn Defla": {
                home: 850,
                stopDesk: 500
            },

            "Naâma": {
                home: 1200,
                stopDesk: 700
            },

            "Aïn Témouchent": {
                home: 850,
                stopDesk: 500
            },

            "Ghardaïa": {
                home: 950,
                stopDesk: 550
            },

            "Relizane": {
                home: 850,
                stopDesk: 500
            },

            "Timimoun": {
                home: 1600,
                stopDesk: 850
            },

            "Ouled Djellal": {
                home: 950,
                stopDesk: 550
            },

            "Beni Abbes": {
                home: 1300,
                stopDesk: 650
            },

            "In Salah": {
                home: 1900,
                stopDesk: 1400
            },

            "Touggourt": {
                home: 1000,
                stopDesk: 600
            },

            "El M'Ghair": {
                home: 1200,
                stopDesk: 0
            },

            "El Meniaa": {
                home: 1100,
                stopDesk: 700
            }

        };

        // ------------------------------------------
        // Validate wilaya
        // ------------------------------------------

        if (!deliveryPrices[wilaya]) {
            return res.status(400).send("Invalid wilaya");
        }

        // ------------------------------------------
        // Calculate delivery price
        // ------------------------------------------

        let deliveryPrice;

        if (deliveryMethod === "Home Delivery") {

            deliveryPrice = deliveryPrices[wilaya].home;

        } else {

            deliveryPrice = deliveryPrices[wilaya].stopDesk;

        }

        // ------------------------------------------
        // Calculate total
        // ------------------------------------------

        const productPrice = Number(product.price);

        if (!Number.isFinite(productPrice)) {
            return res.status(400).send("Invalid product price");
        }

        const productTotal =
            productPrice * orderQuantity;

        const totalPrice =
            productTotal + deliveryPrice;

        // ------------------------------------------
        // Decrease stock
        // ------------------------------------------

        product[stockField] =
            availableQuantity - orderQuantity;

        await product.save();

        // ------------------------------------------
        // Create order
        // ------------------------------------------

        const newOrder = new Order({

            productId: product._id,

            productName: product.name,

            price: productPrice,

            name,

            phone,

            wilaya,

            commune,

            address:
                deliveryMethod === "Home Delivery"
                    ? address
                    : "",

            deliveryMethod,

            deliveryPrice,

            size,

            quantity: orderQuantity,

            totalPrice,

            date: new Date(),

            returned: false,

            status: "Pending"

        });

        await newOrder.save();
       
        
        // ------------------------------------------
        // Redirect
        // ------------------------------------------

       res.redirect("/products?orderSuccess=true");

    } catch (err) {

        console.error("ORDER ERROR:", err);

        res.status(500).send("Server error");

    }

});

// ==================================================
// PRODUCTS
// ==================================================

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

app.get("/products", async (req, res) => {

    try {

        const products = await Product
            .find()
            .sort({ date: -1 });

        const message =
            req.query.orderSuccess === "true";

        res.render("all_products", {
            products,
            message
        });

    } catch (err) {

        console.error(err);
        res.status(500).send("Server error");

    }

});
// ==================================================
// ADMIN LOGIN PAGE
// ==================================================

app.get("/admin", (req, res) => {
    res.render("login");
});

// ==================================================
// LOGIN
// ==================================================

app.post("/login", (req, res) => {

    const {
        username,
        password
    } = req.body;

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

// ==================================================
// DASHBOARD
// ==================================================

app.get("/dashboard", requireAdmin, (req, res) => {
    res.render("dashboard");
});

// ==================================================
// DASHBOARD PRODUCTS
// ==================================================

app.get(
    "/dashboard/products",
    requireAdmin,
    async (req, res) => {

        try {

            const products = await Product
                .find()
                .sort({ date: -1 });

            res.render("products", {
                products
            },);

        } catch (err) {

            console.error(err);

            res.status(500).send("Server error");

        }

    }
);

// ==================================================
// DASHBOARD ORDERS
// ==================================================

app.get(
    "/dashboard/orders",
    requireAdmin,
    async (req, res) => {

        try {

            const orders = await Order
                .find()
                .sort({ date: 1});

            res.render("order_dash", {
                orders
            });

        } catch (err) {

            console.error(err);

            res.status(500).send("Server error");

        }

    }
);

// ==================================================
// ADD PRODUCT PAGE
// ==================================================

app.get(
    "/add_product",
    requireAdmin,
    (req, res) => {
        res.render("add");
    }
);

// ==================================================
// DELETE PRODUCT
// ==================================================

app.post(
    "/dashboard/delete_product/:id",
    requireAdmin,
    async (req, res) => {

        try {

            await Product.findByIdAndDelete(
                req.params.id
            );

            res.redirect("/dashboard/products");

        } catch (err) {

            console.error(
                "Delete product error:",
                err
            );

            res.status(500).send("Server error");

        }

    }
);

// ==================================================
// DELETE ORDER
// ==================================================

app.post(
    "/dashboard/delete_order/:id",
    requireAdmin,
    async (req, res) => {

        try {

            await Order.findByIdAndDelete(
                req.params.id
            );

            res.redirect("/dashboard/orders");

        } catch (err) {

            console.error(err);

            res.status(500).send("Server error");

        }

    }
);

// ==================================================
// RETURN ORDER
// ==================================================

app.post(
    "/dashboard/return_order/:id",
    requireAdmin,
    async (req, res) => {

        try {

            const order = await Order.findById(
                req.params.id
            );

            if (!order) {
                return res.status(404).send(
                    "Order not found"
                );
            }

            // Prevent returning the same order twice

            if (order.returned) {
                return res.redirect(
                    "/dashboard/orders"
                );
            }

            const product = await Product.findById(
                order.productId
            );

            if (!product) {
                return res.status(404).send(
                    "Product not found"
                );
            }

            const quantity =
                Number(order.quantity);

            // --------------------------------------
            // Restore stock
            // --------------------------------------

            if (order.size === "S") {

                product.quantity_S =
                    Number(product.quantity_S || 0) +
                    quantity;

            } else if (order.size === "M") {

                product.quantity_M =
                    Number(product.quantity_M || 0) +
                    quantity;

            } else if (order.size === "L") {

                product.quantity_L =
                    Number(product.quantity_L || 0) +
                    quantity;

            } else if (order.size === "XL") {

    product.quantity_XL =
        Number(product.quantity_XL || 0) +
        quantity;

} else if (order.size === "2XL") {

    product.quantity_2XL =
        Number(product.quantity_2XL || 0) +
        quantity;

} else {

    return res.status(400).send(
        "Invalid size"
    );

}

            await product.save();

            // --------------------------------------
            // Mark order as returned
            // --------------------------------------

            order.returned = true;

            await order.save();

            res.redirect("/dashboard/orders");

        } catch (err) {

            console.error(
                "RETURN ORDER ERROR:",
                err
            );

            res.status(500).send("Server error");

        }

    }
);

// ==================================================
// LOGOUT
// ==================================================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/admin");
    });

});

// ==================================================
// SERVER
// ==================================================

app.listen(
    process.env.PORT,
    () => {

        console.log(
            `Server is running on http://localhost:${process.env.PORT}`
        );

    }
);