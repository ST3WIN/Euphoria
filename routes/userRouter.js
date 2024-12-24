const express = require("express")
const router = express.Router()
const userController = require("../controllers/user/userController")
const passport = require("passport")

//Page not found
router.get("/pageNotFound",userController.pageNotFound)

//Homepage
router.get("/",userController.loadHomePage)

//Sign up
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
router.post("/verify-otp",userController.verifyOtp)
router.post("/resend-otp",userController.resendOtp)

//Google Login
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
// router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{
//     req.session.user = req.user._id;
//     res.redirect("/")
// })

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

module.exports = router