
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).
        catch((err) => next(err))
    }
}


export { asyncHandler }



// const asyncHandler = (fn) => async (req, res, next) => {
//     try {
//         await fn(req, res, next)
        
//     } catch (error) {
//         res.status(error.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }




//NOTE:
// ✅ Promises handle their own internal “try” automatically —
// so whenever something inside a promise (or an async function) throws an error or rejects,
// you don’t need to write try { ... } manually.

// You just attach a .catch() to handle that error