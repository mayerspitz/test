# Hub API reference

The web app uses this API, and anything else can too: your own mobile app, a home-automation system, or a shortcut on your phone.

- **Base URL:** `http://<hub>:8080`
- **Auth:** when the hub has `MULTIROOM_TOKEN` set, send `Authorization: Bearer <token>`. For `<img>`/`<audio>` tags or WebSocket URLs, add `?token=<token>` instead.
- **Format:** JSON in, JSON out. Errors look like `{ "error": "message" }` with a 4xx/5xx status.

## Speakers (zones)

A zone is one speaker. Every command answers with the updated zone.

```jsonc
{
  "id": "kitchen", "name": "Kitchen",
  "online": true,                    // the bridge is connected to the hub
  "speaker": {                       // null = bridge uses a wired/default output
    "connected": true, "name": "JBL Flip 6", "battery": 84,
    "address": "F8:DF:15:12:34:56", "adapter": "hci0", "paired": true,
    "message": null                  // e.g. "Speaker is off or out of range — retrying"
  },
  "state": "playing",                // what you asked for: playing | paused | stopped
  "playback": "playing",             // what the bridge reports: playing | paused | loading | idle
  "volume": 55,                      // 0-100, software volume of this stream only
  "position": 17.2, "duration": 95,  // seconds
  "current": { "uid": "q…", "kind": "track", "title": "…", "artist": "…", "artwork": "/api/library/tracks/…/cover" },
  "next": { … } | null,
  "index": 0, "queueLength": 5, "queueVersion": 7,
  "repeat": "off", "shuffle": false,
  "error": null, "lastSeen": 1790000000000,
  "bridge": { "host": "bridge-kitchen", "version": "0.1.0", "player": "mpv", "address": "192.168.1.31" }
}
```

