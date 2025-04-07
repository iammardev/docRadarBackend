import fetch from "node-fetch";

// Replace with your actual GoMaps.pro API key
const API_KEY = "AlzaSylip5fYR44gPysRs3u4Qlh2HRK77QE9G0U";

/**
 * Geocodes an address to get latitude and longitude coordinates
 * @param {string} address - The address to geocode
 * @returns {Object} - Object containing GeoJSON location
 */
const geocodeAddress = async (address) => {
  const url = `https://maps.gomaps.pro/maps/api/geocode/json?key=${API_KEY}&address=${encodeURIComponent(
    address
  )}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.results && data.results.length > 0) {
      // Extract latitude and longitude from the location object in the response
      const { lat, lng } = data.results[0].geometry.location;

      // Return a GeoJSON Point object
      return {
        location: {
          type: "Point",
          coordinates: [lng, lat], // GeoJSON uses [longitude, latitude] order
        },
      };
    } else {
      console.error("Geocoding failed:", data.status || "No results found");
      // Return default values if geocoding fails
      return {
        location: {
          type: "Point",
          coordinates: [null, null],
        },
      };
    }
  } catch (error) {
    console.error("Geocoding error:", error);
    // Return default values if geocoding fails
    return {
      location: {
        type: "Point",
        coordinates: [null, null],
      },
    };
  }
};

export default geocodeAddress;
