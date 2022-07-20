/** @format */

import express from "express";
const router = express.Router();
import { check } from "express-validator";
import {
  signup,
  login,
  logout,
  verify,
  requestReset,
  reset,
  getUserData,
} from "../controllers/user.js";

import auth from "../middleware/auth.js";

router.post(
  "/signup",
  [
    check("username", "Username should be minimum 4 characters").isLength({
      min: 4,
    }),
    check("email", "Email should be valid").isEmail(),
    check("password", "password should be minimum 8 characters").isLength({
      min: 8,
    }),
  ],
  signup
);

router.post("/login", login);

router.get("/verify/:userId/:uniqueString", verify);

router.post("/requestPasswordReset", requestReset);

// router.post("/resetPassword", reset);
router.post("/resetPassword/:userId/:resetString", reset);

router.get("/logout", logout);

router.get("/data", auth, getUserData);

export const usersRouter = router;
