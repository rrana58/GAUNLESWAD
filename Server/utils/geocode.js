/**
 * geocode.js — Reverse geocoding using Nominatim (OpenStreetMap)
 * Free, no API key required. Rate limit: 1 req/sec.
 * Nepal bounding box validation included.
 * Always resolves — never crashes an order on geocoding failure.
 */

const https = require("https");

const NEPAL_BOUNDS = { minLat: 26.347, maxLat: 30.448, minLng: 80.058, maxLng: 88.201 };

function isWithinNepal(lat, lng) {
  return lat >= NEPAL_BOUNDS.minLat && lat <= NEPAL_BOUNDS.maxLat &&
         lng >= NEPAL_BOUNDS.minLng && lng <= NEPAL_BOUNDS.maxLng;
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "GharkoSwad/1.0 (gharkoswad@gmail.com)",
        "Accept-Language": "en",
      },
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Invalid JSON from geocoder")); }
      });
    }).on("error", reject);
  });
}

async function reverseGeocode(lat, lng) {
  const fallback = {
    street: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    area: "",
    city: "Kathmandu",
    landmark: "",
    displayName: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`;
    const data = await httpsGetJson(url);
    if (!data || data.error) return fallback;

    const addr = data.address || {};
    const road = addr.road || addr.footway || addr.path || addr.pedestrian || addr.street || "";
    const houseNo = addr.house_number ? `${addr.house_number}, ` : "";
    const street = `${houseNo}${road}`.trim() || fallback.street;
    const area = addr.neighbourhood || addr.suburb || addr.quarter || addr.village || addr.county || "";
    const city = addr.city || addr.town || addr.municipality || addr.district || "Kathmandu";
    const landmark = addr.amenity || addr.tourism || addr.leisure || addr.shop || addr.office || "";

    return { street, area, city, landmark, displayName: data.display_name || `${street}, ${area}, ${city}` };
  } catch (err) {
    require("./logger").warn(`[geocode] Reverse geocoding failed: ${err.message}`);
    return fallback;
  }
}

function validateDeliveryAddress(addr) {
  const errors = [];
  if (!addr || typeof addr !== "object") return { valid: false, errors: ["deliveryAddress is required"] };
  const type = addr.type || "manual";

  if (type === "gps") {
    const coords = addr.coordinates;
    if (!coords) {
      errors.push("coordinates are required for GPS location");
    } else {
      const lat = Number(coords.lat), lng = Number(coords.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        errors.push("coordinates.lat and coordinates.lng must be valid numbers");
      } else if (!isWithinNepal(lat, lng)) {
        errors.push("Coordinates must be within Nepal");
      }
    }
  } else {
    if (!addr.street || !addr.street.trim()) errors.push("street address is required");
    if (addr.street?.length > 200) errors.push("street address max 200 chars");
    if (addr.coordinates) {
      const lat = Number(addr.coordinates.lat), lng = Number(addr.coordinates.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && !isWithinNepal(lat, lng)) {
        errors.push("provided coordinates are not within Nepal");
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

module.exports = { reverseGeocode, validateDeliveryAddress, isWithinNepal };
