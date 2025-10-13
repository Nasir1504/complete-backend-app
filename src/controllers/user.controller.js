import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


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

    } = await req.body;

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



const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // check username or email
    // find the user
    // password check
    // access and refresh token
    // send cookie

    const { email, username, password } = req.body;

    if (!username || !email) {
        throw new ApiError(400, "username or email is required")

    }

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
        .select("-password --refreshToken");


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


export {
    registerUser,
    loginUser,
    logoutUser
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
