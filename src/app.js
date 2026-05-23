import cookieParser from 'cookie-parser';
import express from 'express';
import cors from "cors"
const app = express();

//cors configure
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    Credential: true
}));

//json data handle
app.use(express.json({ limit: "16kb" }));
//url data handle
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
//static files handle
app.use(express.static("public"));
//cookie setup
app.use(cookieParser());

//routes import
import userRouter from "./routes/user.routes.js"

//routes declare
app.use("/api/v1/users",userRouter);


export { app };