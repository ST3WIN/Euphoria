const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")
const Brand = require("../../models/brandSchema")

const productDetails = async(req,res)=>{
    try {
        const user = req.session.user || null
        const userData = await User.findById(user)
        const productId = req.query.id 
        const product = await Product.findById(productId).populate("category")
        const findCategory = await product.category
        const size = await Product.size
        const categoryOffer = findCategory?.categoryOffer || 0
        const productOffer = product.productOffer || 0
        const totalOffer = categoryOffer+productOffer
        res.render("productDetails",{
            user:userData,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
            size:size
        })
    } catch (error) {
        console.log("Product details error",error)
    }
}
const getAllBrands = async (req, res) => {
    try {
        const user = req.session.user || null
        const search = req.query.search || ""
        const page = parseInt(req.query.page) || 1
        const limit = 6  // Changed to 6 to match your grid layout

        // Find brands with search and pagination
        const brandData = await Brand.find({
            brandName: { $regex: new RegExp(".*" + search + ".*", "i") }
        })
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 })
        .exec()

        // Get total count for pagination
        const count = await Brand.countDocuments({
            brandName: { $regex: new RegExp(".*" + search + ".*", "i") }
        })
            if(user){
            const userData = await User.findById(user)
            if (brandData) {
                res.render("brandPage",{
                    user:userData,
                    data: brandData,
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    search: search
                })
            } else {
                res.render("pageError")
            }
        }else{
            return res.render("brandPage",{
                data: brandData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                search: search
            })
        }
    } catch (error) {
        console.error("Error in getAllBrands:", error)
        res.redirect("/admin/pageError")
    }
}

module.exports = {
    productDetails,
    getAllBrands
}