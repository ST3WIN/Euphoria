const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema")
const { productDetails } = require("./productController");
  
const addToCart = async(req, res) => {
    try {
        const userId = req.session.user;
        const { productId, quantity = 1 } = req.body;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to continue'
            });
        }
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }
        // Find product and check availability
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found'
            });
        }
        // Check if product is blocked
        if (product.isBlocked) {
            return res.status(400).json({
                success: false,
                message: 'This product is currently unavailable'
            });
        }
        // Check stock availability
        if (!product.quantity || product.quantity < 1) {
            return res.status(400).json({
                success: false,
                message: 'Product is out of stock'
            });
        }
        // Find or create cart
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }
        // Check if product exists in cart
        const existingItem = cart.items.find(item => 
            item.productId.toString() === productId
        );
        if (existingItem) {
            // Check maximum quantity
            if (existingItem.quantity + quantity > 5) {
                return res.status(400).json({
                    success: false,
                    message: 'Maximum 5 items allowed per product'
                });
            }
            // Check if requested quantity is available
            if (existingItem.quantity + quantity > product.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.quantity} items available in stock`
                });
            }
            existingItem.quantity += quantity;
            existingItem.totalPrice = product.salePrice * existingItem.quantity;
        } else {
            // Check if requested quantity is available for new item
            if (quantity > product.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.quantity} items available in stock`
                });
            }
            cart.items.push({
                productId: product._id,
                quantity: quantity,
                price: product.salePrice,
                totalPrice: product.salePrice * quantity
            });
        }
        await cart.save();
        res.status(200).json({
            success: true,
            message: 'Product added to cart successfully'
        });
    } catch (error) {
        console.error('Error in addToCart:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const getCart = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect('/login');
        }
        const userData = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart) {
            return res.render("cart", {
                user: userData,
                cartItems: [],
                subtotal: 0,
                total: 0,
                requireLogin: false
            });
        }
        const cartItems = cart.items;
        const subtotal = cartItems.reduce((total, item) => total + item.totalPrice, 0);
        const total = subtotal;  // Add shipping or other costs if needed
        res.render("cart", {
            user: userData,
            cartItems: cartItems,
            subtotal: subtotal,
            total: total,
            requireLogin: false
        });
    } catch (error) {
        console.error("Error in getCart:", error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const updateQuantity = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to continue'
            });
        }
        const { productId, quantity } = req.body;
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }
        const cartItem = cart.items.find(item => 
            item.productId.toString() === productId.toString()
        );
        if (!cartItem) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }
        // Update quantity and total price
        cartItem.quantity = quantity;
        cartItem.totalPrice = quantity * cartItem.price;
        await cart.save();
        return res.status(200).json({
            success: true,
            message: 'Cart updated successfully'
        });
    } catch (error) {
        console.error('Error in updateQuantity:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

const removeFromCart = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Please login to continue'
            });
        }
        const { productId } = req.body;
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: 'Product ID is required'
            });
        }
        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({
                success: false,
                message: 'Cart not found'
            });
        }
        const itemIndex = cart.items.findIndex(item => 
            item.productId.toString() === productId.toString()
        );
        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Item not found in cart'
            });
        }
        cart.items.splice(itemIndex, 1);
        await cart.save();

        return res.status(200).json({
            success: true,
            message: 'Item removed from cart successfully'
        });
    } catch (error) {
        console.error('Error in removeFromCart:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

module.exports = {
    addToCart,
    getCart,
    updateQuantity,
    removeFromCart
}