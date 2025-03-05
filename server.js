require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Kết nối MongoDB
const mongoURI = "mongodb://127.0.0.1:27017/shopping-cart";
mongoose
  .connect(mongoURI)
  .then(() => console.log("✅ Kết nối MongoDB thành công!"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// Cấu hình EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Cấu hình session
app.use(
  session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

// Mô hình sản phẩm
const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  imageUrl: String, // Thêm ảnh sản phẩm
  description: String, // Thêm mô tả sản phẩm
  category: String, // Thêm danh mục sản phẩm
  brand: String, // Thêm thương hiệu sản phẩm
});

const Product = mongoose.model("Product", ProductSchema);

// Mô hình giỏ hàng
const CartSchema = new mongoose.Schema({
  userId: String,
  items: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number,
    },
  ],
});
const Cart = mongoose.model("Cart", CartSchema);

// Mô hình đơn hàng
const OrderSchema = new mongoose.Schema({
  userId: String,
  items: [
    {
      productId: mongoose.Schema.Types.ObjectId,
      name: String,
      price: Number,
      quantity: Number,
    },
  ],
  totalAmount: Number,
  createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.model("Order", OrderSchema);

// Trang danh sách sản phẩm
app.get("/", async (req, res) => {
  const products = await Product.find();
  res.render("index", { products });
});

// Trang giỏ hàng (hiển thị từ MongoDB)
app.get("/cart", async (req, res) => {
  const userId = "guest";
  let cart = await Cart.findOne({ userId });

  if (!cart) {
    cart = { items: [] };
  }

  // Tính tổng tiền
  const totalAmount = cart.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  res.render("cart", { cart: cart.items, totalAmount });
});

// Thêm sản phẩm vào giỏ hàng
app.post("/cart/add/:id", async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).send("Sản phẩm không tồn tại");

  const userId = "guest";
  let cart = await Cart.findOne({ userId });

  if (!cart) {
    cart = new Cart({ userId, items: [] });
  }

  // Kiểm tra sản phẩm đã có trong giỏ chưa
  const existingItem = cart.items.find((item) =>
    item.productId.equals(product._id)
  );

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.items.push({
      productId: product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }

  await cart.save();
  res.redirect("/cart");
});

// Xóa sản phẩm khỏi giỏ hàng
app.post("/cart/remove/:id", async (req, res) => {
  const userId = "guest";
  let cart = await Cart.findOne({ userId });

  if (cart) {
    cart.items = cart.items.filter(
      (item) => !item.productId.equals(req.params.id)
    );
    await cart.save();
  }

  res.redirect("/cart");
});

// Thanh toán giỏ hàng
app.post("/cart/checkout", async (req, res) => {
  console.log("📢 API /cart/checkout đã được gọi!");

  try {
    const userId = "guest";
    let cart = await Cart.findOne({ userId });

    if (!cart || cart.items.length === 0) {
      console.log("❌ Giỏ hàng trống hoặc không tìm thấy!");
      return res.redirect("/cart");
    }

    const totalAmount = cart.items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    const order = new Order({
      userId,
      items: cart.items,
      totalAmount,
    });

    await order.save();
    console.log("✅ Đơn hàng đã được lưu thành công!");

    // Xóa giỏ hàng
    await Cart.deleteOne({ userId });

    res.redirect("/orders");
  } catch (error) {
    console.error("❌ Lỗi khi thanh toán:", error);
    res.status(500).send("Có lỗi xảy ra!");
  }
});

// Hiển thị danh sách đơn hàng
app.get("/orders", async (req, res) => {
  const userId = "guest";
  const orders = await Order.find({ userId });

  if (!orders || orders.length === 0) {
    return res.send("❌ Bạn chưa có đơn hàng nào!");
  }

  res.render("orders", { orders });
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
});

// API thêm sản phẩm
// API thêm sản phẩm
app.post("/product/add", async (req, res) => {
  try {
    const { name, price, imageUrl, description, category, brand } = req.body;

    if (!name || !price) {
      return res.status(400).send("Tên sản phẩm và giá là bắt buộc!");
    }

    const newProduct = new Product({
      name,
      price,
      imageUrl,
      description,
      category,
      brand,
    });

    await newProduct.save();
    console.log(`✅ Đã thêm sản phẩm: ${name}`);
    res
      .status(201)
      .json({ message: "Sản phẩm đã được thêm!", product: newProduct });
  } catch (error) {
    console.error("❌ Lỗi khi thêm sản phẩm:", error);
    res.status(500).send("Có lỗi xảy ra!");
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send("Không tìm thấy sản phẩm!");
    }
    res.render("product", { product });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin sản phẩm:", error);
    res.status(500).send("Lỗi máy chủ");
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách sản phẩm:", error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    const { name, price, description, imageUrl, category, brand } = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, description, imageUrl, category, brand },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật sản phẩm:", error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    res.status(200).json({ message: "✅ Sản phẩm đã bị xóa", deletedProduct });
  } catch (error) {
    console.error("❌ Lỗi khi xóa sản phẩm:", error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error("❌ Lỗi khi lấy sản phẩm:", error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

app.post("/products", async (req, res) => {
  const newProduct = new Product(req.body);
  await newProduct.save();
  res.redirect("/products"); // Hoặc trả về JSON nếu làm API
});
