import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATMOSPHERE — Weather Intelligence",
  description:
    "A next-generation weather dashboard with current conditions, hourly forecasts and a seven-day outlook powered by Open-Meteo.",
  applicationName: "ATMOSPHERE",
};

export const viewport: Viewport = {
  themeColor: "#070b14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
