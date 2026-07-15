import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (req, res) => {
  res.render("dashboard", {
    title: "E1002 Dashboard",
    build: "v3.0.0-build001",
    date: new Intl.DateTimeFormat("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date()),
    weekday: new Intl.DateTimeFormat("zh-HK", {
      timeZone: "Asia/Hong_Kong",
      weekday: "long"
    }).format(new Date())
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    build: "v3.0.0-build001",
    uptime: Math.floor(process.uptime())
  });
});

export default app;