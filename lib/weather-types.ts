export interface GeoLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin4?: string;
  feature_code?: string;
  timezone?: string;
  population?: number;
  elevation?: number;
}

export interface CurrentWeather {
  time: string;
  interval?: number;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  rain: number;
  showers: number;
  snowfall: number;
  weather_code: number;
  cloud_cover: number;
  pressure_msl: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
}

export interface HourlyWeather {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  precipitation: number[];
  rain: number[];
  showers: number[];
  snowfall: number[];
  snow_depth: number[];
  weather_code: number[];
  pressure_msl: number[];
  surface_pressure: number[];
  cloud_cover: number[];
  cloud_cover_low: number[];
  cloud_cover_mid: number[];
  cloud_cover_high: number[];
  visibility: number[];
  evapotranspiration: number[];
  et0_fao_evapotranspiration: number[];
  vapour_pressure_deficit: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  uv_index: number[];
  uv_index_clear_sky: number[];
  is_day: number[];
  sunshine_duration: number[];
  wet_bulb_temperature_2m: number[];
  cape: number[];
  shortwave_radiation: number[];
  direct_radiation: number[];
  diffuse_radiation: number[];
  soil_temperature_0cm: number[];
  soil_moisture_0_to_1cm: number[];
}

export interface DailyWeather {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  sunrise: string[];
  sunset: string[];
  daylight_duration: number[];
  sunshine_duration: number[];
  uv_index_max: number[];
  precipitation_probability_max: number[];
  precipitation_sum: number[];
  rain_sum: number[];
  showers_sum: number[];
  snowfall_sum: number[];
  precipitation_hours: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
}

export interface WeatherResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  elevation: number;
  current_units: Record<string, string>;
  current: CurrentWeather;
  hourly_units: Record<string, string>;
  hourly: HourlyWeather;
  daily_units: Record<string, string>;
  daily: DailyWeather;
}

export interface CurrentAirQuality {
  time: string;
  interval?: number;
  us_aqi: number | null;
  european_aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  carbon_monoxide: number | null;
  nitrogen_dioxide: number | null;
  sulphur_dioxide: number | null;
  ozone: number | null;
  dust: number | null;
  uv_index: number | null;
}

export interface HourlyAirQuality {
  time: string[];
  us_aqi: (number | null)[];
  european_aqi: (number | null)[];
  pm2_5: (number | null)[];
  pm10: (number | null)[];
  carbon_monoxide: (number | null)[];
  nitrogen_dioxide: (number | null)[];
  sulphur_dioxide: (number | null)[];
  ozone: (number | null)[];
  dust: (number | null)[];
  uv_index: (number | null)[];
}

export interface AirQualityResponse {
  latitude: number;
  longitude: number;
  generationtime_ms: number;
  utc_offset_seconds: number;
  timezone: string;
  timezone_abbreviation: string;
  current_units: Record<string, string>;
  current: CurrentAirQuality;
  hourly_units: Record<string, string>;
  hourly: HourlyAirQuality;
}

export interface GeocodingResponse {
  results?: GeoLocation[];
  generationtime_ms?: number;
}

export interface OpenMeteoError {
  error?: boolean;
  reason?: string;
}
