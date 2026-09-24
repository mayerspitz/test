import type { AwAlert, AwDaily, AwHour, AwLocation } from '../accuweather';
import alerts from './fixtures/brooklyn-alerts.json';
import daily from './fixtures/brooklyn-daily.json';
import hourly from './fixtures/brooklyn-hourly.json';
import location from './fixtures/brooklyn-location.json';

/** Golden fixture: the approved Brooklyn report, Fri Sep 25 morning → Sun Sep 27 night, 2026. */
export const brooklyn = {
  daily: daily as AwDaily,
  hourly: hourly as AwHour[],
  alerts: alerts as AwAlert[],
  location: location as AwLocation,
  range: { start: '2026-09-25T06:00', end: '2026-09-28T06:00' },
  retrievedAt: new Date('2026-09-24T16:00:00Z'),
};
