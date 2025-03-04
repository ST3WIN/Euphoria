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

        // Validate file uploads
        if (!req.files || req.files.length === 0) {
            const category = await Category.find({isListed:true});
            const brand = await Brand.find({isBlocked:false});
            return res.render("productPage", {
                category: category,
                brand: brand,
                error: "Please upload at least one product image"
            });
        }

        // Check if product already exists
        const productExists = await Product.findOne({
            productName: { $regex: `^${products.productName}$`, $options: "i" }
        });

        if (!productExists) {
            const images = [];

            // Handle image upload and resizing
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.resolve(
                        "public",
                        "uploads",
                        "product-images",
                        req.files[i].filename
                    );

                    try {
                        // Resize and save the image
                        await sharp(originalImagePath)
                            .resize({ width: 440, height: 440 })
                            .toFile(resizedImagePath);

                        images.push(req.files[i].filename);
                    } catch (error) {
                        // If image processing fails, delete the uploaded file
                        fs.unlinkSync(originalImagePath);
                        throw new Error(`Failed to process image ${req.files[i].originalname}`);
                    }
                }
            }


            const categoryId = await Category.findOne({ name: products.category });
            if (!categoryId) {
                return res.status(400).json("Invalid category");
            }

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
}

const getAllProducts = async(req,res)=>{
    try {
        const search = req.query.search || ""
        const page = parseInt(req.query.page) || 1 
        const limit = 5 
        const productData = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],
        }).limit(limit*1).skip((page-1)*limit).populate("category").exec()
        const count = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],
        }).countDocuments()
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        if(category && brand){
            res.render("products",{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand,
                search: search
            })
        }else{
            res.render("pageError")
        }
    } catch (error) {
        res.redirect("/admin/pageError")
    }
}


const addProductOffer = async(req,res)=>{
    try {
        const {productId,percentage} = req.body
        const findProduct = await Product.findOne({_id:productId})
        const findCategory = await Category.findOne({_id:findProduct.category})
        
        if(findCategory.categoryOffer > 0) {
            return res.json({status:false, message:"This product belongs to a category with an existing offer"})
        }
        findProduct.salePrice = findProduct.regularPrice - Math.floor(findProduct.regularPrice * (percentage / 100));
        findProduct.productOffer = parseInt(percentage)
        await findProduct.save()
        findCategory.categoryOffer = 0
        await findCategory.save()
        res.json({status:true})
    } catch (error) {
        res.redirect("/pageError")
        res.status(500).json({status:false,message:"Internal server error"})
    }
}

const removeProductOffer = async(req,res)=>{
    try {
        const {productId} = req.body
        const findProduct = await Product.findOne({_id:productId})
        const percentage = findProduct.productOffer
        findProduct.salePrice = findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100))
        findProduct.productOffer = 0
        await findProduct.save()
        res.json({status:true})
    } catch (error) {
        res.redirect("/pageError")        
    }
}

const blockProduct = async(req,res)=>{
    try {
        let id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/admin/pageError")
    }
}

const unblockProduct = async(req,res)=>{
    try {
        let id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/products")
    } catch (error) {
        res.redirect("/admin/pageError")
    }
}

const getEditProduct = async(req,res)=>{
    try {
        const id = req.query.id
        const product = await Product.findOne({_id:id})
        const category = await Category.find({})
        const brand = await Brand.find({})
        res.render("editProduct",{
            product:product,
            category:category,
            brand:brand
        })
    } catch (error) {
        res.redirect("/pageError")
    }
}

const editProduct = async(req,res)=>{
    try {
        const id = req.params.id;
        const product = await Product.findOne({_id:id})
        const data = req.body
        const existingProduct = await Product.findOne({
            productName:data.productName,
            _id:{$ne:id}
        })
        if(existingProduct){
            return res.status(400).json({error:"Product with this name already exists."})
        }
        const images = []
        if(req.files && req.files.length>0){
            for(let i=0;i<req.files.length;i++){
                images.push(req.files[i].filename)
            }
        }
        const updateFields = {
            productName:data.productName,
            description:data.description,
            brand:data.brand,
            category:product.category,
            regularPrice:data.regularPrice,
            salePrice:data.salePrice,
            quantity:data.quantity,
            size:data.size
        }
        if(req.files.length>0){
            updateFields.$push = {productImage:{$each:images}}
        }
        await Product.findByIdAndUpdate(id,updateFields,{new:true})
        res.redirect("/admin/products")
    } catch (error) {
        console.error(error)
        res.redirect("/pageError")
    }
}
const deleteSingleImage = async(req,res)=>{
    try {
        const {imageIdToServer,productIdToServer}= req.body;
        console.log(req.body);
        
        const product = await Product.findByIdAndUpdate(productIdToServer,
            {$pull:{productImage:imageIdToServer}});

        const imagePath = path.join("public","uploads","re-image",imageIdToServer);
        
        // Using synchronous fs methods
        if(fs.existsSync(imagePath)){
            fs.unlinkSync(imagePath);
            console.log(`image ${imageIdToServer} deleted successfully`);
            res.status(200).json({status: true, message:"Image deleted successfully"});
        } else {
            console.log(`image not found ${imageIdToServer}`);
            res.status(400).json({status: false, message:"Image Path not found"});
        }
    } catch (error) {
        console.log("single image delete error", error);
        res.status(500).json({status: false, message:"Internal Server Error"});
    }
};

module.exports = {
    getProductsPage,
    addProducts,
    getAllProducts,
    addProductOffer,
    removeProductOffer,
    blockProduct,
    unblockProduct,
    getEditProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}