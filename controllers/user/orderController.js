const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Coupon = require("../../models/couponSchema")
const Wallet = require("../../models/walletSchema")
const User = require("../../models/userSchema")
const PDFDocument = require('pdfkit')
const crypto = require("crypto");
const Razorpay = require("razorpay");

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_ID_KEY, 
    key_secret: process.env.RAZORPAY_SECRET_KEY
});

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        let { addressIndex, couponCode, paymentMethod, finalAmount, address } = req.body;

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const userAddress = await Address.findOne({ userId });
        if (!userAddress || !userAddress.address[addressIndex]) {
            return res.status(400).json({ success: false, message: 'Invalid address' });
        }

        const selectedAddress = userAddress.address[addressIndex];

        let totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        let discount = 0;

        if (couponCode) {
            const coupon = await Coupon.findOne({ name: couponCode, expireOn: { $gt: new Date() } });
            if (coupon && totalPrice >= coupon.minimumPrice) {
                discount = coupon.offerPrice;
                finalAmount = totalPrice - discount; 
            } else {
                return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
            }
        }

        // Validate wallet balance
        if (paymentMethod.toUpperCase() === "WALLET") {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(400).json({ success: false, message: 'User not found' });
            }
            if (user.wallet < finalAmount) {
                return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
            }
        }

        // Validate stock
        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product || product.quantity < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${item.productId.productName}` });
            }
        }

        const orderData = {
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity
            })),
            userId:userId,
            totalPrice,
            discount,
            finalAmount,
            address: [selectedAddress],
            paymentMethod: paymentMethod.toUpperCase(),
            status: 'Pending',
            createdOn: new Date(),
            couponApplied: !!couponCode,
        };

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
                key: process.env.RAZORPAY_ID_KEY,
                addressIndex: addressIndex,
                discount: discount || 0
            });
        } else if (paymentMethod.toUpperCase() === "WALLET") {
            for(const item of cart.items){
                const product = await Product.findById(item.productId._id)
                product.quantity -= item.quantity;
                await product.save();
            }
            orderData.paymentStatus = 'Paid';
        } else {
            // COD
            for(const item of cart.items){
                const product = await Product.findById(item.productId._id)
                product.quantity -= item.quantity;
                await product.save();
            }
            orderData.paymentStatus = 'Pending';
        }

        const order = new Order(orderData);
        await order.save();

        // Handle wallet transaction if payment method is wallet
        if (paymentMethod.toUpperCase() === "WALLET") {
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: -finalAmount }
            });
            const walletTransaction = new Wallet({
                userId,
                type: 'debit',
                amount: finalAmount,
                description: `Payment for purchase`,
                orderId: order._id,
            });
            await walletTransaction.save();
        }

        // Clear cart
        cart.items = [];
        await cart.save();

        return res.json({ 
            success: true, 
            message: 'Order placed successfully', 
            orderId: order._id 
        });

    } catch (error) {
        console.error('Place order error:', error);
        res.status(500).json({ success: false, message: 'Failed to place order' });
    }
};


const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, finalAmount, discount, addressIndex, orderId } = req.body;
        const userId = req.session.user._id;

        // Verify the payment signature
        const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest("hex");

        if (generatedSignature !== razorpay_signature) {
            console.error("Signature mismatch. Payment verification failed.");
            return res.status(400).json({ success: false, message: "Payment verification failed" });
        }

        // Check if this is a retry payment
        if (orderId) {
            // Update existing order
            const order = await Order.findOne({ _id: orderId, userId }).populate('orderItems.product');
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Reduce product quantities
            for (const item of order.orderItems) {
                const product = await Product.findById(item.product);
                if (!product || product.quantity < item.quantity) {
                    return res.status(400).json({ 
                        success: false, 
                        message: `Insufficient stock for ${product ? product.productName : 'product'}` 
                    });
                }
                product.quantity -= item.quantity;
                await product.save();
            }

            order.paymentStatus = 'Paid';
            order.status = 'Pending';
            order.razorpayPaymentId = razorpay_payment_id;
            order.razorpayOrderId = razorpay_order_id;
            await order.save();

            return res.json({
                success: true,
                message: 'Payment successful',
                orderId: order._id
            });
        }

        // Handle new order payment
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const userAddress = await Address.findOne({ userId });
        if (!userAddress || !userAddress.address[addressIndex]) {
            return res.status(400).json({ success: false, message: 'Invalid address' });
        }

        const selectedAddress = userAddress.address[addressIndex];
        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product || product.quantity < item.quantity) {
                return res.status(400).json({ success: false, message: `Insufficient stock for ${item.productId.productName}` });
            }
            product.quantity -= item.quantity;
            await product.save();
        }

        const orderData = {
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity
            })),
            userId: userId,
            totalPrice: cart.items.reduce((sum, item) => sum + item.totalPrice, 0),
            discount: discount || 0,
            finalAmount: finalAmount,
            address: [selectedAddress], 
            paymentMethod: 'Razorpay', 
            paymentStatus: 'Paid',
            status: 'Pending',
            createdOn: new Date(),
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id
        };

        const order = new Order(orderData);
        await order.save();

        // Clear cart
        cart.items = [];
        await cart.save();

        return res.json({ 
            success: true, 
            message: 'Payment successful', 
            orderId: order._id 
        });

    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, message: "Payment verification failed" });
    }
};

const handlePaymentFailure = async (req, res) => {
    try {
        const { orderId , addressIndex } = req.body;
        const userId = req.session.user._id;

        // Get cart details
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // Calculate totals
        const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const userAddress = await Address.findOne({ userId });
        if (!userAddress || !userAddress.address[addressIndex]) {
            return res.status(400).json({ success: false, message: 'Invalid address' });
        }
        const selectedAddress = userAddress.address[addressIndex];
        // Create order with failed status
        const orderData = {
            orderItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.totalPrice / item.quantity
            })),
            userId: userId,
            totalPrice,
            finalAmount: totalPrice, // No discount for failed orders
            address:selectedAddress, 
            paymentMethod: 'Razorpay',
            paymentStatus: 'Failed',
            status: 'Pending', // Set order status as cancelled
            createdOn: new Date(),
            razorpayOrderId: orderId
        };

        const order = new Order(orderData);
        await order.save();

        // Clear cart
        cart.items = [];
        await cart.save();

        res.json({
            success: true,
            message: 'Payment failure recorded',
            orderId: order._id
        });

    } catch (error) {
        console.error('Payment failure handling error:', error);
        res.status(500).json({ success: false, message: 'Failed to handle payment failure' });
    }
};

const getUserOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const orders = await Order.find({ userId: userId })
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
        const userId = req.session.user._id;  

        const order = await Order.findOne({ _id: orderId, userId: userId });
        
        if (!order) {
            req.session.orderMessage = {
                type: 'error',
                message: 'Order not found'
            };
            return res.redirect('/userProfile');
        }

        if (order.status !== 'Pending' && order.status !== 'Processing' && order.status !== 'Shipped') {
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

        if (order.paymentMethod === 'Razorpay' || order.paymentMethod === 'WALLET') {
            await User.findByIdAndUpdate(userId, {
                $inc: { wallet: order.finalAmount }
            });
            const walletTransaction = new Wallet({
                userId,
                type: 'refunded',
                amount: order.finalAmount,
                description: `Refund for cancelled order`,
                orderId: order._id
            });
            await walletTransaction.save();
        }

        order.status = 'Cancelled';
        if (order.paymentStatus === 'Paid') {
            order.paymentStatus = 'Refunded';
        }
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

const returnOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;  

        const order = await Order.findOne({ _id: orderId, userId: userId });
        if (!order) {
            req.session.orderMessage = {
                type: 'error',
                message: 'Order not found'
            };
            return res.redirect('/userProfile');
        }

        if (order.status !== 'Delivered') {
            req.session.orderMessage = {
                type: 'error',
                message: 'Order must be delivered before it can be returned'
            };
            return res.redirect('/userProfile');
        }

        order.status = 'Return Requested';
        await order.save();

        req.session.orderMessage = {
            type: 'success',
            message: 'Return request submitted successfully'
        };
        res.redirect('/userProfile');

    } catch (error) {
        console.error('Return order error:', error);
        req.session.orderMessage = {
            type: 'error',
            message: 'Failed to submit return request'
        };
        res.redirect('/userProfile');
    }
};

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
            userId: userId  
        }).populate({
            path: 'orderItems.product',
            select: 'productName productImage salePrice'
        });

        if (!orderData) {
            return res.redirect('/pageNotFound');
        }

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
            formatDate: formatDate,
            getStatusBadgeClass: getStatusBadgeClass
        });

    } catch (error) {
        console.error('Order details error:', error);
        res.redirect("/pageNotFound");
    }
}

const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId)
            .populate('orderItems.product')
            .populate('userId');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Company Details
        doc.fontSize(24).fillColor('#0073e6').text('EUPHORIA', { align: 'center', bold: true });
        doc.fontSize(12).fillColor('black').text('Tax Invoice / Bill of Supply / Cash Memo', { align: 'center' });
        doc.fontSize(10).text('(Original for Recipient)', { align: 'center' });
        doc.moveDown();

        // Invoice Details
        doc.fontSize(10)
           .text(`Invoice Date: ${new Date().toLocaleDateString()}`)
           .text(`Order ID: ${order.orderId}`)
           .text(`Order Date: ${order.createdOn.toLocaleDateString()}`);
        doc.moveDown();

        // Shipping Address
        const shippingAddress = order.address[0];
        doc.fontSize(12).fillColor('#0073e6').text('Shipping Address:', { bold: true });
        doc.fontSize(10).fillColor('black')
           .text(shippingAddress.name, { bold: true })
           .text(shippingAddress.place)
           .text(`${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.pincode}`)
           .text(`Phone: ${shippingAddress.phone}`);
        doc.moveDown();

        // Items Table
        const tableTop = doc.y + 10;
        doc.fontSize(10).fillColor('black');

        // Table Headers
        doc.text('Item', 50, tableTop, { bold: true })
           .text('Price (Rs.)', 250, tableTop, { bold: true })
           .text('Qty', 350, tableTop, { bold: true })
           .text('Total (Rs.)', 450, tableTop, { bold: true });

        // Draw header line
        doc.moveTo(50, tableTop + 15)
           .lineTo(550, tableTop + 15)
           .stroke();

        let itemY = tableTop + 30;

        // Add items dynamically
        order.orderItems.forEach(item => {
            doc.text(item.product.productName, 50, itemY)
               .text(`Rs. ${item.price.toLocaleString('en-IN')}`, 250, itemY)
               .text(item.quantity.toString(), 350, itemY)
               .text(`Rs. ${(item.price * item.quantity).toLocaleString('en-IN')}`, 450, itemY);

            itemY += 20;
        });

        // Draw bottom line
        doc.moveTo(50, itemY)
           .lineTo(550, itemY)
           .stroke();

        itemY += 20;

        // Add Totals
        doc.fontSize(10).fillColor('#0073e6').text('Subtotal:', 350, itemY, { bold: true })
                        .fillColor('black').text(`Rs. ${order.totalPrice.toLocaleString('en-IN')}`, 450, itemY);
        
        if (order.discount > 0) {
            itemY += 20;
            doc.fillColor('#0073e6').text('Discount:', 350, itemY, { bold: true })
                                   .fillColor('black').text(`- Rs. ${order.discount.toLocaleString('en-IN')}`, 450, itemY);
        }

        itemY += 20;
        doc.fontSize(12).fillColor('#0073e6').text('Final Amount:', 350, itemY, { bold: true })
                        .fillColor('black').text(`Rs. ${order.finalAmount.toLocaleString('en-IN')}`, 450, itemY);

        // Footer
        doc.moveDown(3);
        doc.fontSize(10).fillColor('black').text('Thank you for shopping with EUPHORIA!', { align: 'center', bold: true });
        

        // Finalize the PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ message: 'Error generating invoice' });
    }
}

const createRazorpayOrder = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        const userId = req.session.user._id;

        // Find the order and verify it belongs to the user
        const order = await Order.findOne({ _id: orderId, userId });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.paymentStatus !== 'Failed') {
            return res.status(400).json({ success: false, message: 'Payment retry is only available for failed orders' });
        }

        // Create Razorpay order
        const razorpayOrder = await razorpayInstance.orders.create({
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            receipt: orderId,
            notes: {
                orderId: orderId,
                userId: userId.toString()
            }
        });

        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            orderId: razorpayOrder.id
        });

    } catch (error) {
        console.error('Create Razorpay order error:', error);
        res.status(500).json({ success: false, message: 'Failed to create payment order' });
    }
};

module.exports = {
    placeOrder,
    verifyPayment,
    handlePaymentFailure,
    getUserOrders,
    cancelOrder,
    returnOrder,
    orderDetails,
    generateInvoice,
    createRazorpayOrder
};