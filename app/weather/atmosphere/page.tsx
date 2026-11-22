import WeatherSearch from "../WeatherSearch";

export const metadata = {
  title: "Atmospheric Details | ATMOSPHERE",
  description: "UV, cloud layers, solar radiation and advanced atmospheric variables.",
};

export default function Page() {
  return <WeatherSearch view="atmosphere" />;
}
