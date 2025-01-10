const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const auth = require("../middlewares/auth")
const passport = require("passport")
const productController = require("../controllers/user/productController")
const profileController = require("../controllers/user/profileController")
const cartController = require("../controllers/user/cartController")

//Page not found
router.get("/pageNotFound",userController.pageNotFound)

//Homepage & Shop page
router.get("/",userController.loadHomePage)
router.get("/shop",userController.loadShopPage)
router.get("/filter",userController.filterProduct)
router.get("/filterPrice",userController.filterByPrice)
router.post("/search",userController.searchProducts)


//Sign up
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)

//Google Login
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
router.get("/auth/google/callback", 
    passport.authenticate("google", {
        failureRedirect: "/signup",
        failureMessage: true 
    }),
    (req, res) => {
        req.session.user = req.user._id;
        res.redirect("/");
    }
)

//Login
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)
router.get("/logout",userController.logout)

//Product management
router.get("/productDetails",productController.productDetails)

//Brands
router.get("/getAllBrands",productController.getAllBrands)

//Profile Management
router.get("/forgot-password",profileController.getForgotpage)
router.post("/forgot-email-valid",profileController.forgotEmailValid)
router.get("/userProfile",auth.userAuth,profileController.userProfile)
router.get("/forgot-password-otp",profileController.verifyForgotPasswordOTP)
router.post("/verify-forgotPasswordOtp",profileController.verifyForgotPassOTP)
router.get("/reset-password",profileController.getResetPasswordPage)
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword)
// router.get("/change-email",auth.userAuth,profileController.changeEmail)

//Cart management
router.get("/cart",auth.userAuth,cartController.loadCart)

module.exports = router