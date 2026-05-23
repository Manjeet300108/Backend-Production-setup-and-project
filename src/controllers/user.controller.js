import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js"


//register user
const registerUser = asyncHandler(async (req, res) => {
    //1. get user details from frontend

    const { fullName, username, email, password } = req.body;
    // console.log("email:",email)

    // 2. Validation - isEmpty or not

    // if(fullName === ""){
    //     throw new ApiError(400,"fullName Required")
    // }

    if ([fullName, username, email, password].some((field) => {
        field?.trim() === ""
    })) {
        throw new ApiError(400, "All Fields Are Required!!!")
    }

    //3. check User already exist 
    const existedUser = User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409,"user with email or username already exists!!!")
    }

    //4. check for images

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    //5. check for avatar - required fiels 
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required!!!")
    }

    //6. upload them to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    //7. cloudinary check for avatar - required fields
    if(!avatar){
        throw new ApiError(400,"Avatar is required!!!");
    }

    //8. create user
    const user = await User.create({
        fullName,
        username : username.toLowerCase(),
        email,
        password,
        avatar : avatar.url,
        coverImg : coverImage?.url || ""
    })

    //9. remove password and refreshToken from the response
    const createdUser = await User.findById(user._id).select("-password","-refreshToken")

    //10. user not created
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User Registerd SuccessFully")
    )
})

export { registerUser }