"use strict";

const User = require("../models/User");

// Register User into MongoDB
async function register(req, res) {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please log in.",
      });
    }

    // Create user
    const user = new User({
      name: String(name).trim(),
      email: normalizedEmail,
      role: "owner",
    });

    user.setPassword(password);
    await user.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully in MongoDB!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Auth register error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to register user in MongoDB.",
    });
  }
}

// Login User against MongoDB
async function login(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.verifyPassword(password)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error) {
    console.error("Auth login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process login.",
    });
  }
}

function logout(req, res) {
  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
}

module.exports = {
  register,
  login,
  logout,
};
