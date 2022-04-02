/** @format */
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import bcrypt from "bcrypt";
import { User } from "../models/userModel.js";

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
  const [userFromDB] = await User.find({ email });
  if (userFromDB) {
    console.log({ message: "User already exist" });
    return response.send({ message: "User already exist" });
  } else {
    const hashedpassword = await genPassword(password);
    const newUser = new User({
      username: username,
      email: email,
      password: hashedpassword,
    });
    await newUser.save().then((result) => response.send(result));
  }
}

async function login(request, response) {
  const { username, email, password } = request.body;
  const [userFromDB] = await User.find({ username });
  console.log(userFromDB);
  if (userFromDB) {
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

const logout = async (request, response) => {
  response.clearCookie("token");
  return response.send({ message: "Logout Successful" });
};

export { signup, login, logout };
