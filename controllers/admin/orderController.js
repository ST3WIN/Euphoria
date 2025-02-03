const Order = require('../../models/orderSchema');

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
        
        // Validate the status
        const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return res.json({ success: false, error: 'Invalid status' });
        }

        // Check if order exists and is not already cancelled
        const order = await Order.findById(orderId);
        if (!order) {
            return res.json({ success: false, error: 'Order not found' });
        }
        if (order.status === 'Cancelled') {
            return res.json({ success: false, error: 'Cannot update cancelled order' });
        }

        // Update the order status
        order.status = status;
        await order.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.json({ success: false, error: error.message });
    }
}

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Check if order exists and can be cancelled
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

        // Update the order status to cancelled
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