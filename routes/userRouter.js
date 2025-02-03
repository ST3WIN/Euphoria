const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const auth = require("../middlewares/auth")
const passport = require("passport")
const productController = require("../controllers/user/productController")
const profileController = require("../controllers/user/profileController")
const cartController = require("../controllers/user/cartController")
const checkoutController = require("../controllers/user/checkoutController")
const orderController = require("../controllers/user/orderController")

//Page not found
router.get("/pageNotFound",userController.pageNotFound)

//Homepage & Shop page
router.get("/",userController.loadHomePage)
router.get('/shop', userController.loadShopPage);
router.get('/shop/:filter?', userController.loadShopPage);
router.get('/shop/:filter?/:search?', userController.loadShopPage);
router.get('/shop/:filter?', userController.loadShopPage);
router.get('/shop/:filter?/:search?', userController.loadShopPage);

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
router.get("/change-email",auth.userAuth,profileController.changeEmail)
router.post("/change-email",auth.userAuth,profileController.changeEmailValid)
router.get("/change-email-otp",profileController.verifyEmailOTP)
router.post("/verify-email-otp",auth.userAuth,profileController.verifyEmailOtp)
router.get("/new-email",auth.userAuth,profileController.newEmail)
router.post("/update-email",profileController.updateEmail)

//Address management
router.post("/addAddress",auth.userAuth,profileController.postAddAddress)
router.post("/editAddress",auth.userAuth,profileController.postEditAddress)
router.get("/editAddress",auth.userAuth,profileController.editAddress)
router.get("/deleteAddress",auth.userAuth,profileController.deleteAddress)


//Cart management
router.post('/add-to-cart', auth.apiAuth,cartController.addToCart);
router.get('/cart',auth.userAuth, cartController.getCart);
router.post('/update-cart',auth.apiAuth, cartController.updateQuantity);
router.post('/remove-from-cart',auth.apiAuth, cartController.removeFromCart);

//Checkout
router.get("/checkout",auth.userAuth,checkoutController.getCheckout)
router.post("/checkout/add-address",auth.userAuth,checkoutController.addAddress)
router.get("/checkout/get-address/:index",auth.userAuth,checkoutController.getAddress)
router.put("/checkout/update-address/:index",auth.userAuth,checkoutController.updateAddress)

// Orders
router.post("/orders/place",auth.userAuth,orderController.placeOrder)
router.post("/orders/cancel/:orderId",auth.userAuth,orderController.cancelOrder)



module.exports = router