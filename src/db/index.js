import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect
            (`${process.env.MONGODB_URI}/${DB_NAME}`)

        mongoose.connection.on("disconnected", () => {
            console.warn("⚠️ MongoDB disconnected!");
        });

        mongoose.connection.on("error", (err) => {
            console.error("❌ MongoDB connection error:", err.message);
        });

        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection FAILED: ", error);
        process.exit(1)
    }
}


export default connectDB;