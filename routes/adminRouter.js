const express = require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const categoryController = require("../controllers/admin/categoryController")
const brandController = require("../controllers/admin/brandController")
const auth = require("../middlewares/auth")
const multer = require("multer")
const storage = require("../helpers/multer")
const uploads = multer({storage:storage})

router.get("/pageError",adminController.pageError)
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/",auth.adminAuth,adminController.loadDashBoard)
router.get("/logout",adminController.logout)

//Customer Management
router.get("/users",auth.adminAuth,customerController.customerInfo)
router.get("/blockCustomer",auth.adminAuth,customerController.customerBlock)
router.get("/unblockCustomer",auth.adminAuth,customerController.customerUnBlock)

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
router.post("/addBrand",auth.adminAuth,uploads.single("brandImage"),brandController.addBrand)

module.exports = router