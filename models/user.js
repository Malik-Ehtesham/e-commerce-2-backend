const mongoose = require("mongoose");
const crypto = require("crypto");
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
// const validator = require("validator");

const userSchema = new Schema({
  username: {
    type: String,
    required: [true, "Please provide your username"],
    // unique: true,
  },
  email: {
    type: String,
    required: [true, "Please provide your email"],
    unique: true,
    lowercase: true,
    // validate: [validator.isEmail, "Please provide a valid email"],
  },

  role: { type: String, enum: ["user", "admin"], default: "user" },
  password: {
    type: String,
    required: [true, "Please provide a password"],
    // minLength: [8, "Password must be at least 8 characters long"],
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, "Please confirm you password"],
    validate: {
      validator: function (el) {
        // Check if passwordConfirm matches the password
        if (el !== this.password) {
          throw new Error("Passwords do not match");
        }
      },
      message: "Passwords do not match", // Custom error message
    },
  },

  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
});

userSchema.pre("save", async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("password")) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  // this points to the cureent query
  this.find({ active: { $ne: false } });
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False means not changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};
const User = mongoose.model("User", userSchema);

module.exports = User;
