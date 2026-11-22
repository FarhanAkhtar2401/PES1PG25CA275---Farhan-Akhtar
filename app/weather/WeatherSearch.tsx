"use client";

import {
  Activity,
  Cloud,
  Leaf,
  ShieldCheck,
  Thermometer,
  Waves,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Clock3,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  MapPin,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Sunrise,
  Sunset,
  Wind,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./weather.module.css";
import { fetchAirQuality, fetchWeather, searchLocations } from "@/lib/weather-api";
import { getUvLabel, getWeatherMeta, getWindDirection } from "@/lib/weather-codes";
import type { AirQualityResponse, GeoLocation, WeatherResponse } from "@/lib/weather-types";

function formatLocationLabel(location: GeoLocation): string {
  return [location.name, location.country].filter(Boolean).join(", ");
}

function round(value: number): number {
  return Math.round(value);
}

function getUsAqiInfo(value: number | null | undefined): {
  label: string;
  className: string;
  advice: string;
} {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return {
      label: "Unavailable",
      className: "aqiUnavailable",
      advice: "Air-quality data is not available for this location right now.",
    };
  }

  if (value <= 50) {
    return {
      label: "Good",
      className: "aqiGood",
      advice: "Air quality is generally satisfactory. Normal outdoor activities are usually fine.",
    };
  }

  if (value <= 100) {
    return {
      label: "Moderate",
      className: "aqiModerate",
      advice: "Air quality is acceptable. Unusually sensitive people may wish to limit prolonged heavy outdoor exertion.",
    };
  }

  if (value <= 150) {
    return {
      label: "Unhealthy for sensitive groups",
      className: "aqiSensitive",
      advice: "Sensitive groups should consider reducing prolonged or heavy outdoor exertion.",
    };
  }

  if (value <= 200) {
    return {
      label: "Unhealthy",
      className: "aqiUnhealthy",
      advice: "Everyone may begin to experience effects. Consider reducing prolonged outdoor exertion.",
    };
  }

  if (value <= 300) {
    return {
      label: "Very unhealthy",
      className: "aqiVeryUnhealthy",
      advice: "Health alert: reduce outdoor exposure, especially for prolonged or strenuous activity.",
    };
  }

  return {
    label: "Hazardous",
    className: "aqiHazardous",
    advice: "Health emergency category. Avoid prolonged outdoor exposure and follow local public-health guidance.",
  };
}

type RecommendationLevel = "alert" | "caution" | "tip";

type WeatherRecommendation = {
  key: string;
  category: string;
  level: RecommendationLevel;
  title: string;
  message: string;
  icon: LucideIcon;
};

/** Turn model weather values into practical, non-diagnostic everyday guidance. */
function buildWeatherRecommendations(
  weather: WeatherResponse,
  airQuality: AirQualityResponse["current"] | null,
): WeatherRecommendation[] {
  const current = weather.current;
  const hourIndex = getCurrentHourIndex(weather);

  const nextRainChance = Math.max(
    0,
    ...weather.hourly.precipitation_probability
      .slice(hourIndex, hourIndex + 4)
      .filter((value) => Number.isFinite(value)),
  );

  const currentUv = weather.hourly.uv_index[hourIndex] ?? 0;
  const visibility = weather.hourly.visibility[hourIndex] ?? Number.POSITIVE_INFINITY;
  const apparent = current.apparent_temperature;

  const recommendations: WeatherRecommendation[] = [];
  const add = (item: WeatherRecommendation) => recommendations.push(item);

  // Lead with the most actionable condition-specific guidance.
  if ([95, 96, 99].includes(current.weather_code)) {
    add({
      key: "thunderstorm",
      category: "SEVERE WEATHER",
      level: "alert",
      icon: Activity,
      title: "Thunderstorm conditions — move indoors",
      message:
        "Postpone outdoor activity. Shelter in a substantial building or enclosed vehicle, and stay away from open ground, isolated trees and water. Follow local weather alerts.",
    });
  } else if ([71, 73, 75, 77, 85, 86].includes(current.weather_code)) {
    add({
      key: "snow",
      category: "SNOW & ICE",
      level: "caution",
      icon: Thermometer,
      title: "Snow or icy patches may affect travel",
      message:
        "Wear warm layers and footwear with good grip. Allow extra travel time, check local road and transit updates, and take care on steps and untreated surfaces.",
    });
  } else if ([56, 57, 66, 67].includes(current.weather_code)) {
    add({
      key: "freezing-precipitation",
      category: "ICY PRECIPITATION",
      level: "alert",
      icon: Cloud,
      title: "Freezing precipitation — surfaces may be slippery",
      message:
        "Use extra caution on roads, bridges and walkways. Consider delaying non-essential travel until conditions improve and check local transport advisories.",
    });
  } else if ([45, 48].includes(current.weather_code) || visibility < 1000) {
    add({
      key: "fog",
      category: "LOW VISIBILITY",
      level: "caution",
      icon: Eye,
      title: "Fog or very low visibility",
      message:
        "If driving, slow down, use low-beam headlights and leave more distance between vehicles. Avoid unnecessary travel when visibility is especially poor.",
    });
  } else if (
    [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(current.weather_code) ||
    current.precipitation > 0.1 ||
    nextRainChance >= 55
  ) {
    add({
      key: "rain",
      category: "RAIN & SHOWERS",
      level: "caution",
      icon: Droplets,
      title: "Keep rain protection handy",
      message:
        "Carry an umbrella or rain jacket and choose shoes with a good grip. Allow extra time for travel, watch for slippery surfaces and avoid walking or driving through flooded areas.",
    });
  } else if (current.cloud_cover >= 75 || [2, 3].includes(current.weather_code)) {
    add({
      key: "clouds",
      category: "CLOUD COVER",
      level: "tip",
      icon: Cloud,
      title: "Mostly cloudy skies",
      message:
        "Sunshine may be limited and conditions can change. Keep a light layer handy and check the rain outlook before longer outdoor plans.",
    });
  } else if (current.is_day === 1) {
    add({
      key: "clear-day",
      category: "OUTDOOR CONDITIONS",
      level: "tip",
      icon: Sun,
      title: "A good window for outdoor plans",
      message:
        "Conditions are relatively clear. Keep water with you, check the UV guidance below and consider lighter clothing if the day feels warm.",
    });
  } else {
    add({
      key: "clear-night",
      category: "NIGHT CONDITIONS",
      level: "tip",
      icon: Moon,
      title: "Clear or partly clear night",
      message:
        "Visibility may still vary by route. Carry a light layer if temperatures are falling and use well-lit paths when walking after dark.",
    });
  }

  // UV protection advice.
  if (currentUv >= 11) {
    add({
      key: "uv-extreme",
      category: "UV PROTECTION",
      level: "alert",
      icon: Sun,
      title: "Extreme UV — minimise direct sun exposure",
      message:
        "Seek shade, especially around solar noon. Wear protective clothing, a wide-brimmed hat and sunglasses, and use broad-spectrum SPF 30+ sunscreen; reapply as directed.",
    });
  } else if (currentUv >= 8) {
    add({
      key: "uv-very-high",
      category: "UV PROTECTION",
      level: "alert",
      icon: Sun,
      title: "Very high UV — protect your skin",
      message:
        "Seek shade around midday, wear protective clothing and sunglasses, and apply broad-spectrum SPF 30+ sunscreen. Reapply as directed.",
    });
  } else if (currentUv >= 6) {
    add({
      key: "uv-high",
      category: "UV PROTECTION",
      level: "caution",
      icon: Sun,
      title: "High UV — sunscreen recommended",
      message:
        "Use broad-spectrum SPF 30+ sunscreen, wear sunglasses and consider shade during peak sunlight.",
    });
  } else if (currentUv >= 3) {
    add({
      key: "uv-moderate",
      category: "UV PROTECTION",
      level: "tip",
      icon: Sun,
      title: "Moderate UV — take sensible precautions",
      message:
        "For extended outdoor time, use sunscreen, sunglasses and protective clothing, especially during the brightest part of the day.",
    });
  }

  // Temperature advice.
  if (current.temperature_2m >= 36 || apparent >= 39) {
    add({
      key: "extreme-heat",
      category: "HEAT AWARENESS",
      level: "alert",
      icon: Thermometer,
      title: "Very hot conditions — pace outdoor activity",
      message:
        "Stay in shade or a cool indoor space when possible, drink water regularly and avoid strenuous activity during the hottest hours. Check on children, older adults and pets.",
    });
  } else if (current.temperature_2m >= 32 || apparent >= 35) {
    add({
      key: "heat",
      category: "HEAT AWARENESS",
      level: "caution",
      icon: Thermometer,
      title: "Warm conditions — stay hydrated",
      message:
        "Carry drinking water, choose breathable clothing and schedule strenuous outdoor activity for cooler morning or evening hours.",
    });
  } else if (current.temperature_2m <= 5 || apparent <= 2) {
    add({
      key: "very-cold",
      category: "COLD WEATHER",
      level: "caution",
      icon: Thermometer,
      title: "Very cold conditions — add warm layers",
      message:
        "Cover exposed skin, wear warm layers and suitable footwear, and take breaks somewhere warm during extended outdoor activity.",
    });
  } else if (current.temperature_2m <= 12) {
    add({
      key: "cool",
      category: "COOL WEATHER",
      level: "tip",
      icon: Thermometer,
      title: "A light extra layer may help",
      message:
        "Consider a jacket or warm layer, particularly early in the morning, after sunset or when spending time in the wind.",
    });
  }

  // Wind advice.
  if (current.wind_gusts_10m >= 55 || current.wind_speed_10m >= 40) {
    add({
      key: "strong-wind",
      category: "WIND AWARENESS",
      level: "alert",
      icon: Wind,
      title: "Strong winds or gusts",
      message:
        "Secure loose outdoor items, take care near trees and temporary structures, and use extra caution when cycling or driving high-sided vehicles.",
    });
  } else if (current.wind_speed_10m >= 25) {
    add({
      key: "breezy",
      category: "WIND AWARENESS",
      level: "tip",
      icon: Wind,
      title: "Breezy conditions",
      message:
        "A windproof outer layer may make time outdoors more comfortable. Be mindful of gusts in exposed areas.",
    });
  }

  // Humidity advice.
  if (current.relative_humidity_2m >= 80 && current.temperature_2m >= 28) {
    add({
      key: "humid-heat",
      category: "HUMIDITY & COMFORT",
      level: "caution",
      icon: Droplets,
      title: "Warm and humid — take regular breaks",
      message:
        "High humidity can make warmth feel more uncomfortable. Choose breathable clothing, drink water and pace physical activity.",
    });
  } else if (current.relative_humidity_2m <= 25) {
    add({
      key: "dry-air",
      category: "DRY AIR",
      level: "tip",
      icon: Droplets,
      title: "Dry air in the atmosphere",
      message:
        "Keep water nearby and consider moisturising exposed skin if it feels dry. Indoor air may feel especially dry in air-conditioned spaces.",
    });
  }

  // Air-quality advice.
  const usAqi = airQuality?.us_aqi;

  if (typeof usAqi === "number" && usAqi > 50) {
    const aqiInfo = getUsAqiInfo(usAqi);

    add({
      key: "air-quality",
      category: "AIR QUALITY · US AQI",
      level: usAqi > 150 ? "alert" : usAqi > 100 ? "caution" : "tip",
      icon: Leaf,
      title: `Air quality: ${aqiInfo.label}`,
      message: `${aqiInfo.advice} This is a model estimate on the US AQI scale; it is not India's CPCB AQI.`,
    });
  }

  // Put higher-priority precautions first while keeping the briefing concise.
  const priority: Record<RecommendationLevel, number> = {
    alert: 0,
    caution: 1,
    tip: 2,
  };

  return recommendations
    .sort((a, b) => priority[a.level] - priority[b.level])
    .slice(0, 6);
}

function numberOrDash(
  value: number | null | undefined,
  digits = 1,
): string {
  return typeof value !== "number" || !Number.isFinite(value)
    ? "—"
    : value.toFixed(digits);
}

function getTimeLabel(value: string): string {
  const time = value.split("T")[1] ?? "";
  const [hourText = "0", minuteText = "00"] = time.split(":");
  const hour = Number(hourText);

  if (!Number.isFinite(hour)) return "—";

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minuteText.slice(0, 2)} ${suffix}`;
}

function getShortTime(value: string): string {
  const [hourText = "0"] = (value.split("T")[1] ?? "").split(":");
  const hour = Number(hourText);

  if (!Number.isFinite(hour)) return "—";

  return `${hour % 12 || 12}${hour >= 12 ? "PM" : "AM"}`;
}

function getDayName(value: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";

  const date = new Date(`${value}T12:00:00Z`);

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function getDateLabel(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getLocalClock(timeZone: string | undefined, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
  } catch {
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

function getLocalDate(timeZone: string | undefined, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "UTC",
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(now);
  } catch {
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }
}

function getCurrentHourIndex(weather: WeatherResponse): number {
  const currentHour = weather.current.time.slice(0, 13);

  const exactIndex = weather.hourly.time.findIndex(
    (time) => time.slice(0, 13) === currentHour,
  );

  if (exactIndex >= 0) return exactIndex;

  const nextIndex = weather.hourly.time.findIndex(
    (time) => time >= weather.current.time,
  );

  return nextIndex >= 0 ? nextIndex : 0;
}

function getDaylightDuration(sunrise: string, sunset: string): string {
  const start = sunrise.split("T")[1] ?? "00:00";
  const end = sunset.split("T")[1] ?? "00:00";

  const [sh = "0", sm = "0"] = start.split(":");
  const [eh = "0", em = "0"] = end.split(":");

  const minutes = Math.max(
    0,
    Number(eh) * 60 + Number(em) - (Number(sh) * 60 + Number(sm)),
  );

  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function getProgress(
  now: Date,
  timeZone: string,
  sunrise: string,
  sunset: string,
): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(now)
      .split(":");

    const current = Number(parts[0]) * 60 + Number(parts[1]);

    const [startH = "0", startM = "0"] = (
      sunrise.split("T")[1] ?? "00:00"
    ).split(":");

    const [endH = "0", endM = "0"] = (
      sunset.split("T")[1] ?? "00:00"
    ).split(":");

    const start = Number(startH) * 60 + Number(startM);
    const end = Number(endH) * 60 + Number(endM);

    if (current <= start) return 0;
    if (current >= end) return 100;

    return Math.round(((current - start) / (end - start)) * 100);
  } catch {
    return 50;
  }
}

function WeatherGlyph({
  code,
  isDay,
  className = "",
}: {
  code: number;
  isDay: boolean;
  className?: string;
}) {
  const meta = getWeatherMeta(code, isDay);
  const Icon = meta.Icon;

  return <Icon className={className} aria-hidden="true" />;
}

function SectionHeading({
  eyebrow,
  title,
  note,
}: {
  eyebrow: string;
  title: string;
  note?: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2>{title}</h2>
      </div>

      {note ? <span className={styles.sectionNote}>{note}</span> : null}
    </div>
  );
}

// A verified city-centre fallback for the first visit. All subsequent searches
// are global and use Open-Meteo's geocoding results.
const DEFAULT_LOCATION: GeoLocation = {
  id: -1,
  name: "Bengaluru",
  latitude: 12.97194,
  longitude: 77.59369,
  country: "India",
  country_code: "IN",
  admin1: "Karnataka",
  timezone: "Asia/Kolkata",
};

export type WeatherView =
  | "overview"
  | "air-quality"
  | "wind"
  | "precipitation"
  | "forecast"
  | "atmosphere";

const pageCopy: Record<
  WeatherView,
  { kicker: string; title: string; accent: string; description: string }
> = {
  overview: {
    kicker: "YOUR WINDOW TO THE ATMOSPHERE",
    title: "Weather,",
    accent: " reimagined.",
    description: "A clear snapshot of the conditions shaping your day.",
  },
  "air-quality": {
    kicker: "BREATHING CONDITIONS",
    title: "Air quality,",
    accent: " decoded.",
    description: "Explore AQI estimates, pollutant concentrations and the air-quality outlook.",
  },
  wind: {
    kicker: "ATMOSPHERIC MOVEMENT",
    title: "Wind,",
    accent: " in focus.",
    description: "Understand wind speed, direction, gusts and pressure patterns.",
  },
  precipitation: {
    kicker: "WATER IN THE ATMOSPHERE",
    title: "Precipitation,",
    accent: " explained.",
    description: "Track rain, showers, snowfall and the probability of wet weather.",
  },
  forecast: {
    kicker: "LOOK AHEAD WITH CONFIDENCE",
    title: "Forecasts,",
    accent: " in detail.",
    description: "Explore the next 24 hours and the seven-day outlook for this location.",
  },
  atmosphere: {
    kicker: "THE SCIENCE ABOVE AND BELOW",
    title: "Atmospheric,",
    accent: " details.",
    description: "Dive into UV, cloud layers, thermal indicators, solar energy and surface conditions.",
  },
};

export default function WeatherSearch({
  view = "overview",
}: {
  view?: WeatherView;
}) {
  const [query, setQuery] = useState("Bengaluru, India");
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualityResponse | null>(null);
  const [locationChoices, setLocationChoices] = useState<GeoLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchBusy, setSearchBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date>(() => new Date());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const chooseLocation = useCallback(async (selected: GeoLocation) => {
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setSearchBusy(false);
    setError("");
    setLocationChoices([]);
    setQuery(formatLocationLabel(selected));

    try {
      const [data, airData] = await Promise.all([
        fetchWeather(selected, controller.signal),
        fetchAirQuality(selected, controller.signal).catch(() => null),
      ]);

      if (controller.signal.aborted) return;

      setLocation(selected);
      setWeather(data);
      setAirQuality(airData);
      setLastUpdated(new Date());

      try {
        window.localStorage.setItem(
          "atmosphere-location-v2",
          JSON.stringify(selected),
        );
      } catch {
        /* storage may be unavailable */
      }
    } catch (caught) {
      if (controller.signal.aborted) return;

      const message =
        caught instanceof Error
          ? caught.message
          : "Something went wrong while loading weather data.";

      setError(message);
    } finally {
      if (controllerRef.current === controller) setLoading(false);
    }
  }, []);

  const runSearch = useCallback(async (rawQuery: string) => {
    const cleanQuery = rawQuery.trim();

    if (!cleanQuery) {
      setError("Enter a city or location to search.");
      setLocationChoices([]);
      inputRef.current?.focus();
      return;
    }

    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setSearchBusy(true);
    setError("");
    setLocationChoices([]);

    try {
      const results = await searchLocations(cleanQuery, controller.signal);

      if (controller.signal.aborted) return;

      if (!results.length) {
        setError(
          `We couldn't find “${cleanQuery}”. Check the spelling or include a country, such as “Bengaluru, India” or “Paris, France”.`,
        );
        return;
      }

      // Always show a location picker, even for a single exact match. The
      // geocoder can return a plausible but geographically incorrect result
      // (for example Bangalore Town, Pakistan for the alias "Bangalore").
      // The user confirms the country/region before any weather is fetched.
      setLocationChoices(results);
      setSearchBusy(false);
      setLoading(false);
      return;
    } catch (caught) {
      if (controller.signal.aborted) return;

      const message =
        caught instanceof Error
          ? caught.message
          : "Unable to retrieve weather information. Please try again.";

      setError(message);
    } finally {
      if (controllerRef.current === controller) {
        setLoading(false);
        setSearchBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("atmosphere-theme");

      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);

    try {
      window.localStorage.setItem("atmosphere-theme", nextTheme);
    } catch {
      /* storage may be unavailable */
    }
  };

  useEffect(() => {
    let savedLocation: GeoLocation | null = null;

    try {
      const raw = window.localStorage.getItem("atmosphere-location-v2");

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GeoLocation>;

        if (
          typeof parsed.name === "string" &&
          typeof parsed.latitude === "number" &&
          typeof parsed.longitude === "number" &&
          typeof parsed.country === "string"
        ) {
          savedLocation = parsed as GeoLocation;
        }
      }
    } catch {
      savedLocation = null;
    }

    const staleLegacyResult = Boolean(
      savedLocation &&
        /^(bangalore town)$/i.test(savedLocation.name.trim()) &&
        savedLocation.country.toLocaleLowerCase("en") !== "india",
    );

    if (staleLegacyResult) {
      try {
        window.localStorage.removeItem("atmosphere-location-v2");
      } catch {
        /* storage may be unavailable */
      }

      savedLocation = null;
    }

    if (savedLocation) {
      void chooseLocation(savedLocation);
    } else {
      void chooseLocation(DEFAULT_LOCATION);
    }

    const clock = window.setInterval(() => setNow(new Date()), 60_000);

    return () => {
      window.clearInterval(clock);
      controllerRef.current?.abort();
    };
  }, [chooseLocation]);

  const derived = useMemo(() => {
    if (!weather) return null;

    const currentHourIndex = getCurrentHourIndex(weather);

    const hourlyItems = weather.hourly.time
      .slice(currentHourIndex, currentHourIndex + 24)
      .map((time, offset) => {
        const index = currentHourIndex + offset;

        return {
          time,
          temperature: weather.hourly.temperature_2m[index],
          code: weather.hourly.weather_code[index],
          probability: weather.hourly.precipitation_probability[index],
          humidity: weather.hourly.relative_humidity_2m[index],
          dewPoint: weather.hourly.dew_point_2m[index],
          feelsLike: weather.hourly.apparent_temperature[index],
          wind: weather.hourly.wind_speed_10m[index],
          gust: weather.hourly.wind_gusts_10m[index],
          uv: weather.hourly.uv_index[index],
          visibility: weather.hourly.visibility[index],
          cloud: weather.hourly.cloud_cover[index],
          cloudLow: weather.hourly.cloud_cover_low[index],
          cloudMid: weather.hourly.cloud_cover_mid[index],
          cloudHigh: weather.hourly.cloud_cover_high[index],
          pressure: weather.hourly.pressure_msl[index],
          surfacePressure: weather.hourly.surface_pressure[index],
          windDirection: weather.hourly.wind_direction_10m[index],
          rain: weather.hourly.rain[index],
          showers: weather.hourly.showers[index],
          snowfall: weather.hourly.snowfall[index],
          snowDepth: weather.hourly.snow_depth[index],
          vapourDeficit: weather.hourly.vapour_pressure_deficit[index],
          solar: weather.hourly.shortwave_radiation[index],
          isDay: weather.hourly.is_day[index] === 1,
        };
      });

    const dayIndex = Math.max(
      0,
      weather.daily.time.findIndex(
        (date) => date === weather.current.time.slice(0, 10),
      ),
    );

    const currentUv = weather.hourly.uv_index[currentHourIndex] ?? 0;
    const visibility = weather.hourly.visibility[currentHourIndex] ?? 0;
    const nextHourRain =
      weather.hourly.precipitation_probability[currentHourIndex + 1] ?? 0;

    const dailyMin = Math.min(...weather.daily.temperature_2m_min);
    const dailyMax = Math.max(...weather.daily.temperature_2m_max);
    const span = Math.max(1, dailyMax - dailyMin);

    const insights = [
      {
        icon: Droplets,
        title:
          weather.current.relative_humidity_2m >= 70
            ? "Humid atmosphere"
            : weather.current.relative_humidity_2m <= 30
              ? "Dry atmosphere"
              : "Balanced humidity",
        text:
          weather.current.relative_humidity_2m >= 70
            ? `Humidity is ${round(weather.current.relative_humidity_2m)}%, so the air may feel noticeably moist.`
            : weather.current.relative_humidity_2m <= 30
              ? `Humidity is ${round(weather.current.relative_humidity_2m)}%. Consider staying hydrated.`
              : `Humidity is ${round(weather.current.relative_humidity_2m)}%, within a moderate range.`,
      },
      {
        icon: Wind,
        title:
          weather.current.wind_speed_10m >= 30
            ? "Breezy conditions"
            : weather.current.wind_speed_10m < 10
              ? "Light winds"
              : "Steady wind",
        text: `Wind is moving at ${round(weather.current.wind_speed_10m)} km/h from the ${getWindDirection(weather.current.wind_direction_10m)}.`,
      },
      {
        icon: CloudSun,
        title:
          nextHourRain >= 60
            ? "Rain may be approaching"
            : nextHourRain >= 30
              ? "Keep an eye on the sky"
              : "Low near-term rain chance",
        text: `The next available hourly forecast shows a ${round(nextHourRain)}% chance of precipitation.`,
      },
      {
        icon: Activity,
        title:
          currentUv >= 6
            ? "Elevated UV exposure"
            : currentUv >= 3
              ? "Moderate UV exposure"
              : "Low UV exposure",
        text: `The current hourly UV index is ${round(currentUv)} (${getUvLabel(currentUv).toLowerCase()}).`,
      },
    ];

    return {
      hourlyItems,
      dayIndex,
      currentUv,
      clearSkyUv: weather.hourly.uv_index_clear_sky[currentHourIndex],
      sunshineSeconds: weather.hourly.sunshine_duration[currentHourIndex],
      visibilityKm: visibility / 1000,
      dewPoint: weather.hourly.dew_point_2m[currentHourIndex],
      wetBulb: weather.hourly.wet_bulb_temperature_2m[currentHourIndex],
      surfacePressure: weather.hourly.surface_pressure[currentHourIndex],
      cloudLow: weather.hourly.cloud_cover_low[currentHourIndex],
      cloudMid: weather.hourly.cloud_cover_mid[currentHourIndex],
      cloudHigh: weather.hourly.cloud_cover_high[currentHourIndex],
      evapotranspiration: weather.hourly.evapotranspiration[currentHourIndex],
      referenceEt: weather.hourly.et0_fao_evapotranspiration[currentHourIndex],
      vapourDeficit: weather.hourly.vapour_pressure_deficit[currentHourIndex],
      solar: weather.hourly.shortwave_radiation[currentHourIndex],
      directSolar: weather.hourly.direct_radiation[currentHourIndex],
      diffuseSolar: weather.hourly.diffuse_radiation[currentHourIndex],
      soilTemperature: weather.hourly.soil_temperature_0cm[currentHourIndex],
      soilMoisture: weather.hourly.soil_moisture_0_to_1cm[currentHourIndex],
      wetBulbCape: weather.hourly.cape[currentHourIndex],
      snowDepth: weather.hourly.snow_depth[currentHourIndex],
      rain: weather.hourly.rain[currentHourIndex],
      showers: weather.hourly.showers[currentHourIndex],
      snowfall: weather.hourly.snowfall[currentHourIndex],
      cloudCover: weather.hourly.cloud_cover[currentHourIndex],
      currentHourIndex,
      dailyMin,
      dailyMax,
      span,
      insights,
    };
  }, [weather]);

  const airCurrent = airQuality?.current ?? null;

  const airHourIndex =
    airQuality && weather
      ? Math.max(
          0,
          airQuality.hourly.time.findIndex(
            (time) => time.slice(0, 13) === weather.current.time.slice(0, 13),
          ),
        )
      : 0;

  const aqiInfo = getUsAqiInfo(airCurrent?.us_aqi);

  const aqiHourlyItems = airQuality
    ? airQuality.hourly.time
        .slice(airHourIndex, airHourIndex + 24)
        .map((time, offset) => {
          const index = airHourIndex + offset;

          return {
            time,
            aqi: airQuality.hourly.us_aqi[index],
            pm25: airQuality.hourly.pm2_5[index],
          };
        })
    : [];

  const extendedMetrics =
    weather && derived
      ? [
          {
            label: "Dew point",
            value: `${numberOrDash(derived.dewPoint)} °C`,
            note: "Moisture-related comfort indicator",
            icon: Thermometer,
          },
          {
            label: "Wet-bulb temperature",
            value: `${numberOrDash(derived.wetBulb)} °C`,
            note: "Combined heat and humidity indicator",
            icon: Thermometer,
          },
          {
            label: "Surface pressure",
            value: `${numberOrDash(derived.surfacePressure, 0)} hPa`,
            note: "Pressure at model surface elevation",
            icon: Gauge,
          },
          {
            label: "Low cloud cover",
            value: `${numberOrDash(derived.cloudLow, 0)}%`,
            note: "Lowest cloud layer",
            icon: Cloud,
          },
          {
            label: "Mid cloud cover",
            value: `${numberOrDash(derived.cloudMid, 0)}%`,
            note: "Middle cloud layer",
            icon: Cloud,
          },
          {
            label: "High cloud cover",
            value: `${numberOrDash(derived.cloudHigh, 0)}%`,
            note: "Upper cloud layer",
            icon: Cloud,
          },
          {
            label: "Rain",
            value: `${numberOrDash(derived.rain)} mm`,
            note: "Hourly rain amount",
            icon: Cloud,
          },
          {
            label: "Showers",
            value: `${numberOrDash(derived.showers)} mm`,
            note: "Hourly shower amount",
            icon: Cloud,
          },
          {
            label: "Snowfall",
            value: `${numberOrDash(derived.snowfall)} cm`,
            note: "Hourly snowfall depth",
            icon: Cloud,
          },
          {
            label: "Snow depth",
            value: `${numberOrDash(derived.snowDepth)} m`,
            note: "Modelled snow on the ground",
            icon: Cloud,
          },
          {
            label: "Evapotranspiration",
            value: `${numberOrDash(derived.evapotranspiration)} mm`,
            note: "Hourly land and plant water loss",
            icon: Leaf,
          },
          {
            label: "Reference ET₀",
            value: `${numberOrDash(derived.referenceEt)} mm`,
            note: "Reference crop evapotranspiration",
            icon: Leaf,
          },
          {
            label: "Vapour pressure deficit",
            value: `${numberOrDash(derived.vapourDeficit, 2)} kPa`,
            note: "Atmospheric drying demand",
            icon: Waves,
          },
          {
            label: "Solar radiation",
            value: `${numberOrDash(derived.solar, 0)} W/m²`,
            note: "Incoming shortwave radiation",
            icon: Sun,
          },
          {
            label: "Direct radiation",
            value: `${numberOrDash(derived.directSolar, 0)} W/m²`,
            note: "Direct-beam solar energy",
            icon: Sun,
          },
          {
            label: "Diffuse radiation",
            value: `${numberOrDash(derived.diffuseSolar, 0)} W/m²`,
            note: "Scattered solar energy",
            icon: Sun,
          },
          {
            label: "Soil temperature",
            value: `${numberOrDash(derived.soilTemperature)} °C`,
            note: "Near-surface soil temperature",
            icon: Thermometer,
          },
          {
            label: "Soil moisture",
            value: `${numberOrDash(derived.soilMoisture, 3)} m³/m³`,
            note: "Top 1 cm soil moisture estimate",
            icon: Leaf,
          },
          {
            label: "Clear-sky UV",
            value: numberOrDash(derived.clearSkyUv),
            note: "UV estimate assuming clear skies",
            icon: Sun,
          },
          {
            label: "Sunshine this hour",
            value: `${numberOrDash((derived.sunshineSeconds ?? 0) / 60, 0)} min`,
            note: "Modelled sunshine duration in this hour",
            icon: Sun,
          },
          {
            label: "CAPE",
            value: `${numberOrDash(derived.wetBulbCape, 0)} J/kg`,
            note: "Atmospheric convective energy indicator",
            icon: Activity,
          },
        ]
      : [];

  const weatherMeta = weather
    ? getWeatherMeta(weather.current.weather_code, weather.current.is_day === 1)
    : null;

  const sunrise = weather && derived ? weather.daily.sunrise[derived.dayIndex] : "";
  const sunset = weather && derived ? weather.daily.sunset[derived.dayIndex] : "";
  const daylight = sunrise && sunset ? getDaylightDuration(sunrise, sunset) : "—";

  const daylightProgress =
    sunrise && sunset && weather
      ? getProgress(now, weather.timezone, sunrise, sunset)
      : 0;

  const localClock = weather ? getLocalClock(weather.timezone, now) : "--:--";
  const localDate = weather ? getLocalDate(weather.timezone, now) : "Loading local time";

  const localHour = weather
    ? Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: weather.timezone,
          hour: "2-digit",
          hourCycle: "h23",
        }).format(now),
      )
    : now.getHours();

  const dayPhase =
    localHour >= 5 && localHour < 10
      ? "dawn"
      : localHour >= 10 && localHour < 16
        ? "day"
        : localHour >= 16 && localHour < 19
          ? "dusk"
          : "night";

  const weatherCode = weather?.current.weather_code ?? 0;

  const scene =
    weatherCode >= 95
      ? "storm"
      : [71, 73, 75, 77, 85, 86].includes(weatherCode)
        ? "snow"
        : [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)
          ? "rain"
          : [45, 48].includes(weatherCode)
            ? "fog"
            : [2, 3].includes(weatherCode)
              ? "cloudy"
              : "clear";

  const weatherRecommendations =
    weather && derived
      ? buildWeatherRecommendations(weather, airCurrent)
      : [];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runSearch(query);
  };

  const citySubline = location
    ? [location.admin1, location.country].filter(Boolean).join(", ")
    : "Find a location";

  return (
    <main
      className={styles.pageShell}
      data-theme={theme}
      data-scene={scene}
      data-phase={dayPhase}
    >
      <div className={styles.ambientGlow} aria-hidden="true" />

      <div className={styles.container}>
        <header className={styles.header}>
          <a className={styles.brand} href="/weather" aria-label="ATMOSPHERE home">
            <span className={styles.brandMark}>
              <CloudSun size={22} strokeWidth={1.8} />
            </span>

            <span className={styles.brandCopy}>
              <strong>ATMOSPHERE</strong>
              <small>WEATHER INTELLIGENCE</small>
            </span>
          </a>

          <nav className={styles.nav} aria-label="Weather sections">
            <Link
              className={view === "overview" ? styles.navActive : ""}
              href="/weather"
            >
              Overview
            </Link>

            <Link
              className={view === "air-quality" ? styles.navActive : ""}
              href="/weather/air-quality"
            >
              Air quality
            </Link>

            <Link
              className={view === "wind" ? styles.navActive : ""}
              href="/weather/wind"
            >
              Wind
            </Link>

            <Link
              className={view === "precipitation" ? styles.navActive : ""}
              href="/weather/precipitation"
            >
              Precipitation
            </Link>

            <Link
              className={view === "forecast" ? styles.navActive : ""}
              href="/weather/forecast"
            >
              Forecast
            </Link>

            <Link
              className={view === "atmosphere" ? styles.navActive : ""}
              href="/weather/atmosphere"
            >
              Atmosphere
            </Link>
          </nav>

          <div className={styles.headerMeta}>
            <span className={styles.liveDot} />
            <span className={styles.headerMetaText}>MODEL-BASED WEATHER</span>

            <button
              className={styles.themeToggle}
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              <span>{theme === "dark" ? "LIGHT" : "DARK"}</span>
            </button>
          </div>
        </header>

        <section className={styles.introRow}>
          <div>
            <p className={styles.kicker}>{pageCopy[view].kicker}</p>
            <h1>
              {pageCopy[view].title}
              <span>{pageCopy[view].accent}</span>
            </h1>
            <p className={styles.introText}>{pageCopy[view].description}</p>
          </div>

          <div className={styles.localTime}>
            <span className={styles.localTimeLabel}>
              <Clock3 size={13} /> LOCAL TIME
            </span>
            <strong>{localClock}</strong>
            <span>{localDate}</span>
          </div>
        </section>

        <section className={styles.searchSection} aria-label="Search for a city">
          <form className={styles.searchForm} onSubmit={handleSubmit}>
            <div className={styles.searchInputWrap}>
              <Search size={18} aria-hidden="true" />

              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search city, region or country (e.g. Paris, France)..."
                aria-label="Search city, region or country"
                autoComplete="off"
              />

              {query ? (
                <button
                  className={styles.clearSearch}
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>

            <button
              className={styles.searchButton}
              type="submit"
              disabled={loading && searchBusy}
            >
              {searchBusy ? (
                <RefreshCw className={styles.spinning} size={16} />
              ) : (
                <Search size={16} />
              )}
              <span>{searchBusy ? "Searching" : "Explore weather"}</span>
              <ArrowUpRight size={16} />
            </button>
          </form>

          {locationChoices.length > 0 ? (
            <div
              className={styles.locationChoices}
              role="listbox"
              aria-label="Choose a matching location"
            >
              <div className={styles.choiceHeading}>
                SELECT A LOCATION
                <span>{locationChoices.length} MATCHES</span>
              </div>

              <p className={styles.choiceHint}>
                Choose the correct match before loading weather. Suggestions include worldwide matches and, for unqualified searches, additional India matches. Every result shows its region, country and time zone. Narrow results with “City, Country” (for example, “Bengaluru, India”, “Paris, France” or “Tokyo, Japan”), or use “City, country:ISO” for an exact country filter.
              </p>

              {locationChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={styles.locationChoice}
                  onClick={() => void chooseLocation(choice)}
                >
                  <span className={styles.choicePin}>
                    <MapPin size={15} />
                  </span>

                  <span className={styles.choiceText}>
                    <strong>{choice.name}</strong>

                    <small>
                      {[choice.admin1, choice.admin2, choice.country]
                        .filter(Boolean)
                        .join(", ")}
                    </small>

                    <small>
                      {choice.country_code
                        ? `Country code: ${choice.country_code}`
                        : "Country not provided"}
                      {choice.feature_code ? ` · ${choice.feature_code}` : ""}
                    </small>

                    {choice.timezone ? (
                      <small>
                        {choice.timezone}
                        {typeof choice.population === "number" && choice.population > 0
                          ? ` · Population ${choice.population.toLocaleString("en-US")}`
                          : ""}
                      </small>
                    ) : null}
                  </span>

                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className={styles.errorBanner} role="alert">
              <span>
                <Activity size={16} />
              </span>
              <p>{error}</p>
              <button
                type="button"
                onClick={() =>
                  void runSearch(query || location?.name || "Bengaluru")
                }
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : null}
        </section>

        {!weather && loading ? (
          <div className={styles.initialLoading} aria-live="polite">
            <div className={styles.loadingOrb}>
              <CloudSun size={28} />
            </div>
            <p>
              Reading the atmosphere
              <span className={styles.loadingDots}>...</span>
            </p>
            <span>Connecting to Open-Meteo weather services</span>
          </div>
        ) : null}

        {weather && location && derived ? (
          <>
            {view === "overview" ? (
              <>
                <section className={styles.heroGrid} aria-label="Current weather">
                  <div
                    className={`${styles.heroCard} ${
                      weather.current.is_day === 1
                        ? styles.heroDay
                        : styles.heroNight
                    } ${
                      styles[
                        `scene${scene.charAt(0).toUpperCase()}${scene.slice(1)}`
                      ]
                    } ${
                      styles[
                        `phase${dayPhase.charAt(0).toUpperCase()}${dayPhase.slice(1)}`
                      ]
                    }`}
                  >
                    <div className={styles.heroAtmosphere} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>

                    <div className={styles.heroTopline}>
                      <div className={styles.placeBlock}>
                        <span className={styles.placeLabel}>
                          <MapPin size={13} /> CURRENT LOCATION
                        </span>

                        <h2>{location.name}</h2>
                        <p>{citySubline}</p>
                      </div>

                      <span className={styles.dataBadge}>
                        <span />
                        {loading ? "UPDATING" : "LATEST MODEL"}
                      </span>
                    </div>

                    <div className={styles.heroMain}>
                      <div className={styles.temperatureBlock}>
                        <div className={styles.temperatureValue}>
                          {round(weather.current.temperature_2m)}
                          <span>°</span>
                        </div>

                        <p className={styles.conditionText}>{weatherMeta?.label}</p>

                        <p className={styles.feelsLike}>
                          Feels like{" "}
                          <strong>
                            {round(weather.current.apparent_temperature)}°C
                          </strong>
                        </p>
                      </div>

                      <div
                        className={styles.heroWeatherArt}
                        aria-label={weatherMeta?.label}
                      >
                        <div className={styles.artHalo} />

                        <WeatherGlyph
                          code={weather.current.weather_code}
                          isDay={weather.current.is_day === 1}
                          className={styles.heroWeatherIcon}
                        />

                        <span className={styles.artOrbit} />
                      </div>
                    </div>

                    <div className={styles.heroBottom}>
                      <div>
                        <span>CONDITION</span>
                        <strong>{weatherMeta?.description}</strong>
                      </div>

                      <div>
                        <span>WIND</span>
                        <strong>
                          {round(weather.current.wind_speed_10m)} km/h{" "}
                          <small>
                            {getWindDirection(weather.current.wind_direction_10m)}
                          </small>
                        </strong>
                      </div>

                      <div>
                        <span>DATA TIMESTAMP</span>
                        <strong>{getTimeLabel(weather.current.time)}</strong>
                      </div>
                    </div>

                    {loading ? (
                      <div className={styles.heroUpdating}>
                        <RefreshCw size={13} className={styles.spinning} />
                        Updating conditions…
                      </div>
                    ) : null}
                  </div>

                  <aside className={styles.todayPanel}>
                    <div className={styles.panelHeading}>
                      <div>
                        <span className={styles.eyebrow}>AT A GLANCE</span>
                        <h3>Today&apos;s outlook</h3>
                      </div>
                      <CalendarDays size={18} />
                    </div>

                    <div className={styles.highLow}>
                      <div className={styles.highLowItem}>
                        <span>
                          <ArrowUp size={14} /> HIGH
                        </span>
                        <strong>
                          {round(weather.daily.temperature_2m_max[derived.dayIndex])}°
                        </strong>
                      </div>

                      <div className={styles.highLowDivider} />

                      <div className={styles.highLowItem}>
                        <span>
                          <ArrowDown size={14} /> LOW
                        </span>
                        <strong>
                          {round(weather.daily.temperature_2m_min[derived.dayIndex])}°
                        </strong>
                      </div>
                    </div>

                    <div className={styles.panelDivider} />

                    <div className={styles.todayMetric}>
                      <span className={styles.metricIcon}>
                        <Droplets size={17} />
                      </span>
                      <div>
                        <small>RAIN CHANCE</small>
                        <strong>
                          {round(
                            weather.daily.precipitation_probability_max[
                              derived.dayIndex
                            ] ?? 0,
                          )}
                          %
                        </strong>
                      </div>
                      <span className={styles.metricSub}>Today</span>
                    </div>

                    <div className={styles.todayMetric}>
                      <span className={styles.metricIcon}>
                        <Sunrise size={17} />
                      </span>
                      <div>
                        <small>SUNRISE</small>
                        <strong>{getTimeLabel(sunrise)}</strong>
                      </div>
                      <span className={styles.metricSub}>Local</span>
                    </div>

                    <div className={styles.todayMetric}>
                      <span className={styles.metricIcon}>
                        <Sunset size={17} />
                      </span>
                      <div>
                        <small>SUNSET</small>
                        <strong>{getTimeLabel(sunset)}</strong>
                      </div>
                      <span className={styles.metricSub}>Local</span>
                    </div>

                    <div className={styles.panelFooter}>
                      <span className={styles.panelFooterDot} />
                      Updated{" "}
                      {lastUpdated
                        ? lastUpdated.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "just now"}
                    </div>
                  </aside>
                </section>

                {weatherRecommendations.length > 0 ? (
                  <section
                    className={styles.guidanceSection}
                    aria-label="Weather precautions and suggestions"
                    aria-live="polite"
                  >
                    <SectionHeading
                      eyebrow="YOUR WEATHER BRIEFING"
                      title="What to do in this weather"
                      note="Practical suggestions based on current conditions"
                    />

                    <div className={styles.guidanceGrid}>
                      {weatherRecommendations.map((recommendation) => {
                        const Icon = recommendation.icon;

                        const levelLabel =
                          recommendation.level === "alert"
                            ? "TAKE CARE"
                            : recommendation.level === "caution"
                              ? "BE PREPARED"
                              : "GOOD TO KNOW";

                        return (
                          <article
                            className={styles.guidanceCard}
                            data-level={recommendation.level}
                            key={recommendation.key}
                          >
                            <span className={styles.guidanceIcon}>
                              <Icon size={20} />
                            </span>

                            <div className={styles.guidanceCopy}>
                              <div className={styles.guidanceMeta}>
                                <span>{recommendation.category}</span>
                                <strong>{levelLabel}</strong>
                              </div>

                              <h3>{recommendation.title}</h3>
                              <p>{recommendation.message}</p>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <p className={styles.guidanceFootnote}>
                      Suggestions are generated from model-based weather estimates and are general guidance, not official warnings. Follow local authority alerts during hazardous conditions.
                    </p>
                  </section>
                ) : null}

                <section
                  className={styles.statsSection}
                  aria-label="Weather details"
                >
                  <SectionHeading
                    eyebrow="ATMOSPHERIC METRICS"
                    title="The details that matter"
                    note="Current and hourly model-derived measurements"
                  />

                  <div className={styles.statsGrid}>
                    <article className={styles.statCard}>
                      <div className={styles.statTop}>
                        <span className={styles.statIcon}>
                          <Droplets size={18} />
                        </span>
                        <span className={styles.statTag}>MOISTURE</span>
                      </div>

                      <p className={styles.statValue}>
                        {round(weather.current.relative_humidity_2m)}
                        <small>%</small>
                      </p>

                      <h3>Humidity</h3>

                      <div className={styles.meter}>
                        <span
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, weather.current.relative_humidity_2m),
                            )}%`,
                          }}
                        />
                      </div>

                      <p className={styles.statFoot}>
                        {weather.current.relative_humidity_2m >= 70
                          ? "Moist air"
                          : weather.current.relative_humidity_2m <= 30
                            ? "Dry air"
                            : "Comfortable range"}
                      </p>
                    </article>

                    <article className={styles.statCard}>
                      <div className={styles.statTop}>
                        <span className={styles.statIcon}>
                          <Wind size={18} />
                        </span>
                        <span className={styles.statTag}>AIR MOVEMENT</span>
                      </div>

                      <p className={styles.statValue}>
                        {round(weather.current.wind_speed_10m)}
                        <small> km/h</small>
                      </p>

                      <h3>Wind speed</h3>

                      <p className={styles.statFoot}>
                        {getWindDirection(weather.current.wind_direction_10m)} direction · Gusts{" "}
                        {round(weather.current.wind_gusts_10m)} km/h
                      </p>
                    </article>

                    <article className={styles.statCard}>
                      <div className={styles.statTop}>
                        <span className={styles.statIcon}>
                          <Gauge size={18} />
                        </span>
                        <span className={styles.statTag}>AIR PRESSURE</span>
                      </div>

                      <p className={styles.statValue}>
                        {round(weather.current.pressure_msl)}
                        <small> hPa</small>
                      </p>

                      <h3>Pressure</h3>
                      <p className={styles.statFoot}>Mean sea-level pressure</p>
                    </article>

                    <article className={styles.statCard}>
                      <div className={styles.statTop}>
                        <span className={styles.statIcon}>
                          <Eye size={18} />
                        </span>
                        <span className={styles.statTag}>SIGHT RANGE</span>
                      </div>

                      <p className={styles.statValue}>
                        {derived.visibilityKm.toFixed(1)}
                        <small> km</small>
                      </p>

                      <h3>Visibility</h3>

                      <p className={styles.statFoot}>
                        {derived.visibilityKm >= 10
                          ? "Clear visibility"
                          : derived.visibilityKm >= 5
                            ? "Moderate visibility"
                            : "Reduced visibility"}
                      </p>
                    </article>

                    <article className={styles.statCard}>
                      <div className={styles.statTop}>
                        <span className={styles.statIcon}>
                          <Sun size={18} />
                        </span>
                        <span className={styles.statTag}>SOLAR INTENSITY</span>
                      </div>

                      <p className={styles.statValue}>
                        {round(derived.currentUv)}
                        <small> UV</small>
                      </p>

                      <h3>UV index</h3>

                      <p className={styles.statFoot}>
                        <span className={styles.uvPill}>
                          {getUvLabel(derived.currentUv)}
                        </span>{" "}
                        Current hourly estimate
                      </p>
                    </article>

                    <article className={styles.statCard}>
                      <div className={styles.statTop}>
                        <span className={styles.statIcon}>
                          <CloudSun size={18} />
                        </span>
                        <span className={styles.statTag}>PRECIPITATION</span>
                      </div>

                      <p className={styles.statValue}>
                        {weather.current.precipitation.toFixed(1)}
                        <small> mm</small>
                      </p>

                      <h3>Precipitation</h3>

                      <p className={styles.statFoot}>
                        Rain {weather.current.rain.toFixed(1)} mm · Clouds{" "}
                        {round(weather.current.cloud_cover)}%
                      </p>
                    </article>
                  </div>
                </section>
              </>
            ) : null}

            {view === "air-quality" ? (
              <>
                <section
                  className={styles.airQualitySection}
                  id="air-quality"
                  aria-label="Air quality and pollutants"
                >
                  <SectionHeading
                    eyebrow="BREATHING CONDITIONS"
                    title="Air quality intelligence"
                    note="CAMS model estimates · not a ground-station reading"
                  />

                  {airCurrent ? (
                    <>
                      <div className={styles.aqiOverview}>
                        <article
                          className={`${styles.aqiMainCard} ${
                            styles[aqiInfo.className]
                          }`}
                        >
                          <div className={styles.aqiCardTop}>
                            <span>US AIR QUALITY INDEX</span>
                            <span className={styles.aqiModelTag}>
                              MODEL ESTIMATE
                            </span>
                          </div>

                          <div className={styles.aqiScoreRow}>
                            <strong>{numberOrDash(airCurrent.us_aqi, 0)}</strong>
                            <span className={styles.aqiStatus}>
                              {aqiInfo.label}
                            </span>
                          </div>

                          <div className={styles.aqiScale}>
                            <span
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, (airCurrent.us_aqi ?? 0) / 3.5),
                                )}%`,
                              }}
                            />
                          </div>

                          <p>{aqiInfo.advice}</p>
                          <small>US AQI scale · This is not India’s CPCB AQI.</small>
                        </article>

                        <article className={styles.aqiSecondaryCard}>
                          <span className={styles.detailLabel}>
                            EUROPEAN AIR QUALITY INDEX
                          </span>

                          <strong>
                            {numberOrDash(airCurrent.european_aqi, 0)}
                          </strong>

                          <span className={styles.detailValue}>
                            {airCurrent.european_aqi === null
                              ? "Unavailable"
                              : airCurrent.european_aqi <= 20
                                ? "Good"
                                : airCurrent.european_aqi <= 40
                                  ? "Fair"
                                  : airCurrent.european_aqi <= 60
                                    ? "Moderate"
                                    : airCurrent.european_aqi <= 80
                                      ? "Poor"
                                      : airCurrent.european_aqi <= 100
                                        ? "Very poor"
                                        : "Extremely poor"}
                          </span>

                          <p>
                            European AQI uses a separate scale. Compare values only
                            within the same index system.
                          </p>
                        </article>

                        <article className={styles.aqiSecondaryCard}>
                          <span className={styles.detailLabel}>
                            AIR QUALITY DATA TIME
                          </span>

                          <strong className={styles.aqiTime}>
                            {getTimeLabel(airCurrent.time)}
                          </strong>

                          <span className={styles.detailValue}>
                            {airQuality?.timezone.replaceAll("_", " ")}
                          </span>

                          <p>
                            Forecast model output can differ from nearby regulatory
                            monitoring stations.
                          </p>
                        </article>
                      </div>

                      <div className={styles.subSectionHeading}>
                        <h3>Pollutant breakdown</h3>
                        <span>Concentration · μg/m³</span>
                      </div>

                      <div className={styles.pollutantGrid}>
                        {[
                          {
                            name: "PM2.5",
                            key: "pm2_5",
                            desc: "Fine particulate matter",
                            value: airCurrent.pm2_5,
                          },
                          {
                            name: "PM10",
                            key: "pm10",
                            desc: "Coarse particulate matter",
                            value: airCurrent.pm10,
                          },
                          {
                            name: "Ozone · O₃",
                            key: "ozone",
                            desc: "Ground-level ozone",
                            value: airCurrent.ozone,
                          },
                          {
                            name: "Nitrogen dioxide · NO₂",
                            key: "no2",
                            desc: "Traffic and combustion pollutant",
                            value: airCurrent.nitrogen_dioxide,
                          },
                          {
                            name: "Sulphur dioxide · SO₂",
                            key: "so2",
                            desc: "Combustion-related gas",
                            value: airCurrent.sulphur_dioxide,
                          },
                          {
                            name: "Carbon monoxide · CO",
                            key: "co",
                            desc: "Combustion-related gas",
                            value: airCurrent.carbon_monoxide,
                          },
                          {
                            name: "Dust",
                            key: "dust",
                            desc: "Modelled airborne dust",
                            value: airCurrent.dust,
                          },
                        ].map((pollutant) => (
                          <article
                            className={styles.pollutantCard}
                            key={pollutant.key}
                          >
                            <span className={styles.pollutantName}>
                              {pollutant.name}
                            </span>

                            <strong>
                              {numberOrDash(pollutant.value, 1)}{" "}
                              <small>μg/m³</small>
                            </strong>

                            <span className={styles.pollutantDesc}>
                              {pollutant.desc}
                            </span>
                          </article>
                        ))}
                      </div>

                      <div className={styles.subSectionHeading}>
                        <h3>Next-day air quality outlook</h3>
                        <span>US AQI · provider model time steps</span>
                      </div>

                      <div className={styles.aqiHourlyScroller}>
                        {aqiHourlyItems.map((item, index) => {
                          const itemInfo = getUsAqiInfo(item.aqi);

                          return (
                            <article
                              className={`${styles.aqiHourCard} ${
                                styles[itemInfo.className]
                              }`}
                              key={`${item.time}-${index}`}
                            >
                              <span>
                                {index === 0 ? "NOW" : getShortTime(item.time)}
                              </span>

                              <strong>{numberOrDash(item.aqi, 0)}</strong>
                              <small>PM2.5 {numberOrDash(item.pm25, 0)}</small>
                              <em>{itemInfo.label}</em>
                            </article>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className={styles.aqiUnavailablePanel}>
                      <ShieldCheck size={20} />
                      <div>
                        <strong>Air-quality data is temporarily unavailable</strong>
                        <p>
                          Weather forecasts are still available. Try refreshing or
                          searching this location again.
                        </p>
                      </div>
                    </div>
                  )}

                  <p className={styles.aqiDisclaimer}>
                    <Activity size={13} /> Air-quality values are modelled estimates
                    from CAMS, not direct local sensor readings. Global coverage is
                    approximately 45 km with 3-hourly steps; European coverage is
                    approximately 11 km and hourly. US AQI and European AQI are
                    different scales; Open-Meteo does not return India&apos;s CPCB
                    AQI directly. Follow local authority advisories for health
                    decisions.
                  </p>
                </section>
              </>
            ) : null}

            {view === "wind" ? (
              <section
                className={styles.detailPageSection}
                aria-label="Wind and pressure details"
              >
                <SectionHeading
                  eyebrow="WIND & PRESSURE MONITOR"
                  title="Wind conditions"
                  note="Current values and the next 24 local hours"
                />

                <div className={styles.detailMetricGrid}>
                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Wind size={15} /> WIND SPEED
                    </span>
                    <strong>
                      {round(weather.current.wind_speed_10m)} <small>km/h</small>
                    </strong>
                    <span className={styles.detailMetricNote}>10-metre wind speed</span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <ArrowUpRight size={15} /> WIND GUSTS
                    </span>
                    <strong>
                      {round(weather.current.wind_gusts_10m)} <small>km/h</small>
                    </strong>
                    <span className={styles.detailMetricNote}>Peak gust estimate</span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Wind size={15} /> WIND DIRECTION
                    </span>
                    <strong>
                      {getWindDirection(weather.current.wind_direction_10m)}
                    </strong>
                    <span className={styles.detailMetricNote}>
                      {round(weather.current.wind_direction_10m)}° compass bearing
                    </span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Gauge size={15} /> SEA-LEVEL PRESSURE
                    </span>
                    <strong>
                      {round(weather.current.pressure_msl)} <small>hPa</small>
                    </strong>
                    <span className={styles.detailMetricNote}>
                      Mean sea-level pressure
                    </span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Gauge size={15} /> SURFACE PRESSURE
                    </span>
                    <strong>
                      {numberOrDash(derived.surfacePressure, 0)}{" "}
                      <small>hPa</small>
                    </strong>
                    <span className={styles.detailMetricNote}>
                      Pressure at model surface elevation
                    </span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Activity size={15} /> CONVECTIVE ENERGY
                    </span>
                    <strong>
                      {numberOrDash(derived.wetBulbCape, 0)}{" "}
                      <small>J/kg</small>
                    </strong>
                    <span className={styles.detailMetricNote}>
                      CAPE atmospheric instability indicator
                    </span>
                  </article>
                </div>

                <div className={styles.windCompassPanel}>
                  <div>
                    <p className={styles.eyebrow}>DIRECTIONAL READOUT</p>
                    <h3>
                      Wind is coming from the{" "}
                      {getWindDirection(weather.current.wind_direction_10m)}
                    </h3>
                    <p>
                      Direction is reported as the meteorological bearing the wind
                      comes from.
                    </p>
                  </div>

                  <div
                    className={styles.windCompass}
                    aria-label={`Wind direction ${getWindDirection(
                      weather.current.wind_direction_10m,
                    )}`}
                  >
                    <span className={styles.compassNorth}>N</span>
                    <span className={styles.compassEast}>E</span>
                    <span className={styles.compassSouth}>S</span>
                    <span className={styles.compassWest}>W</span>

                    <span
                      className={styles.compassNeedle}
                      style={{
                        transform: `translate(-50%, -78%) rotate(${weather.current.wind_direction_10m}deg)`,
                      }}
                    />
                  </div>
                </div>

                <div className={styles.subSectionHeading}>
                  <h3>Wind timeline</h3>
                  <span>Speed · direction · gusts · pressure</span>
                </div>

                <div className={styles.dataTableWrap}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Local time</th>
                        <th>Wind speed</th>
                        <th>Direction</th>
                        <th>Gusts</th>
                        <th>Sea-level pressure</th>
                        <th>Surface pressure</th>
                        <th>Cloud cover</th>
                      </tr>
                    </thead>

                    <tbody>
                      {derived.hourlyItems.map((item, index) => (
                        <tr key={`${item.time}-wind`}>
                          <td>{index === 0 ? "Now" : getShortTime(item.time)}</td>
                          <td>{round(item.wind)} km/h</td>
                          <td>
                            {getWindDirection(item.windDirection)} (
                            {round(item.windDirection)}°)
                          </td>
                          <td>{round(item.gust)} km/h</td>
                          <td>{round(item.pressure)} hPa</td>
                          <td>{round(item.surfacePressure)} hPa</td>
                          <td>{round(item.cloud)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {view === "precipitation" ? (
              <section
                className={styles.detailPageSection}
                aria-label="Precipitation details"
              >
                <SectionHeading
                  eyebrow="RAIN · SHOWERS · SNOW"
                  title="Precipitation monitor"
                  note="Current model values and forecast accumulation"
                />

                <div className={styles.detailMetricGrid}>
                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Droplets size={15} /> CURRENT PRECIPITATION
                    </span>
                    <strong>
                      {numberOrDash(weather.current.precipitation)}{" "}
                      <small>mm</small>
                    </strong>
                    <span className={styles.detailMetricNote}>
                      Total precipitation at the current model time
                    </span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Cloud size={15} /> RAIN
                    </span>
                    <strong>
                      {numberOrDash(weather.current.rain)} <small>mm</small>
                    </strong>
                    <span className={styles.detailMetricNote}>Rain component</span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Droplets size={15} /> SHOWERS
                    </span>
                    <strong>
                      {numberOrDash(weather.current.showers)} <small>mm</small>
                    </strong>
                    <span className={styles.detailMetricNote}>
                      Showery precipitation component
                    </span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Cloud size={15} /> SNOWFALL
                    </span>
                    <strong>
                      {numberOrDash(weather.current.snowfall)} <small>cm</small>
                    </strong>
                    <span className={styles.detailMetricNote}>Snowfall amount</span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <Cloud size={15} /> TODAY&apos;S RAIN CHANCE
                    </span>
                    <strong>
                      {round(
                        weather.daily.precipitation_probability_max[
                          derived.dayIndex
                        ] ?? 0,
                      )}{" "}
                      <small>%</small>
                    </strong>
                    <span className={styles.detailMetricNote}>
                      Maximum probability today
                    </span>
                  </article>

                  <article className={styles.detailMetricCard}>
                    <span className={styles.detailMetricLabel}>
                      <CalendarDays size={15} /> TODAY&apos;S TOTAL
                    </span>
                    <strong>
                      {numberOrDash(
                        weather.daily.precipitation_sum[derived.dayIndex],
                      )}{" "}
                      <small>mm</small>
                    </strong>
                    <span className={styles.detailMetricNote}>
                      Forecast accumulated precipitation
                    </span>
                  </article>
                </div>

                <div className={styles.subSectionHeading}>
                  <h3>Hourly precipitation outlook</h3>
                  <span>Next 24 hours · local time</span>
                </div>

                <div className={styles.precipTimeline}>
                  {derived.hourlyItems.map((item, index) => (
                    <article
                      className={styles.precipHourCard}
                      key={`${item.time}-precip`}
                    >
                      <span>
                        {index === 0 ? "NOW" : getShortTime(item.time)}
                      </span>

                      <strong>
                        {round(item.probability)}
                        <small>%</small>
                      </strong>

                      <div className={styles.precipBar}>
                        <span
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, item.probability ?? 0),
                            )}%`,
                          }}
                        />
                      </div>

                      <small>Rain {numberOrDash(item.rain)} mm</small>
                      <small>Showers {numberOrDash(item.showers)} mm</small>
                      <small>Snow {numberOrDash(item.snowfall)} cm</small>
                    </article>
                  ))}
                </div>

                <div className={styles.subSectionHeading}>
                  <h3>Seven-day precipitation outlook</h3>
                  <span>Daily totals and wet-weather probability</span>
                </div>

                <div className={styles.dataTableWrap}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th>Day</th>
                        <th>Probability</th>
                        <th>Total precipitation</th>
                        <th>Rain</th>
                        <th>Showers</th>
                        <th>Snowfall</th>
                        <th>Precipitation hours</th>
                      </tr>
                    </thead>

                    <tbody>
                      {weather.daily.time.map((date, index) => (
                        <tr key={`${date}-precip`}>
                          <td>{getDayName(date, index)}</td>
                          <td>
                            {round(
                              weather.daily.precipitation_probability_max[index] ??
                                0,
                            )}
                            %
                          </td>
                          <td>
                            {numberOrDash(weather.daily.precipitation_sum[index])}{" "}
                            mm
                          </td>
                          <td>{numberOrDash(weather.daily.rain_sum[index])} mm</td>
                          <td>
                            {numberOrDash(weather.daily.showers_sum[index])} mm
                          </td>
                          <td>
                            {numberOrDash(weather.daily.snowfall_sum[index])} cm
                          </td>
                          <td>
                            {numberOrDash(
                              weather.daily.precipitation_hours[index],
                              0,
                            )}{" "}
                            h
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {view === "forecast" ? (
              <>
                <section
                  className={styles.hourlySection}
                  id="forecast"
                  aria-label="Hourly forecast"
                >
                  <div className={styles.hourlyHeader}>
                    <SectionHeading
                      eyebrow="THE NEXT 24 HOURS"
                      title="Hourly forecast"
                      note="A closer look at what's ahead"
                    />

                    <span className={styles.forecastTimezone}>
                      {weather.timezone.replaceAll("_", " ")}
                      <ChevronDown size={13} />
                    </span>
                  </div>

                  <div className={styles.hourlyScroller}>
                    {derived.hourlyItems.map((item, index) => {
                      const meta = getWeatherMeta(item.code, item.isDay);
                      const Icon = meta.Icon;

                      return (
                        <div
                          key={`${item.time}-${index}`}
                          className={`${styles.hourCard} ${
                            index === 0 ? styles.hourCardCurrent : ""
                          }`}
                        >
                          <span className={styles.hourTime}>
                            {index === 0 ? "NOW" : getShortTime(item.time)}
                          </span>

                          <Icon
                            className={styles.hourIcon}
                            size={23}
                            strokeWidth={1.65}
                          />

                          <strong>{round(item.temperature)}°</strong>

                          <span className={styles.hourRain}>
                            <Droplets size={11} />{" "}
                            {round(item.probability ?? 0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.hourlyFoot}>
                    <span>
                      <span className={styles.legendDot} /> Temperature
                    </span>
                    <span>
                      <Droplets size={12} /> Precipitation probability
                    </span>
                    <span className={styles.scrollHint}>
                      Scroll to explore <ArrowUpRight size={12} />
                    </span>
                  </div>
                </section>

                <section
                  className={styles.detailTableSection}
                  aria-label="Detailed hourly weather data"
                >
                  <SectionHeading
                    eyebrow="HOUR-BY-HOUR DETAIL"
                    title="Weather timeline"
                    note="The next 24 local hours"
                  />

                  <div className={styles.dataTableWrap}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Temp</th>
                          <th>Feels</th>
                          <th>Dew point</th>
                          <th>Humidity</th>
                          <th>Wind</th>
                          <th>Direction</th>
                          <th>Gust</th>
                          <th>Rain chance</th>
                          <th>Rain</th>
                          <th>Showers</th>
                          <th>Snowfall</th>
                          <th>Cloud total</th>
                          <th>Low cloud</th>
                          <th>Mid cloud</th>
                          <th>High cloud</th>
                          <th>Pressure</th>
                          <th>Surface pressure</th>
                          <th>UV</th>
                          <th>VPD</th>
                          <th>Solar</th>
                          <th>Visibility</th>
                        </tr>
                      </thead>

                      <tbody>
                        {derived.hourlyItems.map((item, index) => (
                          <tr key={`${item.time}-${index}`}>
                            <td>
                              {index === 0 ? "Now" : getShortTime(item.time)}
                            </td>
                            <td>{round(item.temperature)}°</td>
                            <td>{round(item.feelsLike)}°</td>
                            <td>{round(item.dewPoint)}°</td>
                            <td>{round(item.humidity)}%</td>
                            <td>{round(item.wind)} km/h</td>
                            <td>{getWindDirection(item.windDirection)}</td>
                            <td>{round(item.gust)} km/h</td>
                            <td>{round(item.probability)}%</td>
                            <td>{numberOrDash(item.rain)} mm</td>
                            <td>{numberOrDash(item.showers)} mm</td>
                            <td>{numberOrDash(item.snowfall)} cm</td>
                            <td>{round(item.cloud)}%</td>
                            <td>{round(item.cloudLow)}%</td>
                            <td>{round(item.cloudMid)}%</td>
                            <td>{round(item.cloudHigh)}%</td>
                            <td>{round(item.pressure)} hPa</td>
                            <td>{round(item.surfacePressure)} hPa</td>
                            <td>{numberOrDash(item.uv, 1)}</td>
                            <td>{numberOrDash(item.vapourDeficit, 2)} kPa</td>
                            <td>{round(item.solar)} W/m²</td>
                            <td>{(item.visibility / 1000).toFixed(1)} km</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section
                  className={styles.forecastGrid}
                  aria-label="Weekly forecast and daylight"
                >
                  <div className={styles.weeklyPanel}>
                    <SectionHeading
                      eyebrow="PLAN AHEAD"
                      title="7-day forecast"
                      note="A week at a glance"
                    />

                    <div className={styles.weeklyList}>
                      {weather.daily.time.map((date, index) => {
                        const meta = getWeatherMeta(
                          weather.daily.weather_code[index],
                          index === 0 ? weather.current.is_day === 1 : true,
                        );

                        const Icon = meta.Icon;
                        const low = weather.daily.temperature_2m_min[index];
                        const high = weather.daily.temperature_2m_max[index];

                        const left =
                          ((low - derived.dailyMin) / derived.span) * 100;

                        const width = Math.max(
                          4,
                          ((high - low) / derived.span) * 100,
                        );

                        return (
                          <div
                            className={`${styles.weekRow} ${
                              index === 0 ? styles.weekRowToday : ""
                            }`}
                            key={date}
                          >
                            <div className={styles.weekDay}>
                              <strong>{getDayName(date, index)}</strong>
                              <span>{getDateLabel(date)}</span>
                            </div>

                            <div className={styles.weekCondition}>
                              <Icon size={20} strokeWidth={1.7} />
                              <span>{meta.label}</span>
                            </div>

                            <div
                              className={styles.weekRange}
                              aria-label={`Low ${round(low)} degrees, high ${round(high)} degrees`}
                            >
                              <span className={styles.weekRangeTrack} />
                              <span
                                className={styles.weekRangeFill}
                                style={{
                                  left: `${left}%`,
                                  width: `${width}%`,
                                }}
                              />
                            </div>

                            <div className={styles.weekTemps}>
                              <strong>{round(high)}°</strong>
                              <span>{round(low)}°</span>
                            </div>

                            <div className={styles.weekRain}>
                              <Droplets size={12} />{" "}
                              {round(
                                weather.daily.precipitation_probability_max[
                                  index
                                ] ?? 0,
                              )}
                              %
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <aside className={styles.daylightPanel}>
                    <SectionHeading
                      eyebrow="DAYLIGHT CYCLE"
                      title="Sun path"
                    />

                    <div className={styles.sunPathVisual}>
                      <div className={styles.sunPathArc} />
                      <div className={styles.sunPathHorizon} />

                      <div
                        className={styles.sunMarker}
                        style={{
                          left: `${Math.max(
                            4,
                            Math.min(96, daylightProgress),
                          )}%`,
                        }}
                      >
                        <Sun size={17} />
                      </div>

                      <span className={styles.sunrisePoint}>
                        <Sunrise size={15} />
                      </span>

                      <span className={styles.sunsetPoint}>
                        <Sunset size={15} />
                      </span>

                      <span className={styles.sunPathLabel}>
                        DAYLIGHT IN PROGRESS
                      </span>
                    </div>

                    <div className={styles.sunTimes}>
                      <div>
                        <span>
                          <Sunrise size={15} /> SUNRISE
                        </span>
                        <strong>{getTimeLabel(sunrise)}</strong>
                      </div>

                      <div>
                        <span>
                          <Sunset size={15} /> SUNSET
                        </span>
                        <strong>{getTimeLabel(sunset)}</strong>
                      </div>
                    </div>

                    <div className={styles.daylightTotal}>
                      <span>TOTAL DAYLIGHT</span>
                      <strong>{daylight}</strong>
                    </div>

                    <div className={styles.daylightProgress}>
                      <span style={{ width: `${daylightProgress}%` }} />
                    </div>

                    <div className={styles.daylightFoot}>
                      <span>{daylightProgress}% elapsed</span>
                      <span>
                        UV peak {round(weather.daily.uv_index_max[derived.dayIndex] ?? 0)}
                      </span>
                    </div>
                  </aside>
                </section>
              </>
            ) : null}

            {view === "atmosphere" ? (
              <>
                <section
                  className={styles.extendedSection}
                  aria-label="Advanced weather parameters"
                >
                  <SectionHeading
                    eyebrow="DEEP ATMOSPHERIC PROFILE"
                    title="Advanced weather parameters"
                    note="Additional model variables for a fuller picture"
                  />

                  <div className={styles.extendedGrid}>
                    {extendedMetrics.map((metric) => {
                      const Icon = metric.icon;

                      return (
                        <article
                          className={styles.extendedCard}
                          key={metric.label}
                        >
                          <span className={styles.extendedIcon}>
                            <Icon size={17} />
                          </span>

                          <div>
                            <span className={styles.detailLabel}>
                              {metric.label}
                            </span>
                            <strong>{metric.value}</strong>
                            <small>{metric.note}</small>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className={styles.dailyExtras}>
                    <div className={styles.subSectionHeading}>
                      <h3>Extended 7-day outlook</h3>
                      <span>Thermal comfort · precipitation · wind</span>
                    </div>

                    <div className={styles.dataTableWrap}>
                      <table className={styles.dataTable}>
                        <thead>
                          <tr>
                            <th>Day</th>
                            <th>Feels-like high</th>
                            <th>Feels-like low</th>
                            <th>Total precipitation</th>
                            <th>Rain</th>
                            <th>Showers</th>
                            <th>Snow</th>
                            <th>Wet hours</th>
                            <th>Max wind</th>
                            <th>Wind direction</th>
                            <th>Max gust</th>
                            <th>UV max</th>
                            <th>Daylight</th>
                            <th>Sunshine</th>
                          </tr>
                        </thead>

                        <tbody>
                          {weather.daily.time.map((date, index) => (
                            <tr key={date}>
                              <td>{getDayName(date, index)}</td>
                              <td>
                                {round(weather.daily.apparent_temperature_max[index])}°
                              </td>
                              <td>
                                {round(weather.daily.apparent_temperature_min[index])}°
                              </td>
                              <td>
                                {numberOrDash(weather.daily.precipitation_sum[index])} mm
                              </td>
                              <td>
                                {numberOrDash(weather.daily.rain_sum[index])} mm
                              </td>
                              <td>
                                {numberOrDash(weather.daily.showers_sum[index])} mm
                              </td>
                              <td>
                                {numberOrDash(weather.daily.snowfall_sum[index])} cm
                              </td>
                              <td>
                                {numberOrDash(weather.daily.precipitation_hours[index], 0)} h
                              </td>
                              <td>
                                {round(weather.daily.wind_speed_10m_max[index])} km/h
                              </td>
                              <td>
                                {getWindDirection(weather.daily.wind_direction_10m_dominant[index])}
                              </td>
                              <td>
                                {round(weather.daily.wind_gusts_10m_max[index])} km/h
                              </td>
                              <td>{round(weather.daily.uv_index_max[index])}</td>
                              <td>
                                {(weather.daily.daylight_duration[index] / 3600).toFixed(1)} h
                              </td>
                              <td>
                                {(weather.daily.sunshine_duration[index] / 3600).toFixed(1)} h
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            {view === "overview" ? (
              <>
                <section className={styles.insightsSection} id="insights">
                  <SectionHeading
                    eyebrow="READ BETWEEN THE CLOUDS"
                    title="Atmospheric insights"
                    note="Simple signals from the latest weather data"
                  />

                  <div className={styles.insightsGrid}>
                    {derived.insights.map((insight, index) => {
                      const Icon = insight.icon;

                      return (
                        <article
                          className={styles.insightCard}
                          key={insight.title}
                        >
                          <span className={styles.insightIcon}>
                            <Icon size={18} />
                          </span>

                          <div>
                            <span className={styles.insightIndex}>
                              SIGNAL 0{index + 1}
                            </span>
                            <h3>{insight.title}</h3>
                            <p>{insight.text}</p>
                          </div>

                          <ArrowUpRight
                            className={styles.insightArrow}
                            size={16}
                          />
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            ) : null}

            <div className={styles.dataNote}>
              <Activity size={14} />
              <span>
                Weather and air-quality values are model-based estimates from
                Open-Meteo forecast systems, not guaranteed local station
                observations. AQI values use US and European scales, not India&apos;s
                CPCB scale. Values can change as new model data becomes available.
              </span>
            </div>
          </>
        ) : null}

        <footer className={styles.footer}>
          <a className={styles.footerBrand} href="/weather">
            <span className={styles.footerMark}>
              <CloudSun size={17} />
            </span>
            <strong>ATMOSPHERE</strong>
          </a>

          <p>Beyond forecasts. Understand your atmosphere.</p>

          <div className={styles.footerRight}>
            <span>WEATHER & AIR QUALITY DATA POWERED BY</span>
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
            >
              Open-Meteo <ArrowUpRight size={12} />
            </a>
          </div>
        </footer>

        <div className={styles.copyright}>
          © {new Date().getFullYear()} ATMOSPHERE WEATHER INTELLIGENCE
          <span>BUILT FOR THE WAF-II EXPERIENTIAL LEARNING PROJECT</span>
        </div>
      </div>
    </main>
  );
}