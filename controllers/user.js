/** @format */
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { User } from "../models/userModel.js";
import { userVerification } from "../models/userVerification.js";
import { passwordReset } from "../models/passwordReset.js";
import dotenv from "dotenv";
dotenv.config();
// import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.MAIL_API_KEY);
import { v4 as uuidv4 } from "uuid";

// generate hash
async function genPassword(password) {
  const salt = await bcrypt.genSalt(10); //bcrypt.genSalt(no of salts)
  const hashedPassword = await bcrypt.hash(password, salt);
  console.log(salt, hashedPassword);
  return hashedPassword;
}

async function signup(request, response) {
  const errors = validationResult(request);
  if (!errors.isEmpty()) {
    return response.status(404).send({ message: errors.array()[0].msg });
  }
  const { username, email, password } = request.body;
  console.log(username, email, password);
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
      sgMail.send(mailOption, (error, info) => {
        if (error) {
          response.send({ message: "Unable to send mail error occured" });
        } else {
          response.send({ message: "Verification mail sent" });
        }
      });
    })
    .catch((error) => {
      console.log(error);
      response.send({ message: "Could't save verification data" });
    });
};

async function login(request, response) {
  const { email, password } = request.body;
  const [userFromDB] = await User.find({ email });
  console.log(userFromDB);
  if (userFromDB && userFromDB.verified) {
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

//send password reset email
const sendResetEmail = async ({ _id, email }, redirectUrl, response) => {
  const resetString = uuidv4() + _id;
  passwordReset.deleteMany({ userId: _id }).then(() => {
    const mailOption = {
      from: process.env.AUTH_EMAIL,
      to: email,
      subject: "Password Reset",
      html: `<p>We heard that you lost the password</p>
        <p>Dont worry use the link below to reset it</p>
            <p>Link <b>expires in 1 hours</b></p>
            <p>Press <a href=${
              redirectUrl + "/" + _id + "/" + resetString
            }>here</a> to proceed</p>`,
    };
    genPassword(resetString).then((hashedResetString) => {
      const newPasswordRecord = new passwordReset({
        userId: _id,
        resetString: hashedResetString,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      });
      console.log(newPasswordRecord);
      newPasswordRecord
        .save()
        .then(() => {
          sgMail.send(mailOption, (error, info) => {
            if (error) {
              response.send({ message: "Error occured while sending mail" });
            } else {
              response.send({
                message: "Reset mail sent",
                user: { id: _id, resetString: resetString },
              });
            }
          });
        })
        .catch(() => {
          console.log("resetPassword record does not saved");
          response.send({ message: "resetPassword record does not saved" });
        });
    });
  });
};

async function requestReset(request, response) {
  const { email, redirectUrl } = request.body;
  const [user] = await User.find({ email });
  console.log(email, redirectUrl, user);
  if (user && user.verified) {
    sendResetEmail(user, redirectUrl, response);
  } else {
    response.send({ message: "Account not found to reset password" });
  }
}

// async function reset(request, response) {
//   const { userId, resetString, newPassword } = request.body;

//   const [user] = await passwordReset.find({ userId });
//   try {
//     const { expiresAt } = user;
//     const isLinkValid = expiresAt > Date.now();
//     if (user) {
//       if (isLinkValid) {
//         const isStringValid = await bcrypt.compare(
//           resetString,
//           user.resetString
//         );
//         if (isStringValid) {
//           const hashedNewPassword = await genPassword(newPassword);
//           User.updateOne({ _id: userId }, { password: hashedNewPassword })
//             .then(() => {
//               passwordReset
//                 .deleteOne({ userId })
//                 .then(() => {
//                   response.send({
//                     message: "Password has been reset successfully",
//                   });
//                 })
//                 .catch(() => {
//                   console.log(
//                     "error occured while deleteing password reset request record"
//                   );
//                   response.send({
//                     message:
//                       "error occured while deleteing password reset request record",
//                   });
//                 });
//             })
//             .catch(() => {
//               console.log("error occured while updating password");
//               response.send({
//                 message: "error occured while updating password",
//               });
//             });
//         } else {
//           response.send({ message: "Reset String is not valid" });
//         }
//       } else {
//         passwordReset.deleteOne({ userId }).then(() => {
//           response.send({ message: "Password reset request expired" });
//         });
//       }
//     } else {
//       response.send({ message: "password reset request not found" });
//     }
//   } catch (error) {
//     response.send({
//       message: "Password reset request has expired",
//     });
//   }
// }
async function reset(request, response) {
  const { newPassword } = request.body;
  const { userId, resetString } = request.params;

  const [user] = await passwordReset.find({ userId });
  try {
    const { expiresAt } = user;
    const isLinkValid = expiresAt > Date.now();
    if (user) {
      if (isLinkValid) {
        const isStringValid = await bcrypt.compare(
          resetString,
          user.resetString
        );
        if (isStringValid) {
          const hashedNewPassword = await genPassword(newPassword);
          User.updateOne({ _id: userId }, { password: hashedNewPassword })
            .then(() => {
              passwordReset
                .deleteOne({ userId })
                .then(() => {
                  response.send({
                    message: "Password has been reset successfully",
                  });
                })
                .catch(() => {
                  console.log(
                    "error occured while deleteing password reset request record"
                  );
                  response.send({
                    message:
                      "error occured while deleteing password reset request record",
                  });
                });
            })
            .catch(() => {
              console.log("error occured while updating password");
              response.send({
                message: "error occured while updating password",
              });
            });
        } else {
          response.send({ message: "Reset String is not valid" });
        }
      } else {
        passwordReset.deleteOne({ userId }).then(() => {
          response.send({ message: "Password reset request expired" });
        });
      }
    } else {
      response.send({ message: "password reset request not found" });
    }
  } catch (error) {
    response.send({
      message: "Password reset request has expired",
    });
  }
}

async function getUserData(request, response) {
  response.send({ message: "User Data received" });
}

export { signup, login, logout, verify, requestReset, reset, getUserData };
