/** @format */

import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import { usersRouter } from "./routes/user.js";
import mongoose from "mongoose";

const app = express();
const PORT = process.env.PORT || 5000;
app.use(express.json());
app.use(cors({ origin: "*" }));

// DB connection
const MONGO_URL =
  process.env.DB_URL || "mongodb://localhost:27017/authentication";

mongoose
  .connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB Connected"))
  .catch((err) => console.log(err));

app.use("/users", usersRouter);

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
