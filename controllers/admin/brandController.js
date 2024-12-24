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

const  blockbrand = async (req,res)=>{
    try {
        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/brands");
    } catch (error) {
        res.redirect("admin/pageError");
    }
};

const unblockbrand = async(req,res)=>{
    try {
        const id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/brands");
    } catch (error) {
        res.redirect("admin/pageError");
    }
}

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params; // Get the brand ID from the URL path
        const brand = await Brand.findByIdAndDelete(id); // Assuming you have a Brand model
        if (!brand) {
            return res.status(404).send({ message: "Brand not found" });
        }
        res.status(200).send({ message: "Brand deleted successfully" });
    } catch (error) {
        res.status(500).send({ message: "Error deleting brand", error });
    }
}

const updateBrand = async (req, res) => {
    try {
        console.log("update working");
        const id = req.body.brandId;
        const brandName = req.body.brandName;
        const image = req.file;

        // const findBrand = await Brand.findOne({ brandName: brandName });
        const findBrand = await Brand.findOne({ brandName: { $regex: `^${brandName}$`, $options: "i" } });
        if (findBrand) {
            console.log("find brand");
            return res.status(400).json({ success: false, message: "Brand already exists" });
        } else {
            const updateBrand = await Brand.updateOne(
                { _id: id },
                { $set: { brandName: brandName, brandImage: image?.filename } }
            );

            if (!updateBrand.modifiedCount) {
                return res.status(404).json({ success: false, message: "Brand not found" });
            }

            return res.status(200).json({ success: true, message: "Brand updated successfully" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Error updating brand", error });
    }
}

module.exports = {
    getBrandPage,
    addBrand,
    blockbrand,
    unblockbrand,
    deleteBrand,
    updateBrand
}
