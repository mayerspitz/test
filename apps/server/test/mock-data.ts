// Deterministic AccuWeather-shaped data relative to "now", for server tests and the e2e smoke test.
import type { AwAlert, AwDaily, AwHour, AwLocation } from '@windwise/shared';

export const MOCK_KEY = 'mock-bk';

export const MOCK_LOCATION: AwLocation = {
  Key: MOCK_KEY,
  LocalizedName: 'Brooklyn',
  AdministrativeArea: { ID: 'NY', LocalizedName: 'New York' },
  Country: { ID: 'US', LocalizedName: 'United States' },
  TimeZone: { Name: 'UTC', Code: 'UTC', GmtOffset: 0 },
};

const HOUR = 3_600_000;
const DIRS = ['N', 'NNE', 'NE', 'NNW', 'NW', 'WNW'];
const iso = (ms: number) => `${new Date(ms).toISOString().slice(0, 19)}+00:00`;
const v = (Value: number, Unit: string) => ({ Value, Unit });

function startOfDayUtc(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function mockDaily(now: Date, days: number): AwDaily {
  const day0 = startOfDayUtc(now);
  return {
    Headline: { Text: 'Windy with a few showers through the weekend' },
    DailyForecasts: Array.from({ length: days }, (_, i) => {
      const base = day0 + i * 24 * HOUR;
      const half = (phrase: string, wind: number, gust: number, chance: number, rain: number) => ({
        IconPhrase: phrase,
        LongPhrase: phrase,
        HasPrecipitation: rain > 0,
        PrecipitationProbability: chance,
        RainProbability: chance,
        Wind: { Speed: v(wind, 'mi/h'), Direction: { Localized: DIRS[i % DIRS.length]! } },
        WindGust: { Speed: v(gust, 'mi/h') },
        Rain: v(rain, 'in'),
        HoursOfRain: rain > 0 ? 2 : 0,
      });
      return {
        Date: iso(base + 7 * HOUR),
        Sun: { Rise: iso(base + 6 * HOUR + 50 * 60_000), Set: iso(base + 18 * HOUR + 45 * 60_000) },
        Temperature: { Minimum: v(55 + (i % 3), 'F'), Maximum: v(68 + (i % 4), 'F') },
        RealFeelTemperature: { Minimum: v(50 + (i % 3), 'F'), Maximum: v(66 + (i % 4), 'F') },
        Day: half('Clouds and sun, windy', 18, 30 + (i % 4), 25 + i * 5, 0),
        Night: half('Mostly cloudy, a shower', 14, 26 + (i % 5), 55, 0.08),
      };
    }),
  };
}

export function mockHourly(now: Date, hours: number): AwHour[] {
  const first = Math.floor(now.getTime() / HOUR) * HOUR + HOUR;
  return Array.from({ length: hours }, (_, i) => {
    const hour = new Date(first + i * HOUR).getUTCHours();
    const wet = hour >= 18 && hour <= 20;
    return {
      DateTime: iso(first + i * HOUR),
      IconPhrase: wet
        ? 'Showers'
        : hour >= 6 && hour < 18
          ? 'Partly sunny, windy'
          : 'Mostly cloudy',
      HasPrecipitation: wet,
      Temperature: v(60 + Math.round(8 * Math.sin(((hour - 9) / 24) * 2 * Math.PI)), 'F'),
      RealFeelTemperature: v(57 + Math.round(8 * Math.sin(((hour - 9) / 24) * 2 * Math.PI)), 'F'),
      Wind: {
        Speed: v(10 + (hour % 9), 'mi/h'),
        Direction: { Localized: DIRS[hour % DIRS.length]! },
      },
      WindGust: { Speed: v(20 + (hour % 16), 'mi/h') },
      PrecipitationProbability: wet ? 60 : 15,
      RainProbability: wet ? 60 : 15,
      Rain: v(wet ? 0.03 : 0, 'in'),
    };
  });
}

export function mockAlerts(now: Date): AwAlert[] {
  const day0 = startOfDayUtc(now);
  return [
    {
      AlertID: 1,
      Description: { Localized: 'Coastal Flood Advisory', English: 'Coastal Flood Advisory' },
      Area: [
        {
          Name: 'Kings (Brooklyn)',
          StartTime: iso(day0 + 30 * HOUR),
          EndTime: iso(day0 + 42 * HOUR),
        },
      ],
    },
  ];
}
