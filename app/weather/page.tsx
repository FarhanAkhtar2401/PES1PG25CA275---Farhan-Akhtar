import WeatherSearch from "./WeatherSearch";

export const metadata = {
  title: "Weather Overview | ATMOSPHERE",
  description: "Current weather conditions and a concise overview powered by Open-Meteo.",
};

export default function WeatherPage() {
  return <WeatherSearch view="overview" />;
}
