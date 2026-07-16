const CURRENT_WEATHER_URL =
  "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc";
const FORECAST_URL =
  "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=fnd&lang=tc";
const WARNING_SUMMARY_URL =
  "https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc";

const CACHE_DURATION_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const ICON_BASE = "https://www.hko.gov.hk/en/wxinfo/dailywx/images";

let weatherCache = { data: null, fetchedAt: 0, lastError: null };

function findStationValue(items, stationName) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.find((item) => item.place === stationName)?.value
    ?? items[0]?.value
    ?? null;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "E1002-Dashboard-Server/3.0"
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`香港天文台 API HTTP ${response.status}`);
  }

  return response.json();
}

function icon(filename) {
  return `${ICON_BASE}/${filename}`;
}

function warningToIcon(entryKey, warning) {
  const code = String(warning?.code ?? "").toUpperCase();
  const name = String(warning?.name ?? "");
  const type = String(warning?.type ?? "");
  const text = `${entryKey} ${code} ${name} ${type}`.toUpperCase();

  const base = {
    key: entryKey,
    code,
    name: type ? `${name}（${type}）` : name,
    iconUrl: null,
    shortLabel: code || entryKey
  };

  if (code.includes("WRAINB") || type.includes("黑")) {
    return { ...base, iconUrl: icon("rainb.gif"), shortLabel: "黑雨" };
  }
  if (code.includes("WRAINR") || type.includes("紅")) {
    return { ...base, iconUrl: icon("rainr.gif"), shortLabel: "紅雨" };
  }
  if (code.includes("WRAINA") || type.includes("黃") || type.includes("琥珀")) {
    return { ...base, iconUrl: icon("raina.gif"), shortLabel: "黃雨" };
  }

  if (code.includes("TC10") || text.includes("十號")) {
    return { ...base, iconUrl: icon("tc10.gif"), shortLabel: "10" };
  }
  if (code.includes("TC9") || text.includes("九號")) {
    return { ...base, iconUrl: icon("tc9.gif"), shortLabel: "9" };
  }
  if (code.includes("TC8NE") || text.includes("東北")) {
    return { ...base, iconUrl: icon("tc8ne.gif"), shortLabel: "8NE" };
  }
  if (code.includes("TC8NW") || text.includes("西北")) {
    return { ...base, iconUrl: icon("tc8d.gif"), shortLabel: "8NW" };
  }
  if (code.includes("TC8SE") || text.includes("東南")) {
    return { ...base, iconUrl: icon("tc8b.gif"), shortLabel: "8SE" };
  }
  if (code.includes("TC8SW") || text.includes("西南")) {
    return { ...base, iconUrl: icon("tc8c.gif"), shortLabel: "8SW" };
  }
  if (code.includes("TC3") || text.includes("三號")) {
    return { ...base, iconUrl: icon("tc3.gif"), shortLabel: "3" };
  }
  if (code.includes("TC1") || text.includes("一號")) {
    return { ...base, iconUrl: icon("tc1.gif"), shortLabel: "1" };
  }

  if (entryKey === "WTS" || code === "WTS" || name.includes("雷暴")) {
    return { ...base, iconUrl: icon("ts.gif"), shortLabel: "雷暴" };
  }
  if (entryKey.includes("WFNTSA") || code.includes("WFNTSA") || name.includes("水浸")) {
    return { ...base, iconUrl: icon("ntfl.gif"), shortLabel: "水浸" };
  }
  if (code.includes("LANDSLIP") || name.includes("山泥傾瀉")) {
    return { ...base, iconUrl: icon("landslip.gif"), shortLabel: "山泥" };
  }
  if (code.includes("WMSGNL") || name.includes("季候風")) {
    return { ...base, iconUrl: icon("sms.gif"), shortLabel: "季候風" };
  }
  if (code.includes("WHOT") || name.includes("酷熱")) {
    return { ...base, iconUrl: icon("vhot.gif"), shortLabel: "酷熱" };
  }
  if (code.includes("WCOLD") || name.includes("寒冷")) {
    return { ...base, iconUrl: icon("cold.gif"), shortLabel: "寒冷" };
  }
  if (code.includes("FROST") || name.includes("霜凍")) {
    return { ...base, iconUrl: icon("frost.gif"), shortLabel: "霜凍" };
  }
  if (name.includes("火災危險")) {
    const red = type.includes("紅") || text.includes("RED");
    return {
      ...base,
      iconUrl: icon(red ? "firer.gif" : "firey.gif"),
      shortLabel: red ? "紅火" : "黃火"
    };
  }

  return base;
}

function parseWarningSummary(summary) {
  if (!summary || typeof summary !== "object") return [];

  return Object.entries(summary)
    .filter(([, warning]) =>
      warning &&
      String(warning.actionCode ?? "").toUpperCase() !== "CANCEL"
    )
    .map(([entryKey, warning]) => warningToIcon(entryKey, warning));
}

function createWeatherResult(current, forecast, warningSummary) {
  const today = forecast.weatherForecast?.[0] ?? {};

  return {
    temperature: findStationValue(current.temperature?.data, "香港天文台"),
    humidity: findStationValue(current.humidity?.data, "香港天文台"),
    maximumTemperature: today.forecastMaxtemp?.value ?? null,
    minimumTemperature: today.forecastMintemp?.value ?? null,
    summary: today.forecastWeather ?? "暫時未有天氣概況",
    icon: current.icon?.[0] ?? today.ForecastIcon ?? null,
    warnings: Array.isArray(current.warningMessage)
      ? current.warningMessage.filter(Boolean)
      : [],
    warningIcons: parseWarningSummary(warningSummary),
    updateTime: current.updateTime ?? null,
    stale: false
  };
}

export async function getWeather() {
  if (
    weatherCache.data &&
    Date.now() - weatherCache.fetchedAt < CACHE_DURATION_MS
  ) {
    return weatherCache.data;
  }

  try {
    const [current, forecast, warningSummary] = await Promise.all([
      fetchJson(CURRENT_WEATHER_URL),
      fetchJson(FORECAST_URL),
      fetchJson(WARNING_SUMMARY_URL).catch(() => ({}))
    ]);

    const data = createWeatherResult(current, forecast, warningSummary);
    weatherCache = { data, fetchedAt: Date.now(), lastError: null };
    return data;
  } catch (error) {
    console.error("Weather service error:", error);
    weatherCache.lastError = error.message;

    if (weatherCache.data) {
      return { ...weatherCache.data, stale: true };
    }

    return {
      temperature: "--",
      humidity: "--",
      maximumTemperature: "--",
      minimumTemperature: "--",
      summary: "暫時未能讀取香港天文台資料",
      icon: null,
      warnings: ["天氣資料暫時未能更新"],
      warningIcons: [],
      updateTime: null,
      stale: true
    };
  }
}

export function getWeatherCacheStatus() {
  return {
    available: Boolean(weatherCache.data),
    fetchedAt: weatherCache.fetchedAt || null,
    lastError: weatherCache.lastError
  };
}
