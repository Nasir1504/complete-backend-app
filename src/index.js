// require('dotenv').config({path: './env'})
import { configDotenv } from "dotenv";
import connectDB from "./db/index.js";

configDotenv({ path: "./env" });


connectDB()
    .then(() => {
        app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running at port: ${process.env.PORT})`
        )
    })
    .catch((e) => {
        console.log("MongoDB connection failed !!! ".e)
    })






/*-------------------------------------------
//this can be an approach

const app = express();

(async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

        app.on("error", (error) => {
            console.log("Err: ", error);
            throw error
        });

        app.listen(process.env.PORT, () => {
            console.log(`App is runnig on port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("Error: ", error)
        throw err
    }
})();

---------------------------------------------*/