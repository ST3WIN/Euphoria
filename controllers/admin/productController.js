const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const getProductsPage = async(req,res)=>{
    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        res.render("productPage",{
            category:category,
            brand:brand
        })
    } catch (error) {
        console.log("Products page error",error)
        res.redirect("/pageError")
    }
}

const addProducts = async (req, res) => {
    try {
        const products = req.body;

        // Check if product already exists
        const productExists = await Product.findOne({
            productName: { $regex: `^${products.productName}$`, $options: "i" }
        });

        if (!productExists) {
            const images = [];

            // Handle image upload and resizing
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path; // Path from Multer
                    const resizedImagePath = path.join(
                        "public",
                        "uploads",
                        "product-images",
                        req.files[i].filename // Use `filename`, not `fileName`
                    );

                    // Resize and save the image
                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);

                    images.push(req.files[i].filename); // Push the filename
                }
            }

            // Find category ID
            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).json("Invalid category");
            }

            // Create and save the new product
            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdOn: new Date(),
                quantity: products.quantity,
                size: products.size,
                productImage: images,
                status: "Available",
            });

            await newProduct.save();
            console.log(newProduct)
            return res.redirect("/admin/addProducts");
        } else {
            return res.status(400).json("Product already exists");
        }
    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/admin/pageError");
    }
};

module.exports = {
    getProductsPage,
    addProducts
}