import type {
  AirQualityResponse,
  GeoLocation,
  GeocodingResponse,
  WeatherResponse,
} from "./weather-types";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage} (HTTP ${response.status})`);
  }
  const data = (await response.json()) as T & { error?: boolean; reason?: string };
  if (data.error) throw new Error(data.reason || fallbackMessage);
  return data;
}

/**
 * Well-known historical/alternate names that can produce unrelated GeoNames
 * matches. Open-Meteo's geocoder is based on GeoNames and may return a false
 * positive for some exonyms (for example, "Bangalore" can return a small
 * locality in Pakistan while "Bengaluru" resolves to the Indian metro).
 * Search the modern canonical place instead of trusting that false positive.
 */
const PLACE_ALIASES: Record<string, { canonical: string; countryCode: string; qualifiers: string[] }> = {
  bangalore: { canonical: "Bengaluru", countryCode: "IN", qualifiers: ["india", "karnataka"] },
  bombay: { canonical: "Mumbai", countryCode: "IN", qualifiers: ["india", "maharashtra"] },
  madras: { canonical: "Chennai", countryCode: "IN", qualifiers: ["india", "tamil nadu"] },
  calcutta: { canonical: "Kolkata", countryCode: "IN", qualifiers: ["india", "west bengal"] },
  poona: { canonical: "Pune", countryCode: "IN", qualifiers: ["india", "maharashtra"] },
  mangalore: { canonical: "Mangaluru", countryCode: "IN", qualifiers: ["india", "karnataka"] },
  mysore: { canonical: "Mysuru", countryCode: "IN", qualifiers: ["india", "karnataka"] },
  trivandrum: { canonical: "Thiruvananthapuram", countryCode: "IN", qualifiers: ["india", "kerala"] },
  cochin: { canonical: "Kochi", countryCode: "IN", qualifiers: ["india", "kerala"] },
  baroda: { canonical: "Vadodara", countryCode: "IN", qualifiers: ["india", "gujarat"] },
  gurgaon: { canonical: "Gurugram", countryCode: "IN", qualifiers: ["india", "haryana"] },
  allahabad: { canonical: "Prayagraj", countryCode: "IN", qualifiers: ["india", "uttar pradesh"] },
  benares: { canonical: "Varanasi", countryCode: "IN", qualifiers: ["india", "uttar pradesh"] },
  peking: { canonical: "Beijing", countryCode: "CN", qualifiers: ["china"] },
  saigon: { canonical: "Ho Chi Minh City", countryCode: "VN", qualifiers: ["vietnam"] },
  rangoon: { canonical: "Yangon", countryCode: "MM", qualifiers: ["myanmar"] },
};

function locationSearchPlan(rawQuery: string): { name: string; countryCode?: string } {
  const cleaned = rawQuery.trim().replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ");
  const explicitCode = cleaned.match(/,\s*country:([a-z]{2})$/i);
  const withoutCode = explicitCode
    ? cleaned.slice(0, explicitCode.index).trim()
    : cleaned;
  const explicitCountryCode = explicitCode?.[1].toUpperCase();
  const commaIndex = withoutCode.indexOf(",");
  const baseName = (commaIndex >= 0 ? withoutCode.slice(0, commaIndex) : withoutCode).trim();
  const qualifier = commaIndex >= 0 ? withoutCode.slice(commaIndex + 1).trim() : "";
  const alias = PLACE_ALIASES[baseName.toLocaleLowerCase("en")];

  if (alias) {
    const qualifierKey = qualifier.toLocaleLowerCase("en");
    const qualifierMatchesAlias = !qualifier ||
      alias.qualifiers.includes(qualifierKey) ||
      explicitCountryCode === alias.countryCode;
    const explicitCodeMatchesAlias = !explicitCountryCode || explicitCountryCode === alias.countryCode;
    if (qualifierMatchesAlias && explicitCodeMatchesAlias) {
      return {
        name: qualifier ? `${alias.canonical}, ${qualifier}` : alias.canonical,
        countryCode: explicitCountryCode || alias.countryCode,
      };
    }
  }

  return {
    name: withoutCode,
    ...(explicitCountryCode ? { countryCode: explicitCountryCode } : {}),
  };
}

/**
 * Search locations globally. Always return a ranked set of suggestions for
 * the UI to display; the caller must ask the user to select a result, even if
 * the geocoder returns only one match. This prevents a low-quality but
 * non-empty geocoding result from silently becoming the active city.
 */
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<GeoLocation[]> {
  const plan = locationSearchPlan(query);
  if (plan.name.length < 2) return [];

  const makeParams = (countryCode?: string) => {
    const params = new URLSearchParams({
      name: plan.name,
      count: "100",
      language: "en",
      format: "json",
    });
    if (countryCode) params.set("countryCode", countryCode);
    return params;
  };

  const fetchMatches = async (countryCode?: string): Promise<GeoLocation[]> => {
    const params = makeParams(countryCode);
    const response = await fetch(`${GEOCODING_URL}?${params.toString()}`, {
      method: "GET",
      signal,
      cache: "no-store",
    });
    const data = await readJson<GeocodingResponse>(
      response,
      "The location service is temporarily unavailable. Please try again.",
    );
    return Array.isArray(data.results) ? data.results : [];
  };

  // Keep worldwide results, but also request an India-filtered result set for
  // unqualified searches. This is a supplemental query, not a country lock:
  // it makes sure an Indian city isn't omitted when a global name match is
  // dominated by a homonymous place elsewhere (e.g. Hyderabad in Pakistan).
  // Users can still select any country from the worldwide suggestions.
  const isExplicitlyQualified = plan.name.includes(",") || Boolean(plan.countryCode);
  const [worldwide, indiaMatches] = await Promise.all([
    fetchMatches(plan.countryCode),
    !isExplicitlyQualified && plan.countryCode !== "IN"
      ? fetchMatches("IN").catch(() => [])
      : Promise.resolve([]),
  ]);

  const unique = new Map<number, GeoLocation>();
  for (const item of [...worldwide, ...indiaMatches]) {
    if (
      Number.isFinite(item.latitude) &&
      Number.isFinite(item.longitude) &&
      item.name &&
      item.country
    ) {
      unique.set(item.id, item);
    }
  }

  const cityTerm = plan.name.split(",")[0].trim().toLocaleLowerCase("en");
  const featureRank: Record<string, number> = {
    PPLC: 0, PPLA: 1, PPLA2: 2, PPLA3: 3, PPLA4: 4, PPL: 5, PPLX: 8,
  };

  return [...unique.values()].sort((a, b) => {
    const aExact = a.name.trim().toLocaleLowerCase("en") === cityTerm ? 1 : 0;
    const bExact = b.name.trim().toLocaleLowerCase("en") === cityTerm ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    // When the user is searching without a country qualifier, put India
    // matches near the top as a helpful regional preference, but retain all
    // worldwide matches in the picker so international searches still work.
    const aIndia = a.country_code === "IN" ? 1 : 0;
    const bIndia = b.country_code === "IN" ? 1 : 0;
    if (aIndia !== bIndia) return bIndia - aIndia;
    const aFeature = featureRank[a.feature_code ?? ""] ?? 6;
    const bFeature = featureRank[b.feature_code ?? ""] ?? 6;
    if (aFeature !== bFeature) return aFeature - bFeature;
    return (b.population ?? 0) - (a.population ?? 0);
  }).slice(0, 30);
}

export async function fetchWeather(
  location: GeoLocation,
  signal?: AbortSignal,
): Promise<WeatherResponse> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "rain",
      "showers",
      "snowfall",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(","),
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "dew_point_2m",
      "apparent_temperature",
      "precipitation_probability",
      "precipitation",
      "rain",
      "showers",
      "snowfall",
      "snow_depth",
      "weather_code",
      "pressure_msl",
      "surface_pressure",
      "cloud_cover",
      "cloud_cover_low",
      "cloud_cover_mid",
      "cloud_cover_high",
      "visibility",
      "evapotranspiration",
      "et0_fao_evapotranspiration",
      "vapour_pressure_deficit",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
      "uv_index",
      "uv_index_clear_sky",
      "is_day",
      "sunshine_duration",
      "wet_bulb_temperature_2m",
      "cape",
      "shortwave_radiation",
      "direct_radiation",
      "diffuse_radiation",
      "soil_temperature_0cm",
      "soil_moisture_0_to_1cm",
    ].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "apparent_temperature_max",
      "apparent_temperature_min",
      "sunrise",
      "sunset",
      "daylight_duration",
      "sunshine_duration",
      "uv_index_max",
      "precipitation_probability_max",
      "precipitation_sum",
      "rain_sum",
      "showers_sum",
      "snowfall_sum",
      "precipitation_hours",
      "wind_speed_10m_max",
      "wind_gusts_10m_max",
      "wind_direction_10m_dominant",
    ].join(","),
    timezone: "auto",
    forecast_days: "7",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });

  const response = await fetch(`${FORECAST_URL}?${params.toString()}`, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  const data = await readJson<WeatherResponse>(response, "Weather data could not be retrieved. Please try again.");
  if (!data.current || !data.hourly?.time?.length || !data.daily?.time?.length) {
    throw new Error("The weather provider returned incomplete data. Please retry.");
  }

  return data;
}

export async function fetchAirQuality(
  location: GeoLocation,
  signal?: AbortSignal,
): Promise<AirQualityResponse> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: [
      "us_aqi",
      "european_aqi",
      "pm2_5",
      "pm10",
      "carbon_monoxide",
      "nitrogen_dioxide",
      "sulphur_dioxide",
      "ozone",
      "dust",
      "uv_index",
    ].join(","),
    hourly: [
      "us_aqi",
      "european_aqi",
      "pm2_5",
      "pm10",
      "carbon_monoxide",
      "nitrogen_dioxide",
      "sulphur_dioxide",
      "ozone",
      "dust",
      "uv_index",
    ].join(","),
    timezone: "auto",
    forecast_hours: "24",
  });

  const response = await fetch(`${AIR_QUALITY_URL}?${params.toString()}`, {
    method: "GET",
    signal,
    cache: "no-store",
  });

  const data = await readJson<AirQualityResponse>(response, "Air-quality information is temporarily unavailable.");
  if (!data.current || !data.hourly?.time?.length) {
    throw new Error("The air-quality service returned incomplete data.");
  }

  return data;
}
