# ATMOSPHERE — Weather Intelligence

A multi-page weather and air-quality dashboard built with Next.js App Router, TypeScript, CSS Modules and the free Open-Meteo APIs.

## Pages

- `/weather` — Overview and current conditions
- `/weather/air-quality` — US AQI, European AQI, pollutant concentrations and air-quality outlook
- `/weather/wind` — Wind speed, direction, gusts and pressure timeline
- `/weather/precipitation` — Rain, showers, snowfall, probability and accumulation outlook
- `/weather/forecast` — Next-24-hour timeline, hourly detail table and seven-day forecast
- `/weather/atmosphere` — UV, cloud layers, dew point, wet-bulb temperature, solar radiation, soil and other advanced model variables

The selected city is stored in browser local storage so it is restored when navigating between pages. Each page fetches fresh data for that saved location.

## Weather data

Uses Open-Meteo Geocoding, Forecast and Air Quality APIs. No API key or `.env.local` file is required. Weather and air-quality values are model-derived estimates, not guaranteed nearby station readings. The air-quality page labels US AQI and European AQI separately; neither should be presented as India's CPCB AQI. Please retain attribution to Open-Meteo.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000/weather](http://localhost:3000/weather).

## Production build

```bash
npm run build
npm run start
```

## Deploy to Vercel

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Keep the Next.js default build settings.
4. Deploy. No weather API environment variables are needed.

For personal, educational, non-commercial use, check Open-Meteo's current fair-use terms and attribution requirements.

## Global location search

Location search uses the Open-Meteo Geocoding API worldwide. Search by city, region or country, for example `Tokyo, Japan`, `Paris, France`, or `Hyderabad, India`. For an unambiguous ISO country filter, use `City, country:XX` (for example, `Paris, country:FR`). The app always displays a suggestion list before loading weather; it never silently accepts the first geocoder result. Each suggestion shows the place, administrative region, country, ISO country code and timezone. Unqualified searches return worldwide matches plus supplemental India-filtered matches, with Indian results surfaced near the top as a regional preference; this does not prevent users selecting locations in other countries. This is important because the upstream GeoNames-backed index can occasionally return unrelated homonymous or historical-name matches. Common alternate names such as Bangalore, Bombay, Madras, Calcutta, Poona, Mangalore, Mysore, Trivandrum, Cochin and Baroda are normalized to their modern city names before lookup; international alternatives such as Peking, Saigon and Rangoon are handled similarly. For maximum precision, include the country name or `country:XX` qualifier.

The first visit defaults to Bengaluru, Karnataka, India. After a user explicitly selects a location, the selection is saved in local storage and reused across the application's separate weather pages.

## Weather guidance and precautions

The Overview page includes a context-aware weather briefing. Suggestions are generated from the selected location's current model values and include relevant guidance for thunderstorms, rain and showers, freezing precipitation, snow and ice, fog or reduced visibility, cloud cover, clear day/night conditions, UV exposure, heat, cold, strong winds, humidity and elevated US AQI. The panel is concise and prioritizes higher-severity precautions. These are general suggestions, not official emergency alerts or medical advice; users should follow local authority guidance during hazardous conditions.

