/** @format */

import { User } from "./models/userModel.js";

async function createUser(newUser) {
  const newuser = new User(newUser);
  newuser.save().then((result) => {
    console.log(result);
    return result;
  });
}
async function getUserByName(username) {
  return User.find({ username })[0];
}

export { createUser, getUserByName };
