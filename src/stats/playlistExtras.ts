// Extra playlist stats worked out LIVE from the playlist itself (read-only),
// so they work for every playlist, including ones made before they existed:
//   - artists: how many different artists, and who appears most
//   - eras: songs per decade, plus the oldest and newest release
//   - key: how many songs are in a major vs a minor key, and the most common key
// PURE (tested in tests/playlistExtras.test.ts). The data is loaded by
// loadPlaylistExtras in src/flow.ts and shown by src/ui/ExtraStats.tsx.

export interface ExtraSong {
  name: string;
  artists: string[]; // all credited artists
  year?: number; // release year, when Spotify says
  key?: string; // root note, e.g. "G", when known
  mode?: "major" | "minor";
}

export interface NamedYear {
  name: string;
  year: number;
}

export interface PlaylistExtras {
  songCount: number;
  artistCount: number; // different artists across all songs (features included)
  topArtists: [string, number][]; // most songs first (at most 5)
  decades: [string, number][]; // "1990s" -> songs, oldest decade first
  oldest: NamedYear | null;
  newest: NamedYear | null;
  major: number; // songs in a major key
  minor: number; // songs in a minor key
  topKey: string | null; // most common key, e.g. "G minor"
}

// Counts how often each text appears; most common first, ties alphabetical.
function countUp(values: string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function playlistExtras(songs: ExtraSong[]): PlaylistExtras {
  // Artists: each artist counts once per song (a song by "A feat. A" is one).
  const artistNames: string[] = [];
  for (const song of songs) artistNames.push(...new Set(song.artists));
  const artists = countUp(artistNames);

  // Eras: only sensible years (Spotify sometimes says 0 or the far future).
  const thisYear = new Date().getFullYear();
  const dated = songs.filter((song): song is ExtraSong & { year: number } =>
    typeof song.year === "number" && song.year >= 1900 && song.year <= thisYear + 1
  );
  const decades = countUp(dated.map((song) => `${Math.floor(song.year / 10) * 10}s`)).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  let oldest: NamedYear | null = null;
  let newest: NamedYear | null = null;
  for (const song of dated) {
    if (!oldest || song.year < oldest.year) oldest = { name: song.name, year: song.year };
    if (!newest || song.year > newest.year) newest = { name: song.name, year: song.year };
  }

  // Key: major vs minor, and the most common key ("G minor").
  const keyed = songs.filter((song) => song.mode === "major" || song.mode === "minor");
  const keys = countUp(keyed.filter((song) => song.key).map((song) => `${song.key} ${song.mode}`));

  return {
    songCount: songs.length,
    artistCount: artists.length,
    topArtists: artists.slice(0, 5),
    decades,
    oldest,
    newest,
    major: keyed.filter((song) => song.mode === "major").length,
    minor: keyed.filter((song) => song.mode === "minor").length,
    topKey: keys[0]?.[0] ?? null,
  };
}

// "2023-05-12T00:00:00.000Z" -> 2023 (undefined if missing or odd).
export function yearFromRelease(iso: unknown): number | undefined {
  if (typeof iso !== "string") return undefined;
  const year = Number(iso.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : undefined;
}
