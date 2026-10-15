import { config } from './config.mjs';

export const CITIES = config.cities;

/** Finds a city by name, case-insensitively ("cebu city", "Cebu City"). */
export function findCity(name) {
  const key = String(name).trim().toLowerCase();
  return CITIES.find((c) => c.name.toLowerCase() === key) ?? null;
}

/** The city after the one used most recently, wrapping around, so runs tour the whole list. */
export function nextCity(lastCityName) {
  const i = CITIES.findIndex((c) => c.name === lastCityName);
  return CITIES[(i + 1) % CITIES.length];
}

/** Full location object used by the weather and poem modules. */
export function toLocation(city) {
  return { ...city, country: config.country, timezone: config.timezone };
}
