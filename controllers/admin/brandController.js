const Brand = require("../../models/brandSchema");
const Product = require("../../models/productSchema");

const getBrandPage = async(req,res)=>{
    try {
        if(!req.session.admin){
            return res.redirect("/admin");
        }else{
        const error = req.query.error || "";
        const success = req.query.success || "";
        const page = parseInt(req.query.page)||1;
        const limit =10;
        const skip = (page-1)*limit;
        const brandData = await Brand.find({}).sort({createAt:1}).skip(skip).limit(limit);
        const totalBrands = await Brand.countDocuments();
        const totalPages= Math.ceil(totalBrands/limit);
        const reverseBrand = brandData.reverse();
        return res.render("brands",{
            data :reverseBrand,
            currentpage:page,
            totalPages:totalPages,
            totalBrands:totalBrands,
            error :error,
            success:success,
        });
    }

    } catch (error) {
        res.redirect("/pageError");
    }
}

const addBrand = async (req, res) => {
    try {
        console.log("Request body:", req.body); // Check form data
        console.log("Uploaded file:", req.file); // Check file upload

        const brand = req.body.brandName;
        const image = req.file?.filename; // Changed to filename
        console.log("Image file name:", image);

        if (!image) {
            console.log("File upload failed or no file provided");
            return res.redirect("/admin/brands?error=File upload failed");
        }

        // const findBrand = await Brand.findOne({ brandName: brand });
        const findBrand = await Brand.findOne({ brandName: { $regex: `^${brand}$`, $options: "i" } });
        console.log(findBrand, brand, "already exists brand");

        if (findBrand) {
            console.log("Brand already exists");
            return res.redirect("/admin/brands?error=Brand already exists");
        }

        console.log("Saving data", brand, image);
        const newBrand = new Brand({
            brandName: brand,
            brandImage: image,
        });
        await newBrand.save();
        console.log("Data saved", newBrand);
        console.log("Brand added successfully");

        res.redirect("/admin/brands?success=Brand added successfully");
    } catch (error) {
        console.error("Error adding brand:", error);
        res.redirect("/admin/pageError");
    }
}

module.exports = {
    getBrandPage,
    addBrand
}