| Method & path | Body | Does |
|---|---|---|
| `GET /api/zones` | | All speakers |
| `GET /api/zones/:id` | | One speaker |
| `PATCH /api/zones/:id` | `{ "name": "Patio" }` | Rename |
| `DELETE /api/zones/:id` | | Forget a speaker whose bridge is offline |
| `POST /api/zones/:id/play` | see below | Play or queue music |
| `POST /api/zones/:id/pause` · `resume` · `toggle` · `stop` · `next` · `previous` | | Transport controls |
| `POST /api/zones/:id/seek` | `{ "position": 42 }` | Seek (seconds) |
| `PUT /api/zones/:id/volume` | `{ "volume": 35 }` | Stream volume 0–100 (never the speaker's own volume) |
| `PUT /api/zones/:id/mode` | `{ "repeat": "off|all|one", "shuffle": true }` | Repeat / shuffle |
| `POST /api/zones/:id/bluetooth/reconnect` | | Ask the bridge to reconnect its speaker now |
| `GET /api/zones/:id/queue` | | `{ index, queueVersion, items: [...] }` |
| `POST /api/zones/:id/queue/jump` | `{ "index": 3 }` | Play that queue entry |
| `POST /api/zones/:id/queue/move` | `{ "from": 5, "to": 1 }` | Reorder |
| `DELETE /api/zones/:id/queue/:index` | | Remove one entry |
| `DELETE /api/zones/:id/queue` | | Clear the queue and stop |
| `POST /api/zones/pause-all` · `stop-all` | | Every speaker |

### `POST /api/zones/:id/play`

```jsonc
{
  "items": [ /* one or more of: */
    { "kind": "collection", "name": "Kitchen player" },          // a whole collection, in folder order
    { "kind": "track", "id": "40e7118317feaa58" },               // one library track
    { "kind": "youtube", "id": "dQw4w9WgXcQ", "title": "…", "artist": "…", "duration": 213 },
    { "kind": "url", "url": "https://stream.example/radio.mp3", "title": "My radio" }  // any http(s) audio
  ],
  "mode": "replace",   // replace (default) | now (play immediately, keep the queue) | next | append
  "startIndex": 0,     // replace: which item to start with
  "shuffle": false     // replace: shuffle play (the chosen startIndex, if any, plays first)
}
```

`kind: "url"` is the hook for your own app. It plays any HTTP(S) audio file or stream, such as internet radio or media served by your own server.

## Playlists (mixed: library + YouTube + links)

| Method & path | Body | Does |
|---|---|---|
| `GET /api/playlists` | | `[{ id, name, count, duration, kinds, artwork }]` |
| `POST /api/playlists` | `{ "name": "Friday", "items": [ …same item shapes as play… ] }` | Create (items optional) |
| `GET /api/playlists/:pid` | | `{ id, name, items: [{ kind, ref, title, artist, duration, artwork }] }` |
| `PATCH /api/playlists/:pid` | `{ "name": "…" }` | Rename |
| `DELETE /api/playlists/:pid` | | Delete the playlist (never the songs) |
| `POST /api/playlists/:pid/items` | `{ "items": [...], "position": 3 }` | Add songs, collections, YouTube songs or whole YouTube playlists (resolve first), links, even other playlists |
| `POST /api/playlists/:pid/items/move` | `{ "from": 5, "to": 0 }` | Reorder |
| `DELETE /api/playlists/:pid/items/:index` | | Remove one entry |
| `POST /api/zones/:id/queue/save` | `{ "name": "…" }` | Save a speaker's current queue as a playlist |

Play a playlist with `{ "kind": "playlist", "id": "pl…" }` in `POST /api/zones/:id/play`. It works with `mode` (`replace` / `now` / `next` / `append`), `startIndex` and `shuffle`. Queues and playlists can mix every kind freely.

**Play a YouTube Music playlist link:** `POST /api/youtube/resolve {"url": "<playlist link>"}` returns its songs. Send them to `/play` to play now, or with `"mode": "append"` to add them to the queue. The app's YouTube tab does exactly this.

## Library

| Method & path | Does |
|---|---|
| `GET /api/library/collections` | `[{ name, tracks, duration, cover }]` |
| `GET /api/library/tracks?collection=&q=&limit=&offset=` | `{ total, items: [{ id, title, artist, album, duration, collection, path, hasCover, … }] }` |
| `GET /api/library/tracks/:id` | One track |
| `GET /api/library/tracks/:id/cover` | Album art (image) |
| `POST /api/library/upload?collection=Name` | `multipart/form-data`, one or more `files` parts. Filenames may include folders (`Album/01 Song.mp3`). Answers `{ collection, saved: [ids], skipped: [{name, reason}] }` |
| `POST /api/library/rescan` | Re-index the library folder after copying files in directly |
| `DELETE /api/library/tracks/:id` · `DELETE /api/library/collections/:name` | Delete files from the hub |
| `GET /media/tracks/:id` | The audio file itself (supports HTTP Range) |

## YouTube Music

| Method & path | Does |
|---|---|
| `GET /api/youtube/status` | `{ available, version }` (yt-dlp on the hub) |
| `GET /api/youtube/search?q=…&limit=20` | Songs from YouTube Music search, `[{ kind:"youtube", id, title, artist, album, duration, artwork }]` |
| `POST /api/youtube/resolve` `{ "url": "…" }` | A song, album or playlist link (or an 11-character video id) → `{ title, items }` |
| `GET /media/youtube/:id` | The audio, proxied through the hub (supports HTTP Range) |

## Live updates: WebSocket `/ws/ui`

Connect to `ws://<hub>:8080/ws/ui?token=<token>`. You receive:

- `{ "type": "snapshot", "zones": [ …all zones… ], "version": "0.1.0" }` on connect
- `{ "type": "zone", "zone": { … } }` whenever a speaker changes (at most every 200 ms per zone; position updates about once a second while playing)
- `{ "type": "zone-removed", "id": "…" }`
- `{ "type": "library" }` when the library changed, so refetch collections

Between `zone` messages, a client can extrapolate `position` while `state` and `playback` are both `"playing"`.

## Examples

```bash
H='Authorization: Bearer YOUR_TOKEN'
# Play the Patio collection shuffled on the patio speaker, at volume 40
curl -H "$H" -H 'Content-Type: application/json' -X POST http://audiohub.local:8080/api/zones/patio/play \
     -d '{"items":[{"kind":"collection","name":"Patio player"}],"shuffle":true}'
curl -H "$H" -H 'Content-Type: application/json' -X PUT http://audiohub.local:8080/api/zones/patio/volume -d '{"volume":40}'
# Internet radio in the kitchen
curl -H "$H" -H 'Content-Type: application/json' -X POST http://audiohub.local:8080/api/zones/kitchen/play \
     -d '{"items":[{"kind":"url","url":"https://example.com/stream.mp3","title":"Radio"}]}'
# Everything off at night
curl -H "$H" -X POST http://audiohub.local:8080/api/zones/pause-all
```

## Bridge protocol (for reference)

Bridges connect to `ws://<hub>/ws/agent` with the same token, and send `hello`, `status`, `ended` and `restarted` messages. The hub sends `load`, `sync`, `pause`, `resume`, `stop`, `seek`, `volume` and `bt-reconnect`. See `hub/src/zones.js` and `agent/src/agent.js`.

The hub owns every queue. A bridge is a thin player, so a bridge or the hub can restart mid-song without the music stopping.
