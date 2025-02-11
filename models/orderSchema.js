const mongoose = require("mongoose")
const {Schema} = mongoose
const {v4:uuidv4} = require("uuid")

const orderSchema = new Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
        unique:true
    },
    orderItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            required:true
        },
        quantity:{
            type:Number,
            required:true
        },
        price:{
            type:Number,
            default:0
        }
    }],
    totalPrice:{
        type:Number,
        required:true
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
        required:true
    },
    paymentMethod: { 
        type: String, 
        enum: ['COD', 'Razorpay', 'WALLET'], 
        required: true 
    },
    paymentStatus: { 
        type: String, 
        enum: ['Pending', 'Paid', 'Failed','Refunded'], 
        default: 'Pending' 
    },
    razorpayPaymentId: { 
        type: String 
    }, 
    address:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    invoiceDate:{
        type:Date
    },
    status:{
        type:String,
        enum:["Pending","Processing","Shipped","Delivered","Cancelled","Return Requested","Returned"],
        default: 'Pending',
        required:true
    },
    createdOn:{
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied:{
        type:Boolean,
        default:false
    }
})

const Order = mongoose.model("Order",orderSchema)
module.exports = Order 