import WeatherSearch from "../WeatherSearch";

export const metadata = {
  title: "Wind & Pressure | ATMOSPHERE",
  description: "Wind speed, direction, gusts and pressure conditions.",
};

export default function Page() {
  return <WeatherSearch view="wind" />;
}
