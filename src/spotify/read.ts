// Read-only helpers for getting data from Spotify.
// Nothing in this file changes anything in the user's account.

// The small set of song details we need. Spotify returns much more,
// but keeping our own type makes the rest of the code simpler to read.
export interface TrackInfo {
  uri: string; // e.g. "spotify:track:4uLU6hMCjMI75M1A2tKUQC"
  id: string; // the last part of the URI
  name: string; // song title, e.g. "Never Gonna Give You Up"
  artists: string[]; // all credited artists, main artist first
  album: string;
}

// Get a song's details from its Spotify URI.
//
// Why GraphQL and not the Web API (api.spotify.com/v1/tracks/{id})?
// We tried the Web API first and Spotify answered "429 Too Many Requests"
// even for a single call: requests sent that way share a heavily limited
// budget. Spicetify.GraphQL uses the same internal queries the Spotify app
// itself uses to show song pages, so it isn't affected.
export async function getTrackInfo(uri: string): Promise<TrackInfo> {
  const id = uri.split(":")[2];
  const res = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.getTrack, { uri });

  // The useful data lives under res.data.trackUnion. The "?." (optional
  // chaining) returns undefined instead of crashing if any level is missing.
  const track = res?.data?.trackUnion;

  // Check the response looks like a track before using it. If Spotify sent
  // an error or changed the response shape, include the raw response in the
  // error so the real cause is visible in the console.
  if (!track || typeof track.name !== "string") {
    throw new Error(`Unexpected response for track ${id}: ${JSON.stringify(res).slice(0, 500)}`);
  }

  // Spotify splits artists into the main ("first") artist and the others.
  const firstArtists: string[] = (track.firstArtist?.items ?? []).map((a: any) => a?.profile?.name);
  const otherArtists: string[] = (track.otherArtists?.items ?? []).map((a: any) => a?.profile?.name);
  // filter(Boolean) drops any empty/undefined names.
  const artists = [...firstArtists, ...otherArtists].filter(Boolean);

  return {
    uri,
    id,
    name: track.name,
    artists,
    album: track.albumOfTrack?.name ?? "",
  };
}
