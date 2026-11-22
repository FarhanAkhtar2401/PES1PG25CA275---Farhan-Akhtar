import WeatherSearch from "../WeatherSearch";

export const metadata = {
  title: "Weather Forecast | ATMOSPHERE",
  description: "Hourly weather timeline and seven-day forecast.",
};

export default function Page() {
  return <WeatherSearch view="forecast" />;
}
