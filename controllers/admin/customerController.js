const User = require("../../models/userSchema")

const customerInfo = async(req,res)=>{
    try {
        if(!req.session.admin){
            return res.redirect("/admin/login");
        }
        let search = ""
        if(req.query.search){
            search = req.query.search
        }
        let page = 1
        if(req.query.page){
            page = req.query.page
        }
        const limit = 2
        const userData = await User.find({
            isAdmin:false,
            $or:[
                {firstName:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec()
        const count = await User.countDocuments({
            isAdmin:false,
            $or:[
                {firstName:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        })
        const totalPage = Math.ceil(count / limit);
        res.render("customers",{ data: userData, totalPage: totalPage, currentPage: page })
    } catch (error) {
        console.log("Error fetching users:", error);
        return res.redirect("/pageError");
    }
}

const customerBlock = async(req,res)=>{
    try {
        let id = req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/pageError")
    }
}

const customerUnBlock = async(req,res)=>{
    try {
        let id = req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/users")
    } catch (error) {
        res.redirect("/pageError")        
    }
}

module.exports = {
    customerInfo,
    customerBlock,
    customerUnBlock
}