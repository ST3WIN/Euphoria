const Order = require('../../models/orderSchema')
const User = require('../../models/userSchema')
const Wallet = require('../../models/walletSchema') 
const Product = require('../../models/productSchema')

const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            'orderItems': {
                $not: {
                    $elemMatch: {
                        'paymentStatus': 'Failed'
                    }
                }
            }
        })
        .populate({
            path: 'orderItems.product',
            select: 'productName productImage brand'
        })
        .populate({
            path: 'userId',
            select: 'firstName lastName email phone'
        })
        .select('orderItems.product orderItems.quantity orderItems.price orderItems.status orderItems.paymentStatus userId status returnReason finalAmount')
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

const getOrderDetails = async(req,res)=>{
    try {
        const orderId = req.params.orderId
        const orderData = await Order.findOne({
            _id: orderId 
        }).populate({
            path: 'orderItems.product',
            select: 'productName productImage salePrice'
        }).populate({
            path: 'userId',
            select: 'firstName lastName email phone address'
        });

        if (!orderData) {
            return res.redirect('/admin/pageError');
        }
        res.render("ordersDetails",{
            order: orderData,
            title: 'Order Details'
        })
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.redirect('/admin/pageError');
    }
}

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, productId, status } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Find the specific order item if productId is provided
        let orderItem;
        if (productId) {
            orderItem = order.orderItems.find(item => item.product.toString() === productId);
            if (!orderItem) {
                return res.status(404).json({ success: false, message: 'Product not found in order' });
            }
        }

        // Handle return approval for specific item
        if (status === 'Returned' && orderItem && orderItem.status === 'Return Requested') {
            const userId = order.userId;
            
            // Calculate refund amount for the specific item
            const totalItems = order.orderItems.length;
            const discountPerItem = order.discount / totalItems;
            const itemTotal = orderItem.price * orderItem.quantity;
            const refundAmount = itemTotal - discountPerItem;

            // Add refund to user's wallet
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: refundAmount }
            });

            // Create wallet transaction record
            const walletTransaction = new Wallet({
                userId,
                type: 'refunded',
                amount: refundAmount,
                description: `Refund for returned item in order`,
                orderId: order._id
            });
            await walletTransaction.save();

            // Restore product quantity for the specific item
            await Product.updateOne(
                { _id: orderItem.product },
                { $inc: { quantity: orderItem.quantity } }
            );

            // Update the specific item's status
            orderItem.status = status;
            orderItem.paymentStatus = "Refunded"
        } else if (productId) {
            // Update status for specific product
            orderItem.status = status;
            if(orderItem.status === 'Delivered' && order.paymentMethod === 'COD'){
                orderItem.paymentStatus = "Paid"
            }
        } else {
            // Update status for all items in the order
            order.orderItems.forEach(item => {
                item.status = status;
            });
        }

        await order.save();

        res.json({ 
            success: true, 
            message: productId ? 'Product status updated successfully' : 'Order status updated successfully'
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, message: 'Failed to update order status' });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId, productId } = req.body;
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.json({ success: false, error: 'Order not found' });
        }

        if (productId) {
            // Cancel specific product
            const orderItem = order.orderItems.find(item => item.product.toString() === productId);
            if (!orderItem) {
                return res.json({ success: false, error: 'Product not found in order' });
            }

            if (orderItem.status === 'Delivered') {
                return res.json({ success: false, error: 'Cannot cancel delivered item' });
            }
            if (orderItem.status === 'Cancelled') {
                return res.json({ success: false, error: 'Item is already cancelled' });
            }

            // Calculate refund amount for the specific item
            const totalItems = order.orderItems.length;
            const discountPerItem = order.discount / totalItems;
            const itemTotal = orderItem.price * orderItem.quantity;
            const refundAmount = itemTotal - discountPerItem;

            // Process refund if payment was made
            if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'WALLET' || order.paymentStatus === 'Paid') {
                await User.findByIdAndUpdate(order.userId, {
                    $inc: { wallet: refundAmount }
                });

                const walletTransaction = new Wallet({
                    userId: order.userId,
                    type: 'refunded',
                    amount: refundAmount,
                    description: `Refund for cancelled item in order`,
                    orderId: order._id
                });
                await walletTransaction.save();
            }

            // Update product quantity
            await Product.updateOne(
                { _id: orderItem.product },
                { $inc: { quantity: orderItem.quantity } }
            );

            orderItem.status = 'Cancelled';
        } else {
            // Cancel entire order
            if (order.orderItems.every(item => item.status === 'Delivered')) {
                return res.json({ success: false, error: 'Cannot cancel delivered order' });
            }
            if (order.orderItems.every(item => item.status === 'Cancelled')) {
                return res.json({ success: false, error: 'Order is already cancelled' });
            }

            // Only cancel items that are not delivered
            for (const item of order.orderItems) {
                if (item.status !== 'Delivered') {
                    item.status = 'Cancelled';
                    
                    // Update product quantity
                    await Product.updateOne(
                        { _id: item.product },
                        { $inc: { quantity: item.quantity } }
                    );
                }
            }

            // Calculate total refund amount for cancellable items
            const refundAmount = order.orderItems.reduce((total, item) => {
                if (item.status === 'Cancelled') {
                    const itemTotal = item.price * item.quantity;
                    const discountPerItem = order.discount / order.orderItems.length;
                    return total + (itemTotal - discountPerItem);
                }
                return total;
            }, 0);

            // Process refund if payment was made
            if (refundAmount > 0 && (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'WALLET' || order.paymentStatus === 'Paid')) {
                await User.findByIdAndUpdate(order.userId, {
                    $inc: { wallet: refundAmount }
                });

                const walletTransaction = new Wallet({
                    userId: order.userId,
                    type: 'refunded',
                    amount: refundAmount,
                    description: `Refund for cancelled items in order`,
                    orderId: order._id
                });
                await walletTransaction.save();
            }
        }

        await order.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.json({ success: false, error: error.message });
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, productId } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // Find the specific order item
        const orderItem = order.orderItems.find(item => item.product.toString() === productId);
        if (!orderItem) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in order'
            });
        }

        // Calculate refund amount by distributing discount evenly
        const totalItems = order.orderItems.length;
        const discountPerItem = order.discount / totalItems;
        const itemTotal = orderItem.price * orderItem.quantity;
        const refundAmount = itemTotal - discountPerItem;

        // Update product quantity
        await Product.updateOne(
            { _id: productId },
            { $inc: { quantity: orderItem.quantity } }
        );

        // If payment was made, process refund to wallet
        if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'WALLET' || order.paymentStatus === 'Paid') {
            await User.findByIdAndUpdate(order.userId, {
                $inc: { wallet: refundAmount }
            });

            // Create wallet transaction record
            const walletTransaction = new Wallet({
                userId: order.userId,
                type: 'refunded',
                amount: refundAmount,
                description: `Refund for cancelled item in order (by admin)`,
                orderId: order._id
            });
            await walletTransaction.save();
        }

        // Update only the specific item's status to Cancelled
        const itemIndex = order.orderItems.findIndex(item => item.product.toString() === productId);
        if (itemIndex !== -1) {
            order.orderItems[itemIndex].status = 'Cancelled';
        }

        await order.save();

        res.json({
            success: true,
            message: 'Item cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel item error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel item'
        });
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
    cancelOrderItem,
    getStatusBadgeClass,
    orderDetails,
    getOrderDetails
}