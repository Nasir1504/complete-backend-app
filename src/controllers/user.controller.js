import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

//---------------------REGISTER USER---------------------
const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloundinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check fro user creation
    // return res

    const {
        username,
        email,
        fullName,
        password,
        // watchHistory,
        // refreshToken

    } = req.body;

    console.log(username, email)

    if (
        [fullName, email, username, password].some((field) => {
            return field?.trim() === ""
        })
    ) {
        throw new ApiError(400, "All fields are required")
    }


    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists.")
    }

    console.log(req.files)
    // multer gives us'req.files' excess and express give us 'req.body' and other properties excess.
    // javaScript doesn't give use excess to 'files' we have to handle it externally.

    const avatarLocalPath = await req.files?.avatar[0]?.path;
    console.log(avatarLocalPath)
    // const coverImageLocalPath = await req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path
    }


    if (!avatarLocalPath) throw new ApiError(400, "Avatar file is required")

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) throw new ApiError(400, "Avatar file is required")


    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) throw new ApiError(500, "Something went wrong while registering the user")


    return res.status(201).json(
        new ApiResponse(200, createdUser, "User register successfully.")
    )

})

//---------------------LOGIN USER------------------------
const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // check username or email
    // find the user
    // password check
    // access and refresh token
    // send cookie

    const { email, username, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")

    }

    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")

    // }

    //here user does not have refresh token it is empty here.
    const user = await User.findOne({
        $or: [
            { username },
            { email }
        ]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }

    // here now user have a refresh token
    const { accessToken, refreshToken } = await
        generateAccessAndRefreshTokens(user._id);

    // again doing database query
    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken");


    const options = {
        httpOnly: true,
        secure: true
    }

    // cookie is access from "app.use(cookieParser())"" in app.js and 
    // can be set as mush as you can just by writing .cookie()
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged in Successfully"
            )
        )

})

//---------------------LOGOUT USER-----------------------
const logoutUser = asyncHandler(async (req, res) => {

    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            },
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
        .json(new ApiResponse(200, {}, "User logged out"))

})

//---------------------REFRESH ACCESS TOKEN--------------

const refreshAccessToken = asyncHandler(async (req, res) => {

    try {
        const incomingRefreshToken =
            req.cookies.refreshToken || req.body.refreshToken

        if (!incomingRefreshToken) {
            throw new ApiError(401, "unauthorized request")
        }

        const decordedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await User.findById(decordedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired")
        }

        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, refreshToken } =
            await generateAccessAndRefreshTokens(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken },
                    "Access token refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})


//---------------------CHANGE CURRENT PASSWORD-----------
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
})


//---------------------GET CURRENT USER------------------
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(
            200,
            req.user,
            "Current user fetched successfully"
        ))
})

//---------------------UPDATE ACCOUNT DETAILS------------
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        { new: true }
    ).select("-password")

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Account details updated successfully"))
});

//---------------------UPDATE USER AVATAR----------------
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary
        (avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading avatar image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password")

    fs.unlinkSync(avatarLocalPath)

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Avatar image updated successfully")
        )
})

//---------------------UPDATE COVER IMAGE----------------
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const coverImage = await uploadOnCloudinary
        (coverImageLocalPath)

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password")

    fs.unlinkSync(coverImageLocalPath)

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Cover image updated successfully")
        )
})


// ----------------------AGGREGATION PIPELINE------------

//---------------------GET USER CHANNEL PROFILE----------
const getUserChannelProfile = asyncHandler(async (req, res) => {
    // username from url i.e. req.params 
    const { username } = req.params;

    if (!username?.trim()) throw new ApiError(400, "username is missing")

    const channel = await User.aggregate([
        // ------------- Pipeline-1 -------------
        {
            $match: {
                username: username?.toLowerCase()
            },
        },

        // ------------- Pipeline-2 -------------
        // Collect all documents where the field channel equals User’s _id.
        // shows users who subscribed to this user.
        {
            //  model "Subscription" in database saved as "subscriptions"

            $lookup: {
                from: "subscriptions",      //→ look into the subscriptions collection.
                localField: "_id",          // → take the user’s _id.  
                foreignField: "channel",    // → compare it with the channel field in subscriptions. 
                as: "subscribers"           // → create a new field named subscribers in the result, 
                //   containing all matching documents (i.e., users who subscribed to this channel).
            }
        },

        // ------------- Pipeline-3 -------------
        // Collect all documents where the field subscriber equals Nasir’s _id.
        // Then put all those documents inside a new array field called subscribedTo.”
        // shows channels/users this user follows.
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",    // ( match with who he follows )
                as: "subscribedTo"             // ← new field added
            }

        },

        // ------------- Pipeline-4 -------------
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        // subscriber is from model subscribers
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },

        // ------------- Pipeline-5 -------------
        {
            // fields to be projection
            $project: {
                fullName: 1, // 1 is a flag
                username: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }

        // --------------------------------------

    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, channel[0],
                "User channel fetched successfully")
        )
})


//---------------------Get Watch History ----------------
const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                // ObjectId('213kla9873hhh987322')
                // req.user._id is likely a string.
                // Aggregation pipelines run directly on MongoDB, not through Mongoose’s type casting,
                // so we must manually convert it to ObjectId for an exact match.

                _id: new mongoose.Types.ObjectId(String(req.user._id)) // ✅ correct  ObjectId type
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $firsrt: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch history fetched successfully"
            )
        )
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}



// 1)
// if(!username || !email){
//      throw new ApiError(400, "username or email is required")
// }
//
// it only stops execution and sends the error up the chain
// (to your middleware or a catch block).
// by default, nothing shows in the console — unless you catch it somewhere and log it.

//-----------------------------------------------------------------------


// 2)
// const options = {
//     httpOnly: true,
//     secure: true
// }

// httpOnly: true
// Makes the cookie inaccessible to JavaScript (document.cookie can’t read it).
// This protects it from XSS (Cross-Site Scripting) attacks.

// secure: true
// Means the cookie will only be sent over HTTPS connections.
// It will not be sent over plain HTTP (insecure) connections.

//-----------------------------------------------------------------------



// {
//   from: "subscriptions",
//   localField: "_id",        // Nasir’s _id = 1
//   foreignField: "channel",  // match with "channel" field in subscriptions
//   as: "subscribers"
// }
// ➡ MongoDB looks for all subscriptions where
// channel === 1 (Nasir’s ID).

// Matches:

// { subscriber: 2, channel: 1 }
// { subscriber: 3, channel: 1 }

//-----------------------------------------------------------------------
