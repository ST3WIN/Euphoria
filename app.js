const express = require("express")
const app = express();
const path = require("path")
const nocache = require('nocache');
const session = require("express-session")
const passport = require("./config/passport")
const env = require("dotenv").config()
const db = require("./config/db")
const userRouter = require("./routes/userRouter")
const adminRouter = require("./routes/adminRouter")

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

app.use("/",userRouter)
app.use("/admin",adminRouter)

const PORT = 3000 || process.env.PORT
app.listen(PORT,()=>{
    console.log(`Server running on ${process.env.PORT}`)
})

module.exports = app