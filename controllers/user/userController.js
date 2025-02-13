const User = require("../../models/userSchema")
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const Brand = require("../../models/brandSchema")
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
        const categories = await Category.find({isListed:true})
        let productData = await Product.find({isBlocked:false,category:{$in:categories.map(category=>category._id)},
        quantity:{$gte:0}}).limit(7) 
        productData.sort((a,b)=>new Date(b.createdOn-new Date(a.createdOn)))
        // productData = productData.slice(0,4)
        if(user){
            const userData = await User.findById(user)
            res.render("home",{user:userData,products:productData,categories})
        }else{
            return res.render("home",{user:null,products:productData,categories})
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
            html:`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            background-color: #f8f9fa;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .content {
            padding: 30px 20px;
        }
        .otp-container {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .otp-code {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #2c3e50;
        }
        .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #666666;
            border-top: 1px solid #eeeeee;
        }
        .warning {
            color: #dc3545;
            font-size: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Your Company Name</div>
        </div>
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset your password. Use the verification code below to proceed with your password reset:</p>
            
            <div class="otp-container">
                <div class="otp-code">${otp}</div>
            </div>

            <p>This code will expire in 10 minutes for security reasons. If you didn't request this password reset, please ignore this email or contact our support team if you have concerns.</p>

            <p>For your security:</p>
            <ul>
                <li>Never share this code with anyone</li>
                <li>Our team will never ask you for this code</li>
                <li>Only enter this code on our official website</li>
            </ul>

            <div class="warning">
                If you didn't request this password reset, please secure your account immediately.
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; 2024 Your Company Name. All rights reserved.</p>
            <p>Company Address, City, Country</p>
        </div>
    </div>
</body>
</html>`
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

const loadShopPage = async (req, res) => {
    try {
        // User data
        const user = req.session.user || null;
        const userData = await User.findOne({ _id: user });

        // Build filter query
        const query = {
            isBlocked: false,
            quantity: { $gte: 0 }
        };

        // Handle category filter
        const category = req.query.category;
        if (category) {
            query.category = category;
        } else {
            const categories = await Category.find({ isListed: true });
            const categoryIds = categories.map(category => category._id);
            query.category = { $in: categoryIds };
        }

        // Handle brand filter
        const brand = req.query.brand;
        if (brand) {
            const findBrand = await Brand.findOne({ _id: brand });
            if (findBrand) {
                query.brand = findBrand.brandName;
            }
        }

        // Handle price filter
        if (req.query.minPrice !== undefined && req.query.maxPrice !== undefined) {
            query.salePrice = {
                $gte: parseFloat(req.query.minPrice),
                $lte: parseFloat(req.query.maxPrice)
            };
        }

        // Handle search
        if (req.query.search) {
            query.$or = [
                { productName: { $regex: req.query.search, $options: 'i' } },
                { description: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Sort handling
        let sort = { createdAt: -1 }; // default sort
        if (req.query.sort) {
            switch(req.query.sort) {
                case 'price-asc':
                    sort = { salePrice: 1 };
                    break;
                case 'price-desc':
                    sort = { salePrice: -1 };
                    break;
                case 'name-asc':
                    sort = { productName: 1 };
                    break;
                case 'name-desc':
                    sort = { productName: -1 };
                    break;
            }
        }

        
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 12;
        const skip = (page - 1) * limit;

        
        const products = await Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        // Get total count
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        // Pagination range
        const PAGINATION_RANGE = 5;
        let startPage = Math.max(1, page - Math.floor(PAGINATION_RANGE/2));
        let endPage = Math.min(totalPages, startPage + PAGINATION_RANGE - 1);

        if (endPage - startPage + 1 < PAGINATION_RANGE) {
            startPage = Math.max(1, endPage - PAGINATION_RANGE + 1);
        }

        // Fetch categories and brands
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        // Save to search history if user is logged in
        if (userData && (category || brand || req.query.search)) {
            const searchEntry = {
                category: category || null,
                brand: brand || null,
                searchQuery: req.query.search || null,
                searchOn: new Date()
            };
            userData.searchHistory.push(searchEntry);
            await userData.save();
        }

        res.render("shop", {
            user: userData,
            products: products,
            category: categories,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            startPage: startPage,
            endPage: endPage,
            showingStart: skip + 1,
            showingEnd: Math.min(skip + limit, totalProducts),
            selectedCategory: category || null,
            selectedBrand: brand || null,
            selectedMinPrice: req.query.minPrice || null,
            selectedMaxPrice: req.query.maxPrice || null,
            searchQuery: req.query.search || '',
            selectedSort: req.query.sort || 'default'
        });

    } catch (error) {
        console.log("Shop page error:", error);
        res.redirect("/pageNotFound");
    }
};


module.exports = {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadShopPage,
    // filterProduct,
    // filterByPrice,
    // searchProducts,
}