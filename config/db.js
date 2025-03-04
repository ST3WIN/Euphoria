const mongoose = require("mongoose")
const env = require("dotenv").config()

const connectDb = async ()=>{
    try {
      await mongoose.connect((process.env.MONGO_CONNECTION_STRING))
      console.log("Database has been connected")
    } catch (error) {
     console.log("Database connection error",error.message)
     process.exit(1)   
    }
}

module.exports = connectDb