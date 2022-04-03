/** @format */

import mongoose from "mongoose";

const userVerificationSchema = new mongoose.Schema({
  userId: String,
  uniqueString: String,
  createdAt: Date,
  expiresAt: Date,
});

export const userVerification = mongoose.model(
  "userVerification",
  userVerificationSchema
);
