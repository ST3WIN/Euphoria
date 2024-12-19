const User = require("../../models/userSchema")
const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const pageError = async(req,res)=>{
    res.render("pageError")
}

const loadLogin = (req,res)=>{
    try {
        if(req.session.admin){
            return res.redirect("/admin/dashboard")
        }
        res.render("admin-login",{message:null}) 
    } catch (error) {
        console.log("Error",error)
        
    }
    
}

const login = async(req,res)=>{
    try {
        const email = req.body.email
        const password = req.body.password
        const admin = await User.findOne({email,isAdmin:true})
        console.log(admin)
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password)
            console.log(passwordMatch);
            
            if(passwordMatch){
                req.session.admin = true
                return res.redirect("/admin")
            }else{
                return res.redirect("/admin/login")
            }
        }else{
            res.redirect("/admin/login")
        }
    } catch (error) {
        console.log("Login error",error);
        return res.redirect("/pageError")       
    }
}

const loadDashBoard = async(req,res)=>{
    if(req.session.admin){
        try {
            res.render("dashboard")
        } catch (error) {
            res.redirect("/pageError")
        }
    }else{
        res.redirect("/admin/login")
    }
}

const logout = async(req,res)=>{
    try {
        req.session.destroy(err =>{
            if(err){
                console.log("Error destroying session admin",err);
                return res.redirect("/pageError")
            }
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("admin logout error",error);
        res.redirect("/pageError")
    }
}

module.exports = {
    loadLogin,
    login,
    loadDashBoard,
    pageError,
    logout
}