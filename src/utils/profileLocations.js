const CITY_COORDINATES = {
  "albuquerque|us": { lat: 35.0844, lon: -106.6504 },
  "atlanta|us": { lat: 33.749, lon: -84.388 },
  "austin|us": { lat: 30.2672, lon: -97.7431 },
  "baltimore|us": { lat: 39.2904, lon: -76.6122 },
  "birmingham|us": { lat: 33.5186, lon: -86.8104 },
  "boston|us": { lat: 42.3601, lon: -71.0589 },
  "brooklyn|us": { lat: 40.6782, lon: -73.9442 },
  "buffalo|us": { lat: 42.8864, lon: -78.8784 },
  "cambridge|us": { lat: 42.3736, lon: -71.1097 },
  "charlotte|us": { lat: 35.2271, lon: -80.8431 },
  "chicago|us": { lat: 41.8781, lon: -87.6298 },
  "cincinnati|us": { lat: 39.1031, lon: -84.512 },
  "cleveland|us": { lat: 41.4993, lon: -81.6944 },
  "colorado springs|us": { lat: 38.8339, lon: -104.8214 },
  "columbia|us": { lat: 34.0007, lon: -81.0348 },
  "columbus|us": { lat: 39.9612, lon: -82.9988 },
  "dallas|us": { lat: 32.7767, lon: -96.797 },
  "denver|us": { lat: 39.7392, lon: -104.9903 },
  "detroit|us": { lat: 42.3314, lon: -83.0458 },
  "el paso|us": { lat: 31.7619, lon: -106.485 },
  "fort worth|us": { lat: 32.7555, lon: -97.3308 },
  "fresno|us": { lat: 36.7378, lon: -119.7871 },
  "grand rapids|us": { lat: 42.9634, lon: -85.6681 },
  "hartford|us": { lat: 41.7658, lon: -72.6734 },
  "henderson|us": { lat: 36.0395, lon: -114.9817 },
  "houston|us": { lat: 29.7604, lon: -95.3698 },
  "indianapolis|us": { lat: 39.7684, lon: -86.1581 },
  "jacksonville|us": { lat: 30.3322, lon: -81.6557 },
  "jersey city|us": { lat: 40.7178, lon: -74.0431 },
  "kansas city|us": { lat: 39.0997, lon: -94.5786 },
  "key west|us": { lat: 24.5551, lon: -81.78 },
  "las vegas|us": { lat: 36.1699, lon: -115.1398 },
  "long beach|us": { lat: 33.7701, lon: -118.1937 },
  "la|us": { lat: 34.0522, lon: -118.2437 },
  "los angeles|us": { lat: 34.0522, lon: -118.2437 },
  "louisville|us": { lat: 38.2527, lon: -85.7585 },
  "madison|us": { lat: 43.0731, lon: -89.4012 },
  "miami|us": { lat: 25.7617, lon: -80.1918 },
  "milwaukee|us": { lat: 43.0389, lon: -87.9065 },
  "minneapolis|us": { lat: 44.9778, lon: -93.265 },
  "morgantown|us": { lat: 39.6295, lon: -79.9559 },
  "naperville|us": { lat: 41.7508, lon: -88.1535 },
  "nashville|us": { lat: 36.1627, lon: -86.7816 },
  "new haven|us": { lat: 41.3083, lon: -72.9279 },
  "new orleans|us": { lat: 29.9511, lon: -90.0715 },
  "new york|us": { lat: 40.7128, lon: -74.006 },
  "nyc|us": { lat: 40.7128, lon: -74.006 },
  "newark|us": { lat: 40.7357, lon: -74.1724 },
  "oakland|us": { lat: 37.8044, lon: -122.2712 },
  "omaha|us": { lat: 41.2565, lon: -95.9345 },
  "orlando|us": { lat: 28.5383, lon: -81.3792 },
  "philadelphia|us": { lat: 39.9526, lon: -75.1652 },
  "phoenix|us": { lat: 33.4484, lon: -112.074 },
  "pittsburgh|us": { lat: 40.4406, lon: -79.9959 },
  "portland|us": { lat: 45.5152, lon: -122.6784 },
  "portland, me|us": { lat: 43.6591, lon: -70.2568 },
  "providence|us": { lat: 41.824, lon: -71.4128 },
  "queens|us": { lat: 40.7282, lon: -73.7949 },
  "raleigh|us": { lat: 35.7796, lon: -78.6382 },
  "richmond|us": { lat: 37.5407, lon: -77.436 },
  "sacramento|us": { lat: 38.5816, lon: -121.4944 },
  "salt lake city|us": { lat: 40.7608, lon: -111.891 },
  "san antonio|us": { lat: 29.4241, lon: -98.4936 },
  "san diego|us": { lat: 32.7157, lon: -117.1611 },
  "san francisco|us": { lat: 37.7749, lon: -122.4194 },
  "san jose|us": { lat: 37.3382, lon: -121.8863 },
  "savannah|us": { lat: 32.0809, lon: -81.0912 },
  "seattle|us": { lat: 47.6062, lon: -122.3321 },
  "st. louis|us": { lat: 38.627, lon: -90.1994 },
  "st. paul|us": { lat: 44.9537, lon: -93.09 },
  "tacoma|us": { lat: 47.2529, lon: -122.4443 },
  "tampa|us": { lat: 27.9506, lon: -82.4572 },
  "tucson|us": { lat: 32.2226, lon: -110.9747 },
  "virginia beach|us": { lat: 36.8529, lon: -75.978 },
  "washington|us": { lat: 38.9072, lon: -77.0369 },

  "alessandria|it": { lat: 44.9073, lon: 8.6117 },
  "ancona|it": { lat: 43.6158, lon: 13.5189 },
  "bari|it": { lat: 41.1171, lon: 16.8719 },
  "bergamo|it": { lat: 45.6983, lon: 9.6773 },
  "bologna|it": { lat: 44.4949, lon: 11.3426 },
  "bolzano|it": { lat: 46.4983, lon: 11.3548 },
  "brescia|it": { lat: 45.5416, lon: 10.2118 },
  "brindisi|it": { lat: 40.6327, lon: 17.9418 },
  "cagliari|it": { lat: 39.2238, lon: 9.1217 },
  "caserta|it": { lat: 41.0723, lon: 14.3311 },
  "catania|it": { lat: 37.5079, lon: 15.083 },
  "catanzaro|it": { lat: 38.9098, lon: 16.5877 },
  "como|it": { lat: 45.8081, lon: 9.0852 },
  "cosenza|it": { lat: 39.2983, lon: 16.2537 },
  "ferrara|it": { lat: 44.8381, lon: 11.6198 },
  "firenze|it": { lat: 43.7696, lon: 11.2558 },
  "florence|it": { lat: 43.7696, lon: 11.2558 },
  "foggia|it": { lat: 41.4622, lon: 15.5446 },
  "frosinone|it": { lat: 41.6396, lon: 13.3426 },
  "genova|it": { lat: 44.4056, lon: 8.9463 },
  "la spezia|it": { lat: 44.1025, lon: 9.8241 },
  "latina|it": { lat: 41.4676, lon: 12.9037 },
  "lecce|it": { lat: 40.3515, lon: 18.175 },
  "livorno|it": { lat: 43.5485, lon: 10.3106 },
  "l'aquila|it": { lat: 42.3498, lon: 13.3995 },
  "lucca|it": { lat: 43.8429, lon: 10.5027 },
  "matera|it": { lat: 40.6664, lon: 16.6043 },
  "messina|it": { lat: 38.1938, lon: 15.554 },
  "milan|it": { lat: 45.4642, lon: 9.19 },
  "milano|it": { lat: 45.4642, lon: 9.19 },
  "modena|it": { lat: 44.6471, lon: 10.9252 },
  "monza|it": { lat: 45.5845, lon: 9.2744 },
  "napoli|it": { lat: 40.8518, lon: 14.2681 },
  "naples|it": { lat: 40.8518, lon: 14.2681 },
  "novara|it": { lat: 45.4469, lon: 8.6222 },
  "olbia|it": { lat: 40.9236, lon: 9.4964 },
  "padova|it": { lat: 45.4064, lon: 11.8768 },
  "palermo|it": { lat: 38.1157, lon: 13.3615 },
  "parma|it": { lat: 44.8015, lon: 10.3279 },
  "perugia|it": { lat: 43.1107, lon: 12.3908 },
  "pesaro|it": { lat: 43.9125, lon: 12.9155 },
  "pescara|it": { lat: 42.4618, lon: 14.2161 },
  "pisa|it": { lat: 43.7228, lon: 10.4017 },
  "potenza|it": { lat: 40.6404, lon: 15.8056 },
  "reggio calabria|it": { lat: 38.1113, lon: 15.6473 },
  "reggio emilia|it": { lat: 44.6983, lon: 10.6312 },
  "rimini|it": { lat: 44.0678, lon: 12.5695 },
  "roma|it": { lat: 41.9028, lon: 12.4964 },
  "rome|it": { lat: 41.9028, lon: 12.4964 },
  "salerno|it": { lat: 40.6824, lon: 14.7681 },
  "sassari|it": { lat: 40.7259, lon: 8.5557 },
  "savona|it": { lat: 44.3091, lon: 8.4772 },
  "siena|it": { lat: 43.3188, lon: 11.3308 },
  "siracusa|it": { lat: 37.0755, lon: 15.2866 },
  "taranto|it": { lat: 40.4644, lon: 17.247 },
  "teramo|it": { lat: 42.6612, lon: 13.699 },
  "terni|it": { lat: 42.5636, lon: 12.6427 },
  "torino|it": { lat: 45.0703, lon: 7.6869 },
  "trento|it": { lat: 46.0748, lon: 11.1217 },
  "treviso|it": { lat: 45.6669, lon: 12.243 },
  "trieste|it": { lat: 45.6495, lon: 13.7768 },
  "turin|it": { lat: 45.0703, lon: 7.6869 },
  "udine|it": { lat: 46.0711, lon: 13.2346 },
  "venezia|it": { lat: 45.4408, lon: 12.3155 },
  "verona|it": { lat: 45.4384, lon: 10.9916 },
  "vicenza|it": { lat: 45.5455, lon: 11.5354 },
  "viterbo|it": { lat: 42.4207, lon: 12.1077 },
};

function normalizeCity(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .toLowerCase();
}

function cityNameOnly(value) {
  return normalizeCity(value).split(",")[0] || "";
}

function coordinateFor(city, country) {
  const normalizedCountry = String(country || "US").toUpperCase();
  const normalizedCity = normalizeCity(city);
  const shortCity = cityNameOnly(city);
  return (
    CITY_COORDINATES[`${normalizedCity}|${normalizedCountry.toLowerCase()}`] ||
    CITY_COORDINATES[`${shortCity}|${normalizedCountry.toLowerCase()}`] ||
    null
  );
}

export function buildProfileLocationPoints(profiles) {
  const grouped = new Map();
  let missing = 0;

  for (const profile of profiles) {
    const city = String(profile?.city || "").trim();
    if (!city) {
      missing += 1;
      continue;
    }

    const country = String(profile?.country || "US").toUpperCase();
    const coordinates = coordinateFor(city, country);
    if (!coordinates) {
      missing += 1;
      continue;
    }

    const label = city
      .replace(/\s*,\s*/g, ", ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
    const key = `${country}|${normalizeCity(city)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.profiles.push(profile);
    } else {
      grouped.set(key, {
        key,
        city: label,
        country,
        count: 1,
        profiles: [profile],
        ...coordinates,
      });
    }
  }

  const points = [...grouped.values()].sort((a, b) => b.count - a.count);
  return { points, missing };
}
