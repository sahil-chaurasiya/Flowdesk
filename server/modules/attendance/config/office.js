module.exports = {
  OFFICE_LOCATION: {
    latitude: parseFloat(process.env.OFFICE_LATITUDE) || 23.2310465,
    longitude: parseFloat(process.env.OFFICE_LONGITUDE) || 77.442858,
    allowedRadiusMeters: parseInt(process.env.OFFICE_RADIUS_METERS) || 200,
  },
  OFFICE_TIMING: {
    // Mon–Fri: late if checked in after 11:00 AM IST (30-minute grace period)
    weekdayStartHour: 11,
    weekdayStartMinute: 0,
    // Saturday: late if checked in after 11:30 AM IST
    saturdayStartHour: 11,
    saturdayStartMinute: 30,
    reminderHour: 10,
    reminderMinute: 30,
  },
};