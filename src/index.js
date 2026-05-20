import dotenv from 'dotenv';

import mongoose from "mongoose";
import express from "express";
import { DB_NAME } from "./constants.js";
import connectDB from "./db/index.js";

dotenv.config({ path: './env' });

const app = express();


connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Running on port: ${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log("MONGODB CONNECTION FAILED!!",error)
    throw error
})



/*
; (async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error) => {
            console.log("ERRR!!", error);
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is running on port: ${process.env.PORT}`)
        })

    } catch (error) {
        console.error("ERROR", error);
        throw error;
    }
})()
*/