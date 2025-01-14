const User = require("../models/userSchema")

const userAuth = (req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.redirect("/login")
            }
        })
        .catch(error=>{
            console.log("User authenticaion error middleware",error)
            res.status(500).send("Internal server error")
        })
    }else{
        res.redirect("/login")
    }
}

const apiAuth = (req, res, next) => {
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.status(401).json({
                    success: false,
                    message: 'Please login to continue'
                })
            }
        })
        .catch(error=>{
            console.log("API auth error middleware", error)
            res.status(500).json({
                success: false,
                message: 'Internal server error'
            })
        })
    }else{
        res.status(401).json({
            success: false,
            message: 'Please login to continue'
        })
    }
}

const adminAuth = (req,res,next)=>{
    User.findOne({isAdmin:true})
    .then(data=>{
        if(data){
            next()
        }else{
            res.redirect("/admin/login")
        }
    })
    .catch(error=>{
        console.log("Admin authication error",error);
        res.status(500).send("Internal Server error")
    })
}

module.exports = {
    userAuth,
    adminAuth,
    apiAuth
}