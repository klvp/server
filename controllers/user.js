/** @format */
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { User } from "../models/userModel.js";
import { userVerification } from "../models/userVerification.js";
import dotenv from "dotenv";
dotenv.config();
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import { ObjectId } from "mongodb";

async function genPassword(password) {
  const salt = await bcrypt.genSalt(10); //bcrypt.genSalt(no of salts)
  const hashedPassword = await bcrypt.hash(password, salt);
  console.log(salt, hashedPassword);
  return hashedPassword;
}

let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log(error);
  } else {
    console.log("Ready for message");
    console.log(success);
  }
});

//send verification email
const sendVerificationEmail = async ({ _id, email }, response) => {
  //URL to be used in Email
  console.log(_id, email);
  const currentURL = "http://localhost:4000/";

  const uniqueString = uuidv4() + _id;

  //mail options
  const mailOption = {
    from: process.env.AUTH_EMAIL,
    to: email,
    subject: "Verify Your Email",
    html: `<p>Verify your Email to loginto the account</p>
            <p>Link <b>expires in 6 hours</b></p>
            <p>Press <a href=${
              currentURL + "users/verify/" + _id + "/" + uniqueString
            }>here</a> to proceed</p>`,
  };
  const hashedUniqueString = await genPassword(uniqueString);
  // console.log(salt, hashedPassword);
  const newVerification = new userVerification({
    userId: _id,
    uniqueString: hashedUniqueString,
    createdAt: Date.now(),
    expiresAt: Date.now() + 21600000,
  });
  await newVerification
    .save()
    .then(() => {
      transporter
        .sendMail(mailOption)
        .then(() => {
          response.send({
            status: "PENDING",
            message: "Verification mail sent",
          });
        })
        .catch((error) => {
          console.log(error);
          response.send({ message: "verification mail failed" });
        });
    })
    .catch((error) => {
      console.log(error);
      response.send({ message: "Could't save verification data" });
    });
};

async function signup(request, response) {
  const errors = validationResult(request);
  if (!errors.isEmpty()) {
    return response.status(404).send({ message: errors.array()[0].msg });
  }
  const { username, email, password } = request.body;
  const [userFromDB] = await User.find({ email });
  if (userFromDB) {
    console.log({ message: "User already exist" });
    return response.send({
      message: "User already exist / Verification mail sent",
    });
  } else {
    const hashedpassword = await genPassword(password);
    const newUser = new User({
      username: username,
      email: email,
      password: hashedpassword,
      verified: false,
    });
    await newUser
      .save()
      .then((result) => sendVerificationEmail(result, response));
  }
}

async function login(request, response) {
  const { username, email, password } = request.body;
  const [userFromDB] = await User.find({ username });
  console.log(userFromDB);
  if (userFromDB.verified) {
    const isPasswordMatch = await bcrypt.compare(password, userFromDB.password);
    if (isPasswordMatch) {
      const token = await jwt.sign(
        { id: userFromDB._id },
        process.env.SECRET_KEY
      );
      response.cookie("token", token, { expire: new Date() + 1 });
      return response.send({
        token,
        user: {
          _id: userFromDB._id,
          username: userFromDB.username,
          email: userFromDB.email,
        },
      });
    } else {
      response.status(401).send({ message: "Invalid credentials" });
    }
  } else {
    response.status(401).send({ message: "User not found" });
  }
}

async function verify(request, response) {
  let { userId, uniqueString } = request.params;
  console.log(userId, uniqueString);
  userVerification
    .find({ userId })
    .then((result) => {
      if (result.length > 0) {
        // user record exists or not
        const { expiresAt } = result[0];
        if (expiresAt < Date.now()) {
          // record has expired
          userVerification
            .deleteOne({ userID })
            .then((result) => {
              User.deleteOne({ _id: userId }).then(() => {
                response.send({
                  message:
                    "Deleting User record as verification link is expired",
                });
              });
            })
            .catch(() => {
              response.send({ message: "Verification Link expired" });
            });
        } else {
          // valid record exists and
          const isEmailVerified = bcrypt.compare(
            uniqueString,
            result[0].uniqueString
          );
          if (isEmailVerified) {
            User.updateOne({ _id: userId }, { verified: true }).then(() => {
              userVerification.deleteOne({ userId }).then(() => {
                response.send({ message: "Email Verified" });
              });
            });
          } else {
            return response.send({
              message: "Invalid Verification details",
            });
          }
        }
      } else {
        return response.send({
          message: "record not found or user already have an account",
        });
      }
    })
    .catch(() => {
      response.send({ message: "Verification of email failed" });
    });
}

const logout = async (request, response) => {
  response.clearCookie("token");
  return response.send({ message: "Logout Successful" });
};

export { signup, login, logout, verify };
