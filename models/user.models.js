import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema({
  fullname: {type: String},
  email: { type: String, unique: true },
  username: { type: String, unique: true },
  password: { type: String, length: 6 },
  createdOn: { type: Date, default: new Date().getTime() },
});

export default mongoose.model("User", userSchema);
