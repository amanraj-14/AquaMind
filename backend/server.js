require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Zone = require("./models/Zone");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Login token is missing",
    });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (error) {
    res.status(403).json({
      message: "Invalid or expired login token",
    });
  }
}

app.get("/", (req, res) => {
  res.send("AquaMind backend is running");
});
// ================= AUTH =================

// SIGNUP
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      message: "Could not create account",
    });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Could not login",
    });
  }
});
// ================= 7-DAY WEATHER FORECAST =================
// ================= 7-DAY WEATHER FORECAST =================

app.get("/api/weather/forecast", authenticateToken, async (req, res) => {
  try {
    const city = req.query.city || process.env.WEATHER_CITY;

    // Find city coordinates
    const geoUrl =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(city)}` +
      `&count=1` +
      `&language=en` +
      `&format=json`;

    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    if (!geoResponse.ok || !geoData.results || geoData.results.length === 0) {
      return res.status(404).json({
        message: "City not found",
      });
    }

    const location = geoData.results[0];

    const latitude = location.latitude;
    const longitude = location.longitude;

    // 7-day weather
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset` +
      `&timezone=auto` +
      `&forecast_days=7`;

    const weatherResponse = await fetch(weatherUrl);

    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      console.log("Open-Meteo error:", weatherData);

      return res.status(500).json({
        message: "Could not load forecast",
      });
    }

    const daily = weatherData.daily;

    const forecast = daily.time.map((date, index) => {
      const dateObject = new Date(`${date}T12:00:00`);

      const dayName = dateObject.toLocaleDateString("en-IN", {
        weekday: "short",
      });

      return {
        day: index === 0 ? "Today" : dayName,

        date: date,

        maxTemperature: daily.temperature_2m_max[index],

        minTemperature: daily.temperature_2m_min[index],

        weatherCode: daily.weather_code[index],

        rainProbability: daily.precipitation_probability_max[index] ?? 0,

        sunrise: daily.sunrise[index],

        sunset: daily.sunset[index],
      };
    });

    res.json({
      city: location.name,
      forecast: forecast,
    });
  } catch (error) {
    console.error("7-day forecast error:", error);

    res.status(500).json({
      message: "Could not load 7-day forecast",
    });
  }
});
// ================= 7-DAY WEATHER FORECAST =================

// ================= CURRENT WEATHER =================

app.get("/api/weather", authenticateToken, async (req, res) => {
  try {
    const city = req.query.city || process.env.WEATHER_CITY;

    // Get city coordinates
    const geoUrl =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(city)}` +
      `&count=1` +
      `&language=en` +
      `&format=json`;

    const geoResponse = await fetch(geoUrl);

    const geoData = await geoResponse.json();

    if (!geoResponse.ok || !geoData.results || geoData.results.length === 0) {
      return res.status(404).json({
        message: "Could not find city",
      });
    }

    const location = geoData.results[0];

    const latitude = location.latitude;

    const longitude = location.longitude;

    // Get current + today's sunrise/sunset
    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=` +
      `temperature_2m,` +
      `relative_humidity_2m,` +
      `apparent_temperature,` +
      `weather_code,` +
      `wind_speed_10m,` +
      `surface_pressure` +
      `&daily=` +
      `sunrise,sunset,uv_index_max` +
      `&timezone=auto` +
      `&forecast_days=1`;

    const weatherResponse = await fetch(weatherUrl);

    const weatherData = await weatherResponse.json();

    if (!weatherResponse.ok) {
      return res.status(500).json({
        message: "Could not load current weather",
      });
    }

    const current = weatherData.current;

    const daily = weatherData.daily;

    res.json({
      city: location.name,

      temperature: Number(current.temperature_2m.toFixed(1)),

      feelsLike: Number(current.apparent_temperature.toFixed(1)),

      humidity: current.relative_humidity_2m,

      windSpeed: Number(current.wind_speed_10m.toFixed(1)),

      pressure: Math.round(current.surface_pressure),

      condition: getWeatherDescription(current.weather_code),

      weatherCode: current.weather_code,

      sunrise: formatTime(daily.sunrise[0]),

      sunset: formatTime(daily.sunset[0]),

      uv: Number(daily.uv_index_max[0].toFixed(1)),
    });
  } catch (error) {
    console.error("Current weather error:", error);

    res.status(500).json({
      message: "Could not load current weather",
    });
  }
});
// ================= DASHBOARD API =================

