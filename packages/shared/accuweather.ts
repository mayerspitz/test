// Raw AccuWeather API shapes (the subset WindWise reads). All requests use details=true.

export type AwValue = { Value: number; Unit?: string; UnitType?: number };

export type AwWind = {
  Speed: AwValue;
  Direction?: { Degrees?: number; Localized?: string; English?: string };
};

export type AwHour = {
  DateTime: string; // local time with offset, e.g. 2026-09-25T06:00:00-04:00
  IconPhrase: string;
  HasPrecipitation?: boolean;
  Temperature: AwValue;
  RealFeelTemperature: AwValue;
  Wind: AwWind;
  WindGust: AwWind;
  PrecipitationProbability?: number;
  RainProbability?: number;
  Rain?: AwValue;
};

export type AwHalfDay = {
  IconPhrase?: string;
  ShortPhrase?: string;
  LongPhrase: string;
  HasPrecipitation?: boolean;
  PrecipitationProbability?: number;
  RainProbability?: number;
  Wind: AwWind;
  WindGust: AwWind;
  Rain?: AwValue;
  HoursOfRain?: number;
  CloudCover?: number;
};

export type AwDailyForecast = {
  Date: string; // local, e.g. 2026-09-25T07:00:00-04:00
  Sun?: { Rise?: string | null; Set?: string | null };
  Temperature: { Minimum: AwValue; Maximum: AwValue };
  RealFeelTemperature: { Minimum: AwValue; Maximum: AwValue };
  Day: AwHalfDay;
  Night: AwHalfDay;
};

export type AwDaily = {
  Headline?: { Text?: string };
  DailyForecasts: AwDailyForecast[];
};

export type AwAlert = {
  AlertID?: number;
  Description?: { Localized?: string; English?: string };
  Area?: { Name?: string; StartTime?: string; EndTime?: string }[];
};

export type AwLocation = {
  Key: string;
  LocalizedName: string;
  AdministrativeArea?: { ID?: string; LocalizedName?: string };
  Country?: { ID?: string; LocalizedName?: string };
  TimeZone?: { Name?: string; Code?: string; GmtOffset?: number };
};
