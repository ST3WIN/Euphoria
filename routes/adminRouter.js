const express = require("express")
const router = express.Router()
const adminController = require("../controllers/admin/adminController")
const customerController = require("../controllers/admin/customerController")
const auth = require("../middlewares/auth")

router.get("/pageError",adminController.pageError)
router.get("/login",adminController.loadLogin)
router.post("/login",adminController.login)
router.get("/",auth.adminAuth,adminController.loadDashBoard)
router.get("/logout",adminController.logout)

//Customer Management
router.get("/users",auth.adminAuth,customerController.customerInfo)
router.get("/blockCustomer",auth.adminAuth,customerController.customerBlock)
router.get("/unblockCustomer",auth.adminAuth,customerController.customerUnBlock)

module.exports = router