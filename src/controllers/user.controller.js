import { asyncHandler } from "../utils/asyncHandler.js";


//register user
const registerUser = asyncHandler(async (req, res) => {
    res.status(200).json({
        message: "Manjeet singh"
    })
})

export { registerUser }