const CURRENT_WEATHER_URL =
  "https://data.weather.gov.hk/weatherAPI/opendata/weather.php" +
  "?dataType=rhrread&lang=tc";

const FORECAST_URL =
  "https://data.weather.gov.hk/weatherAPI/opendata/weather.php" +
  "?dataType=fnd&lang=tc";

const CACHE_DURATION_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

let weatherCache = {
  data: null,
  fetchedAt: 0,
  lastError: null
};

function findStationValue(items, stationName) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const matched = items.find((item) => item.place === stationName);

  return matched?.value ?? items[0]?.value ?? null;
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

function createWeatherResult(current, forecast) {
  const today = forecast.weatherForecast?.[0] ?? {};

  return {
    temperature: findStationValue(
      current.temperature?.data,
      "香港天文台"
    ),
    humidity: findStationValue(
      current.humidity?.data,
      "香港天文台"
    ),
    maximumTemperature:
      today.forecastMaxtemp?.value ?? null,
    minimumTemperature:
      today.forecastMintemp?.value ?? null,
    summary:
      today.forecastWeather ?? "暫時未有天氣概況",
    icon:
      current.icon?.[0] ??
      today.ForecastIcon ??
      null,
    warnings: Array.isArray(current.warningMessage)
      ? current.warningMessage.filter(Boolean)
      : [],
    updateTime: current.updateTime ?? null,
    stale: false
  };
}

export async function getWeather() {
  const cacheAge = Date.now() - weatherCache.fetchedAt;

  if (
    weatherCache.data &&
    cacheAge < CACHE_DURATION_MS
  ) {
    return weatherCache.data;
  }

  try {
    const [current, forecast] = await Promise.all([
      fetchJson(CURRENT_WEATHER_URL),
      fetchJson(FORECAST_URL)
    ]);

    const data = createWeatherResult(current, forecast);

    weatherCache = {
      data,
      fetchedAt: Date.now(),
      lastError: null
    };

    return data;
  } catch (error) {
    console.error("Weather service error:", error);

    weatherCache.lastError = error.message;

    if (weatherCache.data) {
      return {
        ...weatherCache.data,
        stale: true
      };
    }

    return {
      temperature: "--",
      humidity: "--",
      maximumTemperature: "--",
      minimumTemperature: "--",
      summary: "暫時未能讀取香港天文台資料",
      icon: null,
      warnings: ["天氣資料暫時未能更新"],
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