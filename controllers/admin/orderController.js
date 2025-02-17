const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Wallet = require('../../models/walletSchema') 
const Product = require('../../models/productSchema')

const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({ paymentStatus: { $ne: 'Failed' } })
            .populate({
                path: 'orderItems.product',
                select: 'productName productImage brand'
            })
            .populate({
                path: 'userId',
                select: 'firstName lastName email phone'  // Include both firstName and lastName
            })
            .select('orderItems userId status returnReason finalAmount paymentStatus')
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

        // Handle return approval
        if (status === 'Returned' && order.status === 'Return Requested') {
            // Use order.userId instead of order.address
            const userId = order.userId;
            
            // Add refund to user's wallet
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: order.finalAmount }
            });

            // Create wallet transaction record
            const walletTransaction = new Wallet({
                userId,
                type: 'refunded',
                amount: order.finalAmount,
                description: `Refund for returned order`,
                orderId: order._id
            });
            await walletTransaction.save();

            // Restore product quantities
            for (const item of order.orderItems) {
                await Product.updateOne(
                    { _id: item.product },
                    { $inc: { quantity: item.quantity } }
                );
            }
        }

        // Update order status
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

const getStatusBadgeClass = (status) => {
    switch (status) {
        case 'Pending':
            return 'badge-warning';
        case 'Processing':
            return 'badge-info';
        case 'Shipped':
            return 'badge-primary';
        case 'Delivered':
            return 'badge-success';
        case 'Cancelled':
            return 'badge-danger';
        case 'Return Requested':
            return 'badge-secondary';
        case 'Returned':
            return 'badge-dark';
        default:
            return 'badge-secondary';
    }
};

const orderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;
        const orderData = await Order.findOne({
            _id: orderId,
            address: userId  
        }).populate({
            path: 'orderItems.product',
            select: 'productName productImage salePrice'
        });

        if (!orderData) {
            return res.redirect('/pageNotFound');
        }

        const addressData = await Address.findOne({ userId: userId });
        if (!addressData || !addressData.address || addressData.address.length === 0) {
            return res.redirect('/pageNotFound');
        }
        
        const userAddress = addressData.address[0];
        const userData = await User.findById(userId);
        const formatDate = (date) => {
            return new Date(date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        };

        res.render("orderDetails", {
            user: userData,
            order: orderData,
            address: userAddress,
            formatDate: formatDate,
            getStatusBadgeClass: getStatusBadgeClass
        });

    } catch (error) {
        console.error('Order details error:', error);
        res.redirect("/pageNotFound");
    }
};


module.exports = {
    getOrders,
    updateOrderStatus,
    cancelOrder,
    orderDetails
}