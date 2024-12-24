const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/userSchema");
const env = require("dotenv").config()

// passport.use(new GoogleStrategy({
//     clientID:process.env.GOOGLE_CLIENT_ID,
//     clientSecret:process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL:"/auth/google/callback"
// },
//     async(accessToken,refreshToken,profile,done)=>{
//         try {
//             let user = await User.findOne({googleId:profile.id})
//             if(user){
//             return done(null,user)
//             }else{
//                 user = new User({
//                     firstName:profile.displayName,
//                     email:profile.emails[0].value,
//                     googleId:profile.id
//                 })
//                 await user.save()
//                 return done(null,user)
//             }
//         } catch (error) {
//             return done(error,null)
//         }
//     }
// ))

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await User.findOne({ googleId: profile.id });
        if (user) {
          return done(null, user)
        }
        const existingUser = await User.findOne({ email: profile.emails[0].value });
        if (existingUser) {
          return done(null, false, { message: "User with this email already exists" });
        }
        const newUser = new User({
          firstName: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
        });

        await newUser.save();
        return done(null, newUser);
      } catch (error) {
        console.error("Error during Google OAuth:", error);
        return done(error, null);
      }
    }
  )
)

passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null)
    })
})

module.exports = passport