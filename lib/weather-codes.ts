import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Snowflake,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WeatherMeta {
  label: string;
  description: string;
  Icon: LucideIcon;
}

export function getWeatherMeta(code: number, isDay = true): WeatherMeta {
  if (code === 0) {
    return isDay
      ? { label: "Clear sky", description: "Clear and bright", Icon: Sun }
      : { label: "Clear night", description: "Clear skies after dark", Icon: Moon };
  }
  if (code === 1) {
    return isDay
      ? { label: "Mainly clear", description: "Mostly clear conditions", Icon: CloudSun }
      : { label: "Mainly clear", description: "Mostly clear conditions", Icon: CloudMoon };
  }
  if (code === 2) {
    return isDay
      ? { label: "Partly cloudy", description: "A mix of sun and clouds", Icon: CloudSun }
      : { label: "Partly cloudy", description: "Clouds drifting across the night", Icon: CloudMoon };
  }
  if (code === 3) return { label: "Overcast", description: "Cloud cover across the sky", Icon: Cloud };
  if ([45, 48].includes(code)) return { label: "Fog", description: "Reduced visibility from fog", Icon: CloudFog };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", description: "Light precipitation in the air", Icon: CloudDrizzle };
  if ([61, 63, 65, 66, 67].includes(code)) return { label: "Rain", description: "Rainfall is present", Icon: CloudRain };
  if (code === 77) return { label: "Snow grains", description: "Small ice particles", Icon: Snowflake };
  if ([71, 73, 75, 85, 86].includes(code)) return { label: "Snow", description: "Snowfall or snow showers", Icon: CloudSnow };
  if ([80, 81, 82].includes(code)) return { label: "Rain showers", description: "Passing showers are expected", Icon: CloudDrizzle };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", description: "Thunderstorm activity nearby", Icon: CloudLightning };
  return { label: "Changing conditions", description: "Weather conditions may vary", Icon: Cloud };
}

export function getUvLabel(value: number): string {
  if (value < 3) return "Low";
  if (value < 6) return "Moderate";
  if (value < 8) return "High";
  if (value < 11) return "Very high";
  return "Extreme";
}

export function getWindDirection(degrees: number): string {
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[Math.round(degrees / 22.5) % 16];
}
