import WeatherSearch from "../WeatherSearch";

export const metadata = {
  title: "Precipitation | ATMOSPHERE",
  description: "Rain, showers, snowfall and precipitation forecasts.",
};

export default function Page() {
  return <WeatherSearch view="precipitation" />;
}
