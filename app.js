const express = require("express")
const app = express();
const path = require("path")
const bodyParser = require('body-parser');
const nocache = require('nocache');
const session = require("express-session")
const passport = require("./config/passport")
const env = require("dotenv").config()
const db = require("./config/db")
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")
const User = require('./models/userSchema');

db()

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(passport.initialize())
app.use(passport.session())

app.use(nocache())

app.set("view engine","ejs")
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")])

app.use(express.static(path.join(__dirname,"public")))

app.use(async (req, res, next) => {
    // Skip this middleware for admin routes
    if (req.path.startsWith('/admin')) {
        return next();
    }

    if (req.session.user) {
        try {
            const user = await User.findById(req.session.user);
            if (user && user.isBlocked) {
                req.session.destroy();
                return res.redirect('/login');
            }
            res.locals.user = user;
        } catch (error) {
            console.error('Error checking user blocked status:', error);
        }
    }
    next();
});

app.use("/",userRouter)
app.use("/admin",adminRouter)
app.get("*",(req,res)=>{
    res.redirect("/pageNotFound")
})

const PORT = 3000 || process.env.PORT
app.listen(PORT,()=>{
    console.log(`Server running on ${process.env.PORT}`)
})

module.exports = app