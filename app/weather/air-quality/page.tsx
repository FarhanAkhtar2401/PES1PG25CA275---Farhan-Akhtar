import WeatherSearch from "../WeatherSearch";

export const metadata = {
  title: "Air Quality | ATMOSPHERE",
  description: "Air-quality index estimates, pollutant concentrations and outlook.",
};

export default function Page() {
  return <WeatherSearch view="air-quality" />;
}
