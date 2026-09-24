// Request/response shapes of the WindWise server API (see apps/server).
import type { Units } from './wind';

export type Capabilities = {
  tier: string;
  maxDailyDays: number;
  maxHourlyHours: number;
  periodsMode: '4-period' | 'day-night';
};

export type LocationResult = { key: string; name: string; admin: string; country: string };

export type ReportRequestBody = {
  locationKey: string;
  start: string; // local "YYYY-MM-DDTHH:mm"
  end: string; // local "YYYY-MM-DDTHH:mm", exclusive
  units?: Units;
};

export type ApiErrorBody = { error: string };
