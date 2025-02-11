const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Wallet = require('../../models/walletSchema') 
const Product = require('../../models/productSchema')

const getOrders = async (req, res) => {
    try {
        const orders = await Order.find()
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage brand'
            })
            .populate({
                path: 'address',
                select: 'firstName lastName phone'
            })
            .sort({ createdOn: -1 });
        
        res.render('order', { 
            orders,
            title: 'Orders Management'
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.redirect('/admin/pageError');
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (status === 'Returned' && order.status === 'Return Requested') {
            const userId = order.address;
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: order.finalAmount }
            });
            const walletTransaction = new Wallet({
                userId,
                type: 'refunded',
                amount: order.finalAmount,
                description: `Refund for returned order`,
                orderId: order._id
            });
            await walletTransaction.save();
            for (const item of order.orderItems) {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { quantity: item.quantity } }
                );
            }
        }

        order.status = status;
        if (status === 'Returned' && order.paymentStatus === 'Paid') {
            order.paymentStatus = 'Refunded';
        }
        await order.save();

        res.json({ success: true, message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findById(orderId);
        if (!order) {
            return res.json({ success: false, error: 'Order not found' });
        }
        if (order.status === 'Delivered') {
            return res.json({ success: false, error: 'Cannot cancel delivered order' });
        }
        if (order.status === 'Cancelled') {
            return res.json({ success: false, error: 'Order is already cancelled' });
        }
        order.status = 'Cancelled';
        await order.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.json({ success: false, error: error.message });
    }
}

module.exports = {
    getOrders,
    updateOrderStatus,
    cancelOrder
}