const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressIndex } = req.body;

        
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        
        const userAddress = await Address.findOne({ userId });
        if (!userAddress || !userAddress.address[addressIndex]) {
            return res.status(400).json({ success: false, message: 'Invalid address' });
        }

        
        const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

        
        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product) {
                return res.status(400).json({
                    success: false,
                    message: 'Product not found'
                });
            }
            
            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock for ${product.productName}. Only ${product.quantity} available.`
                });
            }

            
            product.quantity -= item.quantity;
            
           
            if (product.quantity === 0) {
                product.status = "Out of stock";
            }
            
            await product.save();
        }

        // Create new order
        const order = new Order({
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity
            })),
            totalPrice,
            finalAmount: totalPrice,
            address: userId,
            status: 'Pending',
            createdOn: new Date()
        });

        await order.save();

        
        cart.items = [];
        await cart.save();

        res.json({
            success: true,
            message: 'Order placed successfully',
            orderId: order._id
        });

    } catch (error) {
        console.error('Place order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to place order'
        });
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
    cancelOrder
};