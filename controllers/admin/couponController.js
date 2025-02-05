const Coupon = require("../../models/couponSchema")

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

module.exports = {
    loadCoupon,
    createCoupon,
    editCoupon
}