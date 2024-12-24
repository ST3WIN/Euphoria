const User = require("../../models/userSchema")
const env = require("dotenv").config()
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")

const pageNotFound = async(req,res)=>{
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadHomePage = async(req,res)=>{
    try {
        const user = req.session.user
        console.log("Session User:", req.session.user);
        if(user){
            const userData = await User.findById(user)
            console.log(userData)
            res.render("home",{user:userData})
        }else{
            return res.render("home",{user:null})
        }
        
    } catch (error) {
        console.log("Home page not found")
        res.status(500).send("Server error")
    }
}

const loadSignup = async(req,res)=>{
    try {
        return res.render("signup")
    } catch (error) {
        console.log("Signup page error",error)
        res.status(500).send("Server Error")
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email,otp){
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Email verification",
            text:`Use this code to finish setting up your account ${otp}`,
            html:`<b>Your OTP: ${otp}</b>`
        })
        return info.accepted.length > 0
    } catch (error) {
        console.error("Error sending email",error)
        return false
    }
}

const signup = async(req,res)=>{
    try {
        const email = req.body.email
        const password = req.body.password
        const confirmPassword = req.body.confirm_password
        const firstName = req.body.first_name
        const lastName = req.body.last_name
        const phone = req.body.phone

        if(password !== confirmPassword){
            return res.render("signup",{message:"Password mismatch"})
        }

        const findUser = await User.findOne({email:email})
        if(findUser){
            return res.render("signup",{message:"User with this email already exists"})
        }

        const otp = generateOtp()
        const emailSent = await sendVerificationEmail(email,otp)

        if(!emailSent){
            return res.json("email-error")
        }

        req.session.userOtp = otp
        req.session.userData ={firstName,lastName,phone,email,password}

        res.render("verify-otp")
        console.log("OTP",otp)
    } catch (error) {
       console.error("Signup error",error)
       res.redirect("/pageNotFound") 
    }
}

const securePassword = async(password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
}

const verifyOtp = async(req,res)=>{
    try {
        const {otp} = req.body
        console.log(otp)
        if(otp === req.session.userOtp){
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)
            const saveUserData = new User({
                firstName:user.firstName,
                lastName:user.lastName,
                email:user.email,
                phone:user.phone,
                password:passwordHash
            })
            await saveUserData.save()
            console.log(saveUserData)
            req.session.user = saveUserData._id 
            res.json({success:true,redirectUrl:"/"})
        }else{
            res.status(400).json({success:false,message:"Invalid OTP"})
        }
    } catch (error) {
        console.log("OTP page error",error)
        res.status(500).json({success:false,message:"An error has occured"})
    }
}

const resendOtp = async(req,res)=>{
    try {
        const {email} = req.session.userData
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp = generateOtp()
        req.session.userOtp = otp
        const emailSent = await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("Resend OTP",otp)
            res.status(200).json({success:true,message:"OTP resend successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP"})
        }        
    } catch (error) {
        console.error("Resend OTP error",error)
        res.status(500).json({success:false,message:"Internal server error"})
    }
}

const loadLogin = async(req,res)=>{
    try {
        if(!req.session.user){
            return res.render("login")
        }else{
            res.redirect("/")
        }
    } catch (error) {
        res.redirect("page-404")
        console.log("loadLogin Error")
    }
}

const login = async(req,res)=>{
    try {
        const email = req.body.email
        const password = req.body.password
        const findUser = await User.findOne({isAdmin:0,email:email})
        console.log('FindUser',findUser)
        console.log('ivde')
        if(!findUser){
            return res.render("login",{message:"User not found"})
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked"})
        }
        const passwordMatch = await bcrypt.compare(password,findUser.password)
        if(!passwordMatch){
            return res.render("login",{message:"Invalid credentials"})
        }
        req.session.user = findUser
        res.redirect("/")
    } catch (error) {
        console.error("Login error",error)
        res.render("login",{message:"Login failed"})
    }
}

const logout = async(req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destroying error",err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/")
        })
    } catch (error) {
        console.log("Logout error",error)
        res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout
}