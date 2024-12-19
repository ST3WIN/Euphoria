const mongoose = require("mongoose")
const {Schema} = mongoose

const brandSchema = new Schema({
    brandName:{
        type:String,
        required:true
    },
    brandImage:{
        tyep:[String],
        required:true
    },
    isActive:{
        type:Boolean,
        default:false
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

const Brand = mongoose.model("Brand",brandSchema)
module.export = Brand