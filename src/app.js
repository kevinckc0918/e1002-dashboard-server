import { getSelectedPhoto } from "./services/photo.service.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getWeather, getWeatherCacheStatus } from "./services/weather.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", async (req, res) => {
  const now = new Date();
  const weather = await getWeather();
  const photo = await getSelectedPhoto();

  res.set("Cache-Control", "no-store");
  res.render("dashboard", {
    title: "E1002 Dashboard",
    build: "v3.0.0-build004.1",
    date: new Intl.DateTimeFormat("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now),
    weekday: new Intl.DateTimeFormat("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      weekday: "long"
    }).format(now),
    weather,
    photo
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    build: "v3.0.0-build004.1",
    uptime: Math.floor(process.uptime()),
    weatherCache: getWeatherCacheStatus()
  });
});

export default app;