app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const zones = await Zone.find({
      user: req.user.userId,
    }).sort({ createdAt: -1 });

    const totalZones = zones.length;

    const activeZones = zones.filter((zone) => zone.isActive === true).length;

    const averageSoilMoisture =
      totalZones > 0
        ? zones.reduce((sum, zone) => sum + (zone.soilMoisture || 0), 0) /
          totalZones
        : 0;

    const waterSaved = zones.reduce(
      (sum, zone) => sum + (zone.waterSaved || 0),
      0,
    );

    const waterUsed = zones.reduce(
      (sum, zone) => sum + (zone.waterUsed || 0),
      0,
    );

    // Average temperature
    const averageTemperature =
      totalZones > 0
        ? zones.reduce((sum, zone) => sum + (zone.temperature || 0), 0) /
          totalZones
        : 0;

    // Average humidity
    const averageHumidity =
      totalZones > 0
        ? zones.reduce((sum, zone) => sum + (zone.humidity || 0), 0) /
          totalZones
        : 0;

    // Find next scheduled zone
    const scheduledZones = zones.filter(
      (zone) => zone.aiSchedule && zone.aiSchedule !== "Not scheduled",
    );

    const nextSchedule =
      scheduledZones.length > 0
        ? scheduledZones[0].aiSchedule
        : "Not scheduled";

    res.json({
      date: new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),

      time: new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),

      totalZones,
      activeZones,

      averageSoilMoisture: Number(averageSoilMoisture.toFixed(1)),

      averageTemperature: Number(averageTemperature.toFixed(1)),

      averageHumidity: Number(averageHumidity.toFixed(1)),

      waterSaved: Number(waterSaved.toFixed(1)),

      waterUsed: Number(waterUsed.toFixed(1)),

      nextSchedule,

      zones,
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    res.status(500).json({
      message: "Could not load dashboard data",
    });
  }
});
// ================= GET ALL ZONES =================

app.get("/api/zones", authenticateToken, async (req, res) => {
  try {
    const zones = await Zone.find({
      user: req.user.userId,
    }).sort({ createdAt: -1 });

    res.json(zones);
  } catch (error) {
    console.error("Zones loading error:", error);

    res.status(500).json({
      message: "Could not load irrigation zones",
    });
  }
});
// ================= ADD NEW ZONE =================

app.post("/api/zones", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      crop,
      area,
      soilMoisture,
      status,
      nextWater,
      schedule,
      latitude,
      longitude,
    } = req.body;

    if (!name || !crop || !area) {
      return res.status(400).json({
        message: "Zone name, crop and area are required",
      });
    }

    const zone = await Zone.create({
      user: req.user.userId,
      name,
      crop,
      area: Number(area),
      soilMoisture: Number(soilMoisture) || 0,
      status: status || "Good",

      // User's irrigation schedule
      nextWater: nextWater || "Not scheduled",
      aiSchedule: schedule || "Daily",

      temperature: 0,
      humidity: 0,
      waterUsed: 0,
      waterSaved: 0,
      latitude: Number(latitude),
      longitude: Number(longitude),

      isActive: false,
    });

    res.status(201).json({
      message: "Irrigation zone added successfully",
      zone,
    });
  } catch (error) {
    console.error("Add zone error:", error);

    res.status(500).json({
      message: "Could not add irrigation zone",
    });
  }
});
// ================= SENSOR UPDATE API =================

app.put("/api/zones/:id/sensor", authenticateToken, async (req, res) => {
  try {
    const { soilMoisture, temperature, humidity } = req.body;

    const zone = await Zone.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!zone) {
      return res.status(404).json({
        message: "Zone not found",
      });
    }

    if (soilMoisture !== undefined) {
      zone.soilMoisture = soilMoisture;
    }

    if (temperature !== undefined) {
      zone.temperature = temperature;
    }

    if (humidity !== undefined) {
      zone.humidity = humidity;
    }

    // Automatic soil status
    if (zone.soilMoisture < 30) {
      zone.status = "Critical";
    } else if (zone.soilMoisture < 45) {
      zone.status = "Needs Water";
    } else {
      zone.status = "Good";
    }

    await zone.save();

    res.json({
      message: "Sensor data updated",
      zone,
    });
  } catch (error) {
    console.error("Sensor update error:", error);

    res.status(500).json({
      message: "Could not update sensor data",
    });
  }
});
// ================= IRRIGATION CONTROL =================

app.put("/api/zones/:id/irrigation", authenticateToken, async (req, res) => {
  try {
    const { isActive } = req.body;

    const zone = await Zone.findOne({
      _id: req.params.id,
      user: req.user.userId,
    });

    if (!zone) {
      return res.status(404).json({
        message: "Zone not found",
      });
    }

    zone.isActive = Boolean(isActive);

    await zone.save();

    res.json({
      message: zone.isActive ? "Irrigation started" : "Irrigation stopped",

      zone,
    });
  } catch (error) {
    console.error("Irrigation error:", error);

    res.status(500).json({
      message: "Could not update irrigation",
    });
  }
});
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error.message);
  });
function getWeatherDescription(code) {
  if (code === 0) return "Clear Sky";

  if (code === 1) return "Mainly Clear";

  if (code === 2) return "Partly Cloudy";

  if (code === 3) return "Overcast";

  if (code === 45 || code === 48) return "Fog";

  if (code >= 51 && code <= 57) return "Drizzle";

  if (code >= 61 && code <= 67) return "Rain";

  if (code >= 71 && code <= 77) return "Snow";

  if (code >= 80 && code <= 82) return "Rain Showers";

  if (code >= 95) return "Thunderstorm";

  return "Unknown";
}

function formatTime(dateTime) {
  if (!dateTime) {
    return "--";
  }

  const date = new Date(dateTime);

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
