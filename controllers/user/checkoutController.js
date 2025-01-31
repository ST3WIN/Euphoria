const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require('../../models/cartSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
// const Coupon = require("../../models/couponSchema");
// const Wallet = require("../../models/walletSchema")
// const Razorpay = require('razorpay');
const crypto = require('crypto');

const getCheckout = async (req, res) => {
    try {
        // Get user's cart items
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        
        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        // Get user's addresses
        const userAddresses = await Address.findOne({ userId });
        const addresses = userAddresses ? userAddresses.address : [];
        const userData = await User.findById(userId);
        // Get user's wallet balance
        const user = await User.findById(userId);
        const walletBalance = user.wallet || 0;

        // Calculate total
        const cartItems = cart.items;
        const total = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

        res.render("checkout", {
            cartItems,
            addresses,
            walletBalance,
            total,
            user:userData
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).redirect('/error');
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressData = req.body;
        
        let userAddress = await Address.findOne({ userId });
        
        if (!userAddress) {
            userAddress = new Address({
                userId,
                address: []
            });
        }
        
        userAddress.address.push(addressData);
        await userAddress.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Add address error:', error);
        res.status(500).json({ success: false, message: 'Failed to add address' });
    }
};

const getAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressIndex = req.params.index;
        
        const userAddress = await Address.findOne({ userId });
        if (!userAddress || !userAddress.address[addressIndex]) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        
        res.json(userAddress.address[addressIndex]);
    } catch (error) {
        console.error('Get address error:', error);
        res.status(500).json({ success: false, message: 'Failed to get address' });
    }
};

const updateAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressIndex = req.params.index;
        const addressData = req.body;
        
        const userAddress = await Address.findOne({ userId });
        if (!userAddress || !userAddress.address[addressIndex]) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        
        userAddress.address[addressIndex] = addressData;
        await userAddress.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ success: false, message: 'Failed to update address' });
    }
};

module.exports = {
    getCheckout,
    addAddress,
    getAddress,
    updateAddress
};
