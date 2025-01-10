const User = require("../../models/userSchema")
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")
const env = require("dotenv").config()
const session = require("express-session")

function generateOtp(){
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    return otp;
}

async function sendVerificationEmail(email, otp) {
    try {
        
        
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        });

        // Log OTP right before sending email
        console.log('OTP being inserted into email template:', otp);

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "Email verification",
            text: `Use this code to reset your password ${otp}`,
            html: `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
        }
        .header {
            text-align: center;
            padding: 20px 0;
            background-color: #f8f9fa;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
        }
        .content {
            padding: 30px 20px;
        }
        .otp-container {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 5px;
        }
        .otp-code {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #2c3e50;
        }
        .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #666666;
            border-top: 1px solid #eeeeee;
        }
        .warning {
            color: #dc3545;
            font-size: 12px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">Euphoria</div>
        </div>
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset your password. Use the verification code below to proceed with your password reset:</p>
            
            <div class="otp-container">
                <div class="otp-code">${otp}</div>
            </div>

            <p>This code will expire in 10 minutes for security reasons. If you didn't request this password reset, please ignore this email or contact our support team if you have concerns.</p>

            <p>For your security:</p>
            <ul>
                <li>Never share this code with anyone</li>
                <li>Our team will never ask you for this code</li>
                <li>Only enter this code on our official website</li>
            </ul>

            <div class="warning">
                If you didn't request this password reset, please secure your account immediately.
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
            <p>&copy; 2024 Euphoria. All rights reserved.</p>
            <p>Euphoria</p>
        </div>
    </div>
</body>
</html>`
        });

        
        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email", error);
        return false;
    }
}

const securePassword = async(password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
}

const getForgotpage = async(req,res)=>{
    try {
        res.render("forgot-password")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const userProfile = async(req,res)=>{
    try {
        const user = req.session.user || null
        res.render("userProfile",{
            user:user
        })
    } catch (error) {
        res.redirect("/page-404")
    }
}

const forgotEmailValid = async(req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });
        
        if (!findUser) {
            return res.json({
                success: false,
                message: "Invalid email"
            });
        }
        
        // Generate and immediately store OTP
        const otp = generateOtp();
        req.session.userOtp = otp;  // Store OTP in session immediately
        console.log('OTP stored in session:', req.session.userOtp);
        
        const emailSent = await sendVerificationEmail(email, otp);
        
        if (emailSent) {
            req.session.email = email;
            
            return res.json({
                success: true,
                message: "OTP sent successfully",
                redirectUrl: '/forgot-password-otp'
            });
        }
        
        return res.json({
            success: false,
            message: "Failed to send OTP. Please try again."
        });
        
    } catch (error) {
        console.error("Forgot page error", error);
        return res.json({
            success: false,
            message: "Something went wrong. Please try again."
        });
    }
}


const verifyForgotPasswordOTP = (req, res) => {
    try {
        if (!req.session.userOtp) {
            return res.redirect('/forgot-password');
        }
        res.render("forgotPassword-otp");
    } catch (error) {
        console.log("verifyForgotPasswordOTP error",error)
        return res.redirect('/forgot-password');
    }
    
}

const verifyForgotPassOTP = async(req, res) => {
    try {
        const enteredOtp = req.body.otp;
        console.log('Entered OTP by user:', enteredOtp);
        console.log('OTP stored in session:', req.session.userOtp);
        
        if(enteredOtp === req.session.userOtp) { // Use strict equality
            res.json({
                success: true,
                redirectUrl: "/reset-password"
            });
        } else {
            res.json({
                success: false,
                message: "Invalid OTP"
            });
        }
    } catch (error) {
        console.log("Error in verifying otp", error);
        res.status(500).json({
            success: false,
            message: "An error occurred please try again"
        }); 
    }
}

const getResetPasswordPage = async(req,res)=>{
    try {
        if(req.session.userOtp){
            res.render("reset-password")
        }else{
            res.redirect("/forgot-password")
        }
        
    } catch (error) {
        console.log("Reset page error",error)
        res.redirect("/pageNotFound")
    }
}

const resendOtp = async(req,res)=>{
    try {
        const otp = generateOtp()
        req.session.userOtp = otp
        const email = req.session.email
        const emailSent = await sendVerificationEmail(email,otp)
        if(emailSent){
            console.log("Resend OTP",otp)
            res.status(200).json({success:true,message:"Resend OTP succesfull"})
        }
    } catch (error) {
        console.error("Resend OTP",error)
        res.status(500).json({success:false,message:"Internal server error"})
    }
}

const postNewPassword = async(req,res)=>{
    try {
        const {newPassword, confirmPassword} = req.body  // Match the form field names
        const email = req.session.email 
        
        if(!email) {
            return res.redirect("/login")  // Handle case where session expired
        }

        if(newPassword === confirmPassword){
            const passwordHash = await securePassword(newPassword)
            const updatedUser = await User.findOneAndUpdate(
                {email: email},
                {$set: {password: passwordHash}},
                {new: true}  // Return updated document
            )

            if(!updatedUser) {
                return res.render("reset-password", {message: "User not found"})
            }

            console.log("Password updated successfully")
            return res.redirect("/login")
        } else {
            return res.render("reset-password", {message: "Passwords do not match"})
        }
    } catch (error) {
        console.log("New password error:", error)  // Log the actual error
        return res.redirect("/pageNotFound")
    }
}

module.exports = {
    getForgotpage,
    userProfile,
    forgotEmailValid,
    verifyForgotPasswordOTP,
    verifyForgotPassOTP,
    getResetPasswordPage,
    resendOtp,
    postNewPassword
}