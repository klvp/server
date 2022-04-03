/** @format */

import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema({
  userId: String,
  resetString: String,
  createdAt: Date,
  expiresAt: Date,
});

export const passwordReset = mongoose.model(
  "passwordReset",
  passwordResetSchema
);
