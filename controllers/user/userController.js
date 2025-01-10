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
        quantity:{$gt:0}}).limit(7) 
        productData.sort((a,b)=>new Date(b.createdOn-new Date(a.createdOn)))
        // productData = productData.slice(0,4)
        console.log("Session User:", req.session.user);
        if(user){
            const userData = await User.findById(user)
            console.log(userData)
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

const loadShopPage = async(req,res)=>{
    try {
        const user = req.session.user || null;
        const userData = await User.findOne({_id:user});
        const categories = await Category.find({isListed:true});
        const categoryId = categories.map((category)=>category._id.toString());
        
        // Pagination improvements
        const page = Math.max(1, parseInt(req.query.page) || 1); // Ensure page is never less than 1
        const limit = 12;
        const skip = (page-1)*limit;
        
        // Query for products
        const products = await Product.find({
            isBlocked:false,
            category:{$in:categoryId},
            quantity:{$gt:0}
        }).sort({createdAt:-1}).skip(skip).limit(limit);
        
        // Get total count for pagination
        const totalProducts = await Product.countDocuments({
            isBlocked:false, // Fixed typo from isblocked to isBlocked
            category:{$in:categoryId},
            quantity:{$gt:0}
        });
        
        const totalPages = Math.ceil(totalProducts/limit);
        
        // Calculate pagination range
        const PAGINATION_RANGE = 5; // Show 5 page numbers at a time
        let startPage = Math.max(1, page - Math.floor(PAGINATION_RANGE/2));
        let endPage = Math.min(totalPages, startPage + PAGINATION_RANGE - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < PAGINATION_RANGE) {
            startPage = Math.max(1, endPage - PAGINATION_RANGE + 1);
        }
        
        const brands = await Brand.find({isBlocked:false});
        const categoryWithId = categories.map(category => ({
            _id: category._id,
            name: category.name
        }));

        res.render("shop",{
            user: userData,
            products: products,
            category: categoryWithId,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            startPage: startPage,
            endPage: endPage,
            showingStart: skip + 1,
            showingEnd: Math.min(skip + limit, totalProducts)
        });
    } catch (error) {
        console.log("Shop page error", error);
        res.redirect("/pageNotFound");
    }
}

const filterProduct = async(req,res)=>{
    try {
        const user = req.session.user
        const category = req.query.category
        const brand = req.query.brand
        const findCategory = category ? await Category.findOne({_id:category}) : null
        const findBrand = brand ? await Brand.findOne({_id:brand}) : null
        const brands = await Brand.find({}).lean()
        const query = {
            isBlocked:false,
            quantity:{$gt:0}
        }
        if(findCategory){
            query.category = findCategory._id
        }
        if(findBrand){
            query.brand = findBrand.brandName
        }
        let findProducts = await Product.find(query).lean()
        findProducts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
        const categories = await Category.find({isListed:true})
        let itemsPerPage = 12
        let currentPage = parseInt(req.query.page) || 1 
        let startIndex = (currentPage-1)*itemsPerPage
        let endIndex = startIndex + itemsPerPage
        let totalPages = Math.ceil(findProducts.length/itemsPerPage)
        const currentProduct = findProducts.slice(startIndex,endIndex)
        let userData = null 
        if(user){
            userData = await User.findOne({_id:user})
            if(userData){
                const searchEntry = {
                    category:findCategory ? findCategory._id : null,
                    brand:findBrand?findBrand.brandName:null,
                    searchOn:new Date()
                }
                userData.searchHistory.push(searchEntry)
                await userData.save()
            }
        }
        req.session.filteredProducts = currentProduct
        res.render("shop",{
            user:userData,
            products:currentProduct,
            category:categories,
            brand:brands,
            totalPages,
            currentPage,
            selectedCategory:category || null,
            selectedBrand:brand||null
        })
    } catch (error) {
        console.log("Filter page error",error)
        res.redirect("/page-404")
    }
}

const filterByPrice = async(req,res)=>{
    try {
        const user = req.session.user
        const userData = await User.findOne({_id:user})
        const brands = await Brand.find({}).lean()
        const categories = await Category.find({isListed:true}).lean()
        let findProducts = await Product.find({
            salePrice:{$gt:req.query.gt,$lt:req.query.lt},
            isBlocked:false,
            quantity:{$gt:0}
        }).lean()
        findProducts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
        let itemsPerPage = 12
        let currentPage = parseInt(req.query.page) || 1
        let startIndex = (currentPage-1)*itemsPerPage
        let endIndex = startIndex + itemsPerPage
        const totalPages = Math.ceil(findProducts.length/itemsPerPage)
        const currentProduct = findProducts.slice(startIndex,endIndex)
        req.session.filteredProducts = findProducts
        res.render("shop",{
            user:userData,
            products:currentProduct,
            category:categories,
            brand:brands,
            totalPages,
            currentPage
        })
    } catch (error) {
        console.log("Error filtring by price range",error)
        res.redirect("/page-404")
    }
}

const searchProducts = async(req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.findOne({ _id: user });
        const search = req.body.query || ''; // Handle undefined search query
        
        // Fetch brands and categories
        const brands = await Brand.find({}).lean();
        const categories = await Category.find({ isListed: true }).lean();
        const categoryId = categories.map(category => category._id.toString());
        
        let searchResult = [];
        
        // Check for filtered products in session
        if (req.session.filteredProduct && req.session.filteredProduct.length > 0) {
            searchResult = req.session.filteredProduct.filter(product => 
                product.productName.toLowerCase().includes(search.toLowerCase())
            );
        } else {
            searchResult = await Product.find({
                productName: { $regex: search, $options: 'i' },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryId }
            }).lean(); // Use lean() for better performance
        }
        
        // Sort by creation date
        searchResult.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Pagination setup
        const itemsPerPage = 12;
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const totalProducts = searchResult.length;
        const totalPages = Math.ceil(totalProducts / itemsPerPage);
        
        // Get current page products
        const currentProducts = searchResult.slice(startIndex, endIndex);
        
        // Calculate pagination range
        const PAGINATION_RANGE = 5;
        let startPage = Math.max(1, currentPage - Math.floor(PAGINATION_RANGE/2));
        let endPage = Math.min(totalPages, startPage + PAGINATION_RANGE - 1);
        
        // Adjust start page if we're near the end
        if (endPage - startPage + 1 < PAGINATION_RANGE) {
            startPage = Math.max(1, endPage - PAGINATION_RANGE + 1);
        }

        res.render("shop", {
            user: userData,
            products: currentProducts,
            category: categories,
            brand: brands,
            totalPages: totalPages,
            currentPage: currentPage,
            startPage: startPage,
            endPage: endPage,
            totalProducts: totalProducts,
            showingStart: startIndex + 1,
            showingEnd: Math.min(endIndex, totalProducts),
            searchQuery: search // Pass search query back to the view
        });
    } catch (error) {
        console.log("Error in searching products:", error);
        res.status(500).render("error", {
            message: "An error occurred while searching products",
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
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
    logout,
    loadShopPage,
    filterProduct,
    filterByPrice,
    searchProducts,
}