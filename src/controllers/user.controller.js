import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();


        //refresh token save into database
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "something went wrong while creating access token and refresh token")
    }
}


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
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "user with email or username already exists!!!")
    }

    //4. check for images

    const avatarLocalPath = req.files?.avatar[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImg) && req.files.coverImg.length > 0) {
        coverImageLocalPath = req.files.coverImg[0].path
    }
    //5. check for avatar - required fiels 
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required!!!")
    }

    //6. upload them to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    //7. cloudinary check for avatar - required fields
    if (!avatar) {
        throw new ApiError(400, "Avatar is required!!!");
    }

    //8. create user
    const user = await User.create({
        fullName,
        username: username.toLowerCase(),
        email,
        password,
        avatar: avatar.url,
        coverImg: coverImage?.url || ""
    })

    //9. remove password and refreshToken from the response
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    //10. user not created
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registerd SuccessFully")
    )
})

//login user
const loginUser = asyncHandler(async (req, res) => {
    //req.body = data
    //username or email
    //find the user
    //password check 
    //access token and refresh token
    //cookies
    //response

    //req.body = data
    const { username, email, password } = req.body;

    //username or email
    if (!(username || email)) {
        throw new ApiError(400, "username and email is required")
    }

    //find the user
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "user does not exist");
    }

    //password match
    const isPassword = await user.isPasswordCorrect(password);

    if (!isPassword) {
        throw new ApiError(401, "Password is incorrect");
    }

    //access token and refresh token
    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id)

    //cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //secure cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    //return response

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: accessToken, refreshToken, loggedInUser
                },
                "user loggedIn successfully"
            )
        )

})

//logout user
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "Logout SuccessFully"))
})

export { registerUser, loginUser, logoutUser }