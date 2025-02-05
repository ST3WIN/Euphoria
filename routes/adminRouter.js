const express = require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController")
const productController = require("../controllers/admin/productController")
const orderController = require("../controllers/admin/orderController")
const couponController = require("../controllers/admin/couponController")
const auth = require("../middlewares/auth")
const upload = require("../helpers/multer")

router.get("/pageError",adminController.pageError)
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/",auth.adminAuth,adminController.loadDashBoard)
router.get("/logout",adminController.logout)

//Customer Management
router.get("/users",auth.adminAuth,customerController.customerInfo)
router.get("/blockCustomer",auth.adminAuth,customerController.customerBlock)
router.get("/unblockCustomer",auth.adminAuth,customerController.customerUnBlock)

//Order Management
router.get("/orders", auth.adminAuth, orderController.getOrders)
router.post('/orders/updateStatus', auth.adminAuth, orderController.updateOrderStatus);
router.post('/orders/cancel', auth.adminAuth, orderController.cancelOrder);

//Category Management
router.get("/category",auth.adminAuth,categoryController.categoryInfo)
router.post("/addCategory",auth.adminAuth,categoryController.addCategory)
router.post("/addCategoryOffer",auth.adminAuth,categoryController.addCategoryOffer)
router.post("/removeCategoryOffer",auth.adminAuth,categoryController.removeCategoryOffer)
router.get("/listCategory",auth.adminAuth,categoryController.listCategory)
router.get("/unlistCategory",auth.adminAuth,categoryController.unlistCategory)
router.get("/editCategory",auth.adminAuth,categoryController.loadEditCategory)
router.post("/editCategory/:id",auth.adminAuth,categoryController.editCategory)

//Brand Management
router.get("/brands",auth.adminAuth,brandController.getBrandPage)
router.post("/addBrand",auth.adminAuth,upload.single("brandImage"),brandController.addBrand)
router.get("/blockbrand",auth.adminAuth,brandController.blockbrand);
router.get("/unblockbrand",auth.adminAuth,brandController.unblockbrand);
router.delete("/deletebrand/:id", auth.adminAuth, brandController.deleteBrand);
router.post("/updateBrand",upload.single("logo"),auth.adminAuth,brandController.updateBrand);

//Product management
router.get("/addProducts",auth.adminAuth,productController.getProductsPage)
router.post("/addProducts",auth.adminAuth,upload.array("images",4),productController.addProducts)
router.get("/products",auth.adminAuth,productController.getAllProducts)
router.post("/addProductOffer",auth.adminAuth,productController.addProductOffer)
router.post("/removeProductOffer",auth.adminAuth,productController.removeProductOffer)
router.get("/blockProduct",auth.adminAuth,productController.blockProduct)
router.get("/unblockProduct",auth.adminAuth,productController.unblockProduct)
router.get("/editProduct",auth.adminAuth,productController.getEditProduct)
router.post("/editProduct/:id",auth.adminAuth,upload.array("images",4),productController.editProduct)
router.post("/deleteImage",auth.adminAuth,productController.deleteSingleImage)

//Coupon Management
router.get("/coupon",auth.adminAuth,couponController.loadCoupon)
router.post("/createCoupon",auth.adminAuth,couponController.createCoupon)
router.get("/editCoupon",auth.adminAuth,couponController.editCoupon)

module.exports = router