const User = require("../../models/userSchema")
const Category = require("../../models/categorySchema")
const Product = require("../../models/productSchema")
const Brand = require("../../models/brandSchema")
const env = require("dotenv").config()

const loadCart = async(req,res)=>{
    try {
        res.render("cart")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

module.exports = {
    loadCart
}