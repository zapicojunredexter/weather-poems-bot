import { fetchWithTimeout } from './http.mjs';

// WMO weather codes used by Open-Meteo → plain words + an emoji for the UI.
const WMO = {
  0: ['clear sky', '☀️'], 1: ['mainly clear', '🌤️'], 2: ['partly cloudy', '⛅'], 3: ['overcast', '☁️'],
  45: ['fog', '🌫️'], 48: ['freezing fog', '🌫️'],
  51: ['light drizzle', '🌦️'], 53: ['drizzle', '🌦️'], 55: ['heavy drizzle', '🌧️'],
  56: ['freezing drizzle', '🌧️'], 57: ['heavy freezing drizzle', '🌧️'],
  61: ['light rain', '🌦️'], 63: ['rain', '🌧️'], 65: ['heavy rain', '🌧️'],
  66: ['freezing rain', '🌧️'], 67: ['heavy freezing rain', '🌧️'],
  71: ['light snow', '🌨️'], 73: ['snow', '🌨️'], 75: ['heavy snow', '❄️'], 77: ['snow grains', '🌨️'],
  80: ['light rain showers', '🌦️'], 81: ['rain showers', '🌧️'], 82: ['violent rain showers', '⛈️'],
  85: ['snow showers', '🌨️'], 86: ['heavy snow showers', '❄️'],
  95: ['thunderstorm', '⛈️'], 96: ['thunderstorm with hail', '⛈️'], 99: ['thunderstorm with heavy hail', '⛈️'],
};

export function describeCode(code) {
  const [text, icon] = WMO[code] ?? ['unsettled weather', '🌡️'];
  return { text, icon };
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const time = (iso) => (typeof iso === 'string' ? iso.slice(11, 16) : null); // "2026-10-15T05:47" → "05:47"

/** Turns a raw Open-Meteo response into the small, flat object the rest of the app uses. */
export function normalizeWeather(raw) {
  const c = raw?.current ?? {};
  const d = raw?.daily ?? {};
  const code = num(d.weather_code?.[0]) ?? num(c.weather_code) ?? -1;
  const { text, icon } = describeCode(code);
  const weather = {
    date: d.time?.[0] ?? null,
    code,
    description: text,
    icon,
    tempNow: num(c.temperature_2m),
    tempMax: num(d.temperature_2m_max?.[0]),
    tempMin: num(d.temperature_2m_min?.[0]),
    humidity: num(c.relative_humidity_2m),
    windMax: num(d.wind_speed_10m_max?.[0]),
    rainChance: num(d.precipitation_probability_max?.[0]),
    rainMm: num(d.precipitation_sum?.[0]),
    uvMax: num(d.uv_index_max?.[0]),
    sunrise: time(d.sunrise?.[0]),
    sunset: time(d.sunset?.[0]),
  };
  if (weather.tempMax === null || weather.tempMin === null) throw new Error('Open-Meteo response was missing temperatures');
  return weather;
}

/** One request to the free Open-Meteo forecast API (no key). Throws on failure. */
export async function fetchWeather(location) {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: location.timezone,
    forecast_days: '1',
    current: 'temperature_2m,relative_humidity_2m,weather_code',
    daily: [
      'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'precipitation_sum',
      'precipitation_probability_max', 'wind_speed_10m_max', 'uv_index_max', 'sunrise', 'sunset',
    ].join(','),
  });
  const res = await fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${params}`);
  return normalizeWeather(await res.json());
}
