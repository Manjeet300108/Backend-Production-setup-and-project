import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"
import { subscribe } from "diagnostics_channel";

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
});

//refreshAccessToken
const refreshAccessToken = asyncHandler(async (req, res) => {
    //incoming token
    const incomingToken = req.cookies.refreshToken || req.body.refreshToken

    //check
    if (!incomingToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        //decode the token
        const decodedToken = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET)

        //find the user
        const user = await User.findById(decodedToken?._id)

        //check
        if (!user) {
            throw new ApiError(401, "invalid refresh token")
        }

        //check incoming token and refresh token
        if (incomingToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired")
        }
        //generate access token and refresh token
        const { accessToken, newRefreshToken } = await generateAccessTokenAndRefreshToken(user._id)

        //secure token
        const options = {
            httpOnly: true,
            secure: true
        }

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("accessToken", newRefreshToken, options)




    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh Token")
    }
});

//?update controllers

//change current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    //incoming data
    const { oldpassword, newPassword } = req.body
    //find the user
    const user = await User.findById(req.user?._id)
    //check password correct
    const isPasswordCorrect = await user.isPasswordCorrect(oldpassword)
    //password incorrect
    if (!isPasswordCorrect) {
        throw new ApiError(401, "invalid old password")
    }
    //new password save to the schema
    user.password = newPassword
    await user.save({ validateBeforeSave: false })

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "password updated successfully"))
});

//get/fetch user
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            req.user,
            "user fetched Successfully"
        ))
});

//update account deatils
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body
    //check 
    if (!fullName || !email) {
        throw new ApiError(400, "all field required")
    }
    //find the user and update user
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName, email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "Account Details Updated successfully"
        ))
});

//updateAvatar
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "Avatar image updated successfully"
        ))
})

//coverImage
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImg: coverImage.url
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            user,
            "cover image updated successfully"
        ))
})

//aggregation pipeline
const getUserChannelProfile = asyncHandler(async (req, res) => {
    //get user from url
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }
    //here we find user with the help of username and find but we use pipeline so we use $match and find the user  

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        //subscribers
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        //to whom you subscribe
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        //add fields
        {
            $addFields: {
                subscribersCount: {
                    //calculate
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        //$project hota h ki selected cheeje deta h
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    //check console

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exist")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "user channel fetch successfully "
            )
        )

})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile }