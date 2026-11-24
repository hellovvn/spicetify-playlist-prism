// Spotify search, READ-ONLY (used by DISCOVER to find Last.fm's similar songs).
//
// Uses the same internal GraphQL query as the Spotify app's search box
// ("searchModalResults"), not the Web API (which answers 429). Checked
// 2026-11-23: the other search definitions (queryInlineCurationSearchV2,
// assistedCurationSearch) fail with HttpResponseError. Undocumented, so all
// of it stays in this one file.

import type { FoundTrack } from "../discover/discover";

export async function searchTracks(term: string): Promise<FoundTrack[]> {
  const res = await Spicetify.GraphQL.Request(Spicetify.GraphQL.Definitions.searchModalResults, {
    searchTerm: term,
    offset: 0,
    limit: 10,
    numberOfTopResults: 10,
    includeAudiobooks: false,
    includePreReleases: false,
    includeLocalConcertsField: false,
    includeAuthors: false,
  });
  return parseSearchTracks(res);
}

// res.data.searchV2.topResultsV2.itemsV2[].item.data with __typename "Track".
// PURE, tested in tests/discover.test.ts.
export function parseSearchTracks(res: any): FoundTrack[] {
  const items: any[] = res?.data?.searchV2?.topResultsV2?.itemsV2 ?? [];
  const tracks: FoundTrack[] = [];
  for (const entry of items) {
    const data = entry?.item?.data;
    if (data?.__typename !== "Track" || typeof data.uri !== "string" || typeof data.name !== "string") continue;
    const artists = (data.artists?.items ?? []).map((a: any) => a?.profile?.name).filter(Boolean);
    const sources: any[] = data.albumOfTrack?.coverArt?.sources ?? [];
    const bySize = (size: number) => sources.find((s) => s?.width === size)?.url;
    tracks.push({
      uri: data.uri,
      name: data.name,
      artists,
      ...(bySize(300) ? { cover: bySize(300) } : {}),
      ...(bySize(64) ? { coverSmall: bySize(64) } : {}),
    });
  }
  return tracks;
}
