"use strict";

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/puc", require("./routes/pucRoutes"));
app.use("/api/certificates", require("./routes/certificateRoutes"));
app.use("/api/owner", require("./routes/ownerRoutes"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PUC Blockchain Backend is running!",
  });
});

async function startServer() {
  try {
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("MongoDB connected successfully!");
    } else {
      console.log("MONGODB_URI not found in .env, continuing without MongoDB.");
    }

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();
