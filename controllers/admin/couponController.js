const Coupon = require("../../models/couponSchema")
const mongoose = require("mongoose")

const loadCoupon = async(req,res)=>{
    try {
        const findCoupons = await Coupon.find({})
        return res.render("coupon",{coupons:findCoupons})     
    } catch (error) {
        console.log("Coupon page error",error)
        return res.redirect("/pageError")
    }
}

const createCoupon = async(req,res)=>{
    try {
        const data = {
            couponName:req.body.couponName,
            startDate:new Date(req.body.startDate+"T00:00:00"),
            endDate:new Date(req.body.endDate +"T00:00:00"),
            offerPrice:parseInt(req.body.offerPrice),
            minimumPrice:parseInt(req.body.minimumPrice)
        }
        const newCoupon = new Coupon({
            name:data.couponName,
            createdOn:data.startDate,
            expireOn:data.endDate,
            offerPrice:data.offerPrice,
            minimumPrice:data.minimumPrice
        })
        await newCoupon.save()
        return res.redirect("/admin/coupon")
    } catch (error) {
        console.log("Error creating coupon",error)
        return res.redirect("/pageError")
    }
}

const editCoupon = async(req,res)=>{
    try {
        const id = req.query.id
        const findCoupon = await Coupon.findOne({_id:id})
        res.render("edit-coupon",{
            findCoupon:findCoupon
        })
    } catch (error) {
        res.redirect("/pageError")      
    }
}

const updateCoupon = async (req, res) => {
    try {
        // 1. Add input validation
        if (!req.body.couponId) {
            return res.status(400).json({
                success: false,
                message: "Coupon ID is required"
            });
        }

        const couponId = req.body.couponId;
        const oid = new mongoose.Types.ObjectId(couponId);
        
        // 2. Verify coupon exists first
        const selectedCoupon = await Coupon.findOne({ _id: oid });
        if (!selectedCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }

        console.log("Received update data:", req.body);

        // 3. Parse dates
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format"
            });
        }

        const updateData = {
            name: req.body.couponName,
            createdOn: startDate,
            expireOn: endDate,
            offerPrice: parseInt(req.body.offerPrice),
            minimumPrice: parseInt(req.body.minimumPrice)
        };

        console.log("Update data:", updateData);

        // 4. Proper update with error handling
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            oid,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            return res.status(500).json({
                success: false,
                message: "Failed to update coupon"
            });
        }

        console.log("Updated coupon:", updatedCoupon);

        res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            coupon: updatedCoupon
        });

    } catch (error) {
        console.error("Error in updating coupon:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const deleteCoupon = async(req,res)=>{
    try {
        const id = req.query.id
        await Coupon.deleteOne({_id:id})
        res.status(200).send({success:true,message:"Coupon deleted successfully"})
    } catch (error) {
        console.log("Error deleting coupon",error)
        res.redirect("/pageError")        
    }
}

module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon,
    updateCoupon,
    deleteCoupon
}