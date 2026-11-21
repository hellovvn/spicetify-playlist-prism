// BPM (tempo) and musical key for songs, from the Spotify client itself.
//
// READ-ONLY. This uses an INTERNAL, undocumented part of the Spotify app
// (found in the step-4c spike by watching what Spotify's own
// "Recommended" list calls). A Spotify update could change it, so it lives
// only in this file: if it breaks, this is the one place to fix.
//
// The raw answer for one song looks like:
//   { bpm: 133.365, key: { key: "G", mode: 1, camelotKey: { value: "6A", color: "#ffadb9" } } }

// The "kind" of extra data we ask Spotify for. 222 = AUDIO_ATTRIBUTES_V2.
const AUDIO_ATTRIBUTES_KIND = 222;
// Ask for at most this many songs per request (keeps each request small).
const BATCH_SIZE = 100;

export interface AudioAttributes {
  bpm: number; // beats per minute, e.g. 133.365
  key: string; // root note, e.g. "G", "A#"
  mode: "major" | "minor";
  camelot: string; // DJ "Camelot wheel" code, e.g. "6A" (used for key matching later)
}

// Camelot codes are 1-12 followed by A (minor) or B (major).
const CAMELOT = /^(1[0-2]|[1-9])([AB])$/;

// PURE: turns Spotify's raw answer into AudioAttributes, or null if anything
// is missing or odd (podcasts, local files, or a changed format).
//
// Why take minor/major from the Camelot letter and not from `mode`?
// Spotify's mode number is 1 = minor, 2 = major here, the opposite of the
// usual music-data convention (1 = major). The letter is unambiguous.
export function parseAudioAttributes(raw: unknown): AudioAttributes | null {
  const data = raw as any; // `any`: we check every field by hand below
  const bpm = data?.bpm;
  const key = data?.key?.key;
  const camelot = data?.key?.camelotKey?.value;

  if (typeof bpm !== "number" || !Number.isFinite(bpm) || bpm <= 0) return null;
  if (typeof key !== "string" || key === "") return null;
  if (typeof camelot !== "string") return null;
  const match = CAMELOT.exec(camelot);
  if (!match) return null;

  return { bpm, key, mode: match[2] === "A" ? "minor" : "major", camelot };
}

// PURE: short human-readable text, e.g. "133 BPM, G minor (6A)".
export function formatAudio(audio: AudioAttributes | null): string {
  if (!audio) return "no BPM/key";
  return `${Math.round(audio.bpm)} BPM, ${audio.key} ${audio.mode} (${audio.camelot})`;
}

// Gets BPM/key for many songs. Returns a Map: song URI -> attributes, or
// null for songs Spotify has no data for. Never throws for one bad song.
export async function getAudioAttributes(uris: string[]): Promise<Map<string, AudioAttributes | null>> {
  const metadata = (Spicetify.Platform as any)?.PlaylistAPI?._metadataExtensionsAPI;
  if (typeof metadata?.fetch !== "function") {
    throw new Error("Spotify's BPM/key lookup isn't available (Spotify may have changed it)");
  }

  const result = new Map<string, AudioAttributes | null>();
  for (let start = 0; start < uris.length; start += BATCH_SIZE) {
    const batch = uris.slice(start, start + BATCH_SIZE);
    // fetch takes one [uri, kind] pair per song, as separate arguments.
    const answer = await metadata.fetch(...batch.map((uri) => [uri, AUDIO_ATTRIBUTES_KIND]));
    for (const uri of batch) {
      result.set(uri, parseAudioAttributes(answer?.[uri]?.[AUDIO_ATTRIBUTES_KIND]));
    }
  }
  return result;
}
