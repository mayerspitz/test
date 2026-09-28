#!/usr/bin/env node
// Stand-in for yt-dlp in tests. Media URLs point at FAKE_MEDIA (a local test server).
// The first stream lookup returns a URL that the test server rejects with 403, to
// exercise the hub's "re-resolve an expired URL" path.
import fs from 'node:fs';

const args = process.argv.slice(2);
const target = args[args.length - 1];
const out = (o) => process.stdout.write(JSON.stringify(o));
const song = (id, title, artist) => ({ id, title, artists: [artist], duration: 201, thumbnails: [{ url: `https://i.example/${id}.jpg` }] });

if (args.includes('--version')) {
  process.stdout.write('2099.01.01\n');
} else if (target.includes('music.youtube.com/search')) {
  if (target.includes('nothing')) out({ _type: 'playlist', entries: [] });
  else out({ _type: 'playlist', entries: [song('AAAAAAAAAAA', 'Song A', 'Artist A'), song('BBBBBBBBBBB', 'Song B', 'Artist B'), { id: 'UCxxxxxxxxxxxxxxxxxxxxxx', title: 'A channel, not a song' }] });
} else if (target.startsWith('ytsearch')) {
  out({ _type: 'playlist', entries: [song('CCCCCCCCCCC', 'Fallback C', 'Artist C')] });
} else if (args.includes('-f')) {
  const counter = `${process.env.FAKE_STATE}`;
  const n = fs.existsSync(counter) ? Number(fs.readFileSync(counter, 'utf8')) : 0;
  fs.writeFileSync(counter, String(n + 1));
  out({
    id: 'AAAAAAAAAAA',
    title: 'Song A',
    ext: 'webm',
    url: `${process.env.FAKE_MEDIA}/${n === 0 ? 'expired' : 'audio'}?expire=4102444800`,
    http_headers: { 'User-Agent': 'fake-agent' },
  });
} else if (target.includes('list=')) {
  out({ _type: 'playlist', title: 'Road Trip', entries: [song('DDDDDDDDDDD', 'One', 'X'), song('EEEEEEEEEEE', 'Two', 'Y')] });
} else if (target.includes('watch?v=')) {
  out({ ...song('FFFFFFFFFFF', 'Single', 'Solo'), track: 'Single (track)' });
} else {
  process.stderr.write('ERROR: Unsupported URL\n');
  process.exit(1);
}
