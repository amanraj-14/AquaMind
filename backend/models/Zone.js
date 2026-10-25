const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    crop: {
      type: String,
      required: true,
    },

    area: {
      type: Number,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    // Soil sensor data
    soilMoisture: {
      type: Number,
      default: 0,
    },

    // Weather / sensor data
    temperature: {
      type: Number,
      default: 0,
    },

    humidity: {
      type: Number,
      default: 0,
    },

    // Irrigation information
    waterUsed: {
      type: Number,
      default: 0,
    },

    waterSaved: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      default: "Good",
    },

    nextWater: {
      type: String,
      default: "Not scheduled",
    },

    // AI scheduling
    aiSchedule: {
      type: String,
      default: "Not scheduled",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Zone", zoneSchema);
