// Time alignment from the venue plan. A fill speaker is closer to its
// listeners than the main PA, so its sound arrives first and pulls the image
// away from the stage. Delaying it until just after the main PA's sound
// arrives (the precedence or Haas effect) keeps voices sounding like they
// come from the stage.

export function speedOfSound(temperatureC = 20) {
  return 331.3 + 0.606 * temperatureC;
}

const distance = ([x1, y1, z1 = 0], [x2, y2, z2 = 0]) => Math.hypot(x2 - x1, y2 - y1, z2 - z1);

/**
 * Suggested delay per zone, in ms, from speaker and listener positions
 * (metres). Zones without positions are left out.
 */
export function alignmentDelaysMs(venue) {
  const geo = venue.geometry;
  const main = geo && venue.zones.find((z) => z.id === geo.mainZone);
  if (!main?.speakerPos) return {};
  const c = speedOfSound(geo.temperatureC);
  const delays = { [main.id]: 0 };
  for (const zone of venue.zones) {
    if (zone === main || !zone.speakerPos || !zone.listenPos) continue;
    const late = (distance(main.speakerPos, zone.listenPos) - distance(zone.speakerPos, zone.listenPos)) / c;
    delays[zone.id] = Math.max(0, Math.round((late * 1000 + geo.precedenceMs) * 10) / 10);
  }
  return delays;
}
