const Coupon = require("../../models/couponSchema");
const Cart = require("../../models/cartSchema")

const applyCoupon =  async(req, res) => {
    try {
        const { couponCode } = req.body
        const userId = req.session.user._id

        const cart = await Cart.findOne({ userId }).populate('items.productId')
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' })
        }

        const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

        const coupon = await Coupon.findOne({ name: couponCode, expireOn: { $gt: new Date() } })
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid or expired coupon' })
        }

        // const hasUsedCoupon = await Coupon.findOne({
        //     _id: coupon._id,
        //     userId: userId
        // });
        
        // if (hasUsedCoupon) {
        //     return res.status(400).json({ 
        //         success: false, 
        //         message: 'You have already used this coupon' 
        //     });
        // }

        if (totalPrice < coupon.minimumPrice) {
            return res.status(400).json({ success: false, message: `Minimum order amount for this coupon is ₹${coupon.minimumPrice}` });
        }

        // await Coupon.findByIdAndUpdate(
        //     coupon._id,
        //     {$push:{userId:userId}}
        // )

        const discount = coupon.offerPrice;
        const finalAmount = totalPrice - discount;

        res.json({
            success: true,
            message: 'Coupon applied successfully',
            discount,
            finalAmount
        })

    } catch (error) {
        console.error('Apply coupon error:', error);
        res.status(500).json({ success: false, message: 'Failed to apply coupon' });
    }
}

module.exports = {
    applyCoupon
}