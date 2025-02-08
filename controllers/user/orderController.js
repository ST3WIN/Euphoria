const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema")
const crypto = require("crypto");
const Razorpay = require("razorpay");

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_ID_KEY, 
    key_secret: process.env.RAZORPAY_SECRET_KEY
});

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        let { addressIndex, couponCode, paymentMethod, finalAmount } = req.body; // Change const to let

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const userAddress = await Address.findOne({ userId });
        if (!userAddress || !userAddress.address[addressIndex]) {
            return res.status(400).json({ success: false, message: 'Invalid address' });
        }

        let totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        let discount = 0;
        

        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode, expireOn: { $gt: new Date() } });
            if (coupon && totalPrice >= coupon.minimumPrice) {
                discount = coupon.offerPrice;
                finalAmount = totalPrice - discount; // Now this reassignment works
            } else {
                return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
            }
        }

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product || product.quantity < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${item.productId.productName}` });
            }

            product.quantity -= item.quantity;
            await product.save();
        }

        if (paymentMethod.toUpperCase() === "RAZORPAY") {
            // Create Razorpay order
            const actualFinalAmount = finalAmount || (totalPrice - (discount || 0));
            const razorpayOrder = await razorpayInstance.orders.create({
                amount: finalAmount * 100, // Convert to paise
                currency: "INR",
                receipt: `order_${new Date().getTime()}`,
                payment_capture: 1 // Auto-capture payment
            });

            return res.json({
                success: true,
                message: "Order created for Razorpay",
                orderId: razorpayOrder.id,
                amount: finalAmount,
                key: process.env.RAZORPAY_ID_KEY
            });
        } else {
            // Create order for COD or Wallet
            const order = new Order({
                orderItems: cart.items.map(item => ({
                    product: item.productId._id,
                    quantity: item.quantity,
                    price: item.totalPrice / item.quantity
                })),
                totalPrice,
                discount,
                finalAmount,
                address: userId,
                paymentMethod: paymentMethod.toUpperCase(),
                paymentStatus: 'Pending',
                status: 'Pending',
                createdOn: new Date(),
                couponApplied: !!couponCode,
            });

            await order.save();
            cart.items = [];
            await cart.save();

            return res.json({ success: true, message: 'Order placed successfully', orderId: order._id });
        }
    } catch (error) {
        console.error('Place order error:', error);
        res.status(500).json({ success: false, message: 'Failed to place order' });
    }
};


const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, finalAmount,discount } = req.body;
        const userId = req.session.user._id;

        // Verify the payment signature
        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            console.error("Signature mismatch. Payment verification failed.");
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        // Find the user's cart
        const cart = await Cart.findOne({ userId });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // Create and save the order
        const order = new Order({
            orderItems: cart.items.map(item => ({
                product: item.productId,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity
            })),
            totalPrice: cart.items.reduce((sum, item) => sum + item.totalPrice, 0),
            discount:discount,
            finalAmount: finalAmount, // Use the finalAmount passed from the frontend
            paymentMethod: 'Razorpay',
            paymentStatus: 'Paid',
            razorpayPaymentId: razorpay_payment_id,
            address: userId,
            status: 'Pending',
            createdOn: new Date()
        });

        await order.save();

        // Clear the cart
        cart.items = [];
        await cart.save();
        

        // Send success response
        res.json({ 
            success: true, 
            message: "Payment verified successfully",
            orderId: order._id 
        });

    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, message: "Payment verification failed" });
    }
};


const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const orders = await Order.find({ address: userId })
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage salePrice'
            })
            .sort({ createdOn: -1 });

        res.json({
            success: true,
            orders
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId, address: userId });
        
        if (!order) {
            req.session.orderMessage = {
                type: 'error',
                message: 'Order not found'
            };
            return res.redirect('/userProfile');
        }

        if (order.status !== 'Pending' && order.status !== 'Processing') {
            req.session.orderMessage = {
                type: 'error',
                message: 'Order cannot be cancelled at this stage'
            };
            return res.redirect('/userProfile');
        }

        
        for (const item of order.orderItems) {
            await Product.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } }
            );
        }

        order.status = 'Cancelled';
        await order.save();

        req.session.orderMessage = {
            type: 'success',
            message: 'Order cancelled successfully'
        };
        res.redirect('/userProfile');

    } catch (error) {
        console.error('Cancel order error:', error);
        req.session.orderMessage = {
            type: 'error',
            message: 'Failed to cancel order'
        };
        res.redirect('/userProfile');
    }
};

module.exports = {
    placeOrder,
    getUserOrders,
    cancelOrder,
    verifyPayment
};