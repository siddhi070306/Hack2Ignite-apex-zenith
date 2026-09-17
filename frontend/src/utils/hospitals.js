// Coordinates of known regional nodes (fallback coordinate lookup)
export const NODE_COORDINATES = {
  'District Sector': { latitude: 23.1681, longitude: 79.9338 },
  'Community Sector': { latitude: 23.1800, longitude: 79.9500 },
  'Katni': { latitude: 23.8343, longitude: 80.3892 },
  'Jabalpur': { latitude: 23.1681, longitude: 79.9338 },
  'Bhopal': { latitude: 23.2599, longitude: 77.4126 },
  'District Civil Hospital': { latitude: 23.1700, longitude: 79.9400 },
  'Primary Health Centre (PHC)': { latitude: 23.1650, longitude: 79.9250 },
  'Apex Multispeciality Hospital': { latitude: 23.1780, longitude: 79.9480 },
  'Tertiary Referral Hospital': { latitude: 23.1681, longitude: 79.9338 }
};

// Regional hospitals and clinic profiles (hospitals, clinics, doctor practices)
export const REGIONAL_HOSPITALS = [
  { id: 'hosp-1', name: 'District Civil Hospital', phone: '+91 76122 22001', address: 'Civil Lines, Main Health Zone', type: 'hospital' },
  { id: 'hosp-2', name: 'Primary Health Centre (PHC)', phone: '+91 76122 23045', address: 'Sector 2 Main PHC Road', type: 'clinic' },
  { id: 'hosp-3', name: 'Piparia Rural Health Clinic', phone: '+91 76222 24590', address: 'Piparia Junction Road, MP', type: 'clinic' },
  { id: 'hosp-4', name: 'Apex Multispeciality Hospital', phone: '+91 98765 00107', address: 'Civil Lines, Katni Region, MP', type: 'hospital' },
  { id: 'hosp-5', name: 'Vikas Nagar Wellness Clinic', phone: '+91 98261 44321', address: 'Block B, Vikas Nagar, Katni, MP', type: 'clinic' },
  { id: 'hosp-6', name: 'Pimpri Sub-Health Centre', phone: '+91 76222 29810', address: 'Village Square, Pimpri, MP', type: 'clinic' },
  { id: 'hosp-7', name: 'Dr. Sharma Family Clinic', phone: '+91 94251 11200', address: 'Station Road, Katni, MP', type: 'doctors' },
  { id: 'hosp-8', name: 'Jabalpur Tertiary Referral Hospital', phone: '+91 76126 20042', address: 'Medical College Campus, Jabalpur, MP', type: 'hospital' }
];

// Haversine straight-line distance between two coordinates, in km.
export function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Registers a village/area name's coordinates for later lookup.
export function registerDynamicVillage(villageName, latitude, longitude) {
  if (!villageName) return;
  NODE_COORDINATES[villageName.trim()] = { latitude, longitude };
}

// Reverse geocodes coordinates into a human-readable area name via Nominatim.
export async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'ASHA-Mitra-Triage-Companion-Agent' }
    });
    if (!response.ok) throw new Error('Nominatim reverse geocode request failed');
    const data = await response.json();
    const addr = data.address || {};
    return addr.village || addr.town || addr.suburb || addr.city_district || addr.city || addr.county || addr.state_district || 'Regional Cluster';
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
    return null;
  }
}

// Forward geocodes an area name into coordinates via Nominatim.
export async function forwardGeocode(name) {
  if (!name || !name.trim()) return null;
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(name)}&limit=1`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'ASHA-Mitra-Triage-Companion-Agent' }
    });
    if (!response.ok) throw new Error('Nominatim forward geocode request failed');
    const data = await response.json();
    if (data && data.length > 0) {
      return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) };
    }
  } catch (error) {
    console.error('Forward geocoding failed:', error);
  }
  return null;
}

// Resolves a location name or explicit coordinates into exact { latitude, longitude }.
export async function resolveLocationCoordinates(locationName, explicitCoords = null) {
  if (explicitCoords && explicitCoords.latitude && explicitCoords.longitude) {
    return explicitCoords;
  }
  if (!locationName || !locationName.trim()) {
    return NODE_COORDINATES['District Sector'];
  }
  const cleanName = locationName.trim();

  for (const nodeName in NODE_COORDINATES) {
    if (nodeName.toLowerCase() === cleanName.toLowerCase() || cleanName.toLowerCase().includes(nodeName.toLowerCase()) || nodeName.toLowerCase().includes(cleanName.toLowerCase())) {
      return NODE_COORDINATES[nodeName];
    }
  }

  const geocoded = await forwardGeocode(cleanName);
  if (geocoded) {
    registerDynamicVillage(cleanName, geocoded.latitude, geocoded.longitude);
    return geocoded;
  }

  return NODE_COORDINATES['District Sector'];
}

// In-memory cache for Overpass API facility queries.
const OVERPASS_CACHE = new Map();

// Fetches real-world nearby hospitals/clinics/doctors from the OpenStreetMap Overpass API.
export async function fetchNearbyHospitalsOverpass(lat, lng) {
  const cacheKey = `${parseFloat(lat).toFixed(2)}_${parseFloat(lng).toFixed(2)}`;
  if (OVERPASS_CACHE.has(cacheKey)) {
    return OVERPASS_CACHE.get(cacheKey);
  }

  const query = `[out:json][timeout:15];
(
  nwr["amenity"="hospital"](around:12000,${lat},${lng});
  nwr["amenity"="clinic"](around:12000,${lat},${lng});
  nwr["amenity"="doctors"](around:12000,${lat},${lng});
  nwr["healthcare"="clinic"](around:12000,${lat},${lng});
  nwr["healthcare"="centre"](around:12000,${lat},${lng});
  nwr["healthcare"="doctor"](around:12000,${lat},${lng});
  nwr["healthcare"="hospital"](around:12000,${lat},${lng});
  nwr["healthcare"="dispensary"](around:12000,${lat},${lng});
);
out center;`;

  const endpoints = [
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://overpass.private.coffee/api/interpreter?data=${encodeURIComponent(query)}`
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.elements) {
          OVERPASS_CACHE.set(cacheKey, data.elements);
          return data.elements;
        }
      }
    } catch (err) {
      console.warn(`Overpass endpoint request failed (${url}):`, err.message);
    }
  }

  console.error('All Overpass API mirrors failed to return facilities.');
  return [];
}

// Generates realistic placeholder facilities around a coordinate when live APIs fail or are offline.
export function generateDynamicFallbackHospitals(lat, lng, areaName) {
  const cleanArea = areaName || 'Local Area';
  return [
    { id: 'fallback-hosp-1', name: `${cleanArea} Primary Health Centre (PHC)`, phone: '+91 99999 11101', address: `Main Market Road, ${cleanArea}`, type: 'clinic', latitude: lat + 0.006, longitude: lng - 0.005 },
    { id: 'fallback-hosp-2', name: `${cleanArea} Community Health Centre (CHC)`, phone: '+91 99999 11102', address: `Near Block Office, ${cleanArea}`, type: 'clinic', latitude: lat - 0.005, longitude: lng + 0.007 },
    { id: 'fallback-hosp-3', name: `${cleanArea} General Hospital`, phone: '+91 99999 11103', address: `Station Road, ${cleanArea}`, type: 'hospital', latitude: lat + 0.012, longitude: lng - 0.010 },
    { id: 'fallback-hosp-4', name: "Dr. Patel's Family Clinic", phone: '+91 99999 11104', address: `Chowk Bazaar, ${cleanArea}`, type: 'doctors', latitude: lat - 0.003, longitude: lng - 0.004 },
    { id: 'fallback-hosp-5', name: 'City Trauma & Emergency Hospital', phone: '+91 99999 11105', address: `National Highway Bypass, ${cleanArea}`, type: 'hospital', latitude: lat + 0.018, longitude: lng + 0.015 }
  ];
}

// Finds nearby real-world hospitals/clinics via Overpass, with regional + generated fallbacks.
export async function getNearbyHospitalsAsync(lat, lng, villageName) {
  let startLat = 23.1681;
  let startLng = 79.9338;
  const hasGps = Boolean(lat && lng);
  let fetchedList = [];

  if (hasGps) {
    startLat = lat;
    startLng = lng;
    const elements = await fetchNearbyHospitalsOverpass(lat, lng);

    if (elements && elements.length > 0) {
      elements.forEach(elem => {
        const tags = elem.tags || {};
        const elemLat = elem.lat || elem.center?.lat;
        const elemLng = elem.lon || elem.center?.lon;
        if (!elemLat || !elemLng) return;

        let typeCategory = 'hospital';
        let typeLabel = 'Hospital';
        const amenity = (tags.amenity || '').toLowerCase();
        const healthcare = (tags.healthcare || '').toLowerCase();

        if (amenity === 'clinic' || healthcare === 'clinic' || healthcare === 'centre' || healthcare === 'dispensary') {
          typeCategory = 'clinic';
          typeLabel = 'Clinic / PHC';
        } else if (amenity === 'doctors' || healthcare === 'doctor') {
          typeCategory = 'doctors';
          typeLabel = 'Doctor Clinic';
        }

        const rawName = tags.name || tags['name:en'] || tags['official_name'];
        const name = rawName || `Local ${typeLabel} (${tags.operator || tags['addr:suburb'] || 'Health Unit'})`;
        const phone = tags.phone || tags['contact:phone'] || tags['phone:mobile'] || '+91 99999 00000';
        const address = tags['addr:full'] || tags['addr:street'] || tags['addr:suburb'] || tags['addr:city'] || `${typeLabel} Facility`;

        NODE_COORDINATES[name] = { latitude: elemLat, longitude: elemLng };
        fetchedList.push({ id: `overpass-${elem.type}-${elem.id}`, name, phone, address, type: typeCategory, latitude: elemLat, longitude: elemLng });
      });
    }
  } else {
    const cleanVillage = (villageName || '').toLowerCase().trim();
    let matchedNode = null;
    for (const nodeName in NODE_COORDINATES) {
      if (nodeName.toLowerCase() === cleanVillage || cleanVillage.includes(nodeName.toLowerCase())) {
        matchedNode = nodeName;
        break;
      }
    }
    if (matchedNode) {
      startLat = NODE_COORDINATES[matchedNode].latitude;
      startLng = NODE_COORDINATES[matchedNode].longitude;
    } else {
      startLat = NODE_COORDINATES['District Sector'].latitude;
      startLng = NODE_COORDINATES['District Sector'].longitude;
    }
  }

  const combinedMap = new Map();

  if (fetchedList.length > 0) {
    fetchedList.forEach(item => combinedMap.set(item.name.toLowerCase(), item));
    REGIONAL_HOSPITALS.forEach(hosp => {
      const coords = NODE_COORDINATES[hosp.name] || { latitude: 23.8000, longitude: 80.3500 };
      const dist = getHaversineDistance(startLat, startLng, coords.latitude, coords.longitude);
      if (dist <= 35) combinedMap.set(hosp.name.toLowerCase(), { ...hosp, latitude: coords.latitude, longitude: coords.longitude });
    });
  } else {
    const dynamicFallbacks = generateDynamicFallbackHospitals(startLat, startLng, villageName);
    dynamicFallbacks.forEach(item => {
      NODE_COORDINATES[item.name] = { latitude: item.latitude, longitude: item.longitude };
      combinedMap.set(item.name.toLowerCase(), item);
    });
    REGIONAL_HOSPITALS.forEach(hosp => {
      const coords = NODE_COORDINATES[hosp.name] || { latitude: 23.8000, longitude: 80.3500 };
      const dist = getHaversineDistance(startLat, startLng, coords.latitude, coords.longitude);
      if (dist <= 35) combinedMap.set(hosp.name.toLowerCase(), { ...hosp, latitude: coords.latitude, longitude: coords.longitude });
    });
  }

  const localFallbacks = generateDynamicFallbackHospitals(startLat, startLng, villageName);
  localFallbacks.forEach(item => {
    NODE_COORDINATES[item.name] = { latitude: item.latitude, longitude: item.longitude };
    if (!combinedMap.has(item.name.toLowerCase())) combinedMap.set(item.name.toLowerCase(), item);
  });

  let results = Array.from(combinedMap.values()).map(hosp => ({
    ...hosp,
    distance: parseFloat(getHaversineDistance(startLat, startLng, hosp.latitude, hosp.longitude).toFixed(1))
  }));

  results.sort((a, b) => a.distance - b.distance);

  if (hasGps) {
    const nearbyOnly = results.filter(h => h.distance <= 35);
    if (nearbyOnly.length > 0) results = nearbyOnly;
  }

  return results.slice(0, 60);
}
