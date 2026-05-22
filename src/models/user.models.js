import mongoose,{Schema} from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new Schema(
    {
        username : {
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
            index : true
        },
        email : {
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
        },
        fullName : {
            type : String,
            required : true,
            lowercase : true,
            trim : true,
        },
        avatar : {
            type : String, //cloudinary url
            required : true
        },
        coverImg : {
            type : String, //cloudinary url
            required : true
        },
        watchHistory : [
            {
            type : Schema.Types.ObjectId,
            ref : "Video"
            }
        ],
        password : {
            type : String, //hash password
            required : [true,"Password is required"]
        },
        refreshToken : {
            type : String
        }
    },
    {
        timestamps : true
    }
)

//hash the password
userSchema.pre("save",async function(next) {
    if(!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password,10)
    next()
})

//check password 
userSchema.methods.isPasswordCorrect = async function (password){
    return await bcrypt.compare(password,this.password)
}

//access token

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id:this._id,
            username : this.username,
            email : this.email,
            fullName : this.fullName
        },
        process.env.ACCESS_TOKEN_SECERET,
        {
            expireIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

//refresh token

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id:this._id,
        },
        process.env.REFRESH_TOKEN_SECERET,
        {
            expireIn : process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User",userSchema)