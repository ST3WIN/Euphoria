const mongoose = require("mongoose")
const {Schema} = mongoose

const productSchema = new Schema({
    productName:{
        type:String,
        required:true
    },
    productDescription:{
        type:String,
        required:true
    },
    brand:{
        type:String,
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    regularPrice:{
        type:Number,
        requred:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        default:true
    },
    productSize:{
        type:String,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isActive:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:["Avilable","Out of stock"],
        required:true,
        default:"Available"
    }
},{
    timestamps:true
})

const Product = mongoose.model("Product",productSchema)

module.exports = Product