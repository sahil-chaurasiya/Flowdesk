const { OFFICE_LOCATION } = require('../config/office');

/**
 * Haversine formula to calculate distance between two coordinates in meters
 */
const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRadians = (degrees) => degrees * (Math.PI / 180);

/**
 * Check if given coordinates are within office radius
 */
const isWithinOffice = (latitude, longitude) => {
  const distance = haversineDistance(
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude,
    latitude,
    longitude
  );

  return {
    isValid: distance <= OFFICE_LOCATION.allowedRadiusMeters,
    distance: Math.round(distance),
    allowedRadius: OFFICE_LOCATION.allowedRadiusMeters,
  };
};

module.exports = { isWithinOffice, haversineDistance };
