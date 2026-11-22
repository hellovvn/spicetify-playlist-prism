// The REAL Last.fm fetchers for getSongTags (unit tests pass fakes instead).
// `wait` (optional) is a rate limiter: awaited before every request.

import { getArtistTopTags, getTrackTopTags } from "./client";
import type { TagFetchers } from "../tags/getSongTags";

export function lastfmFetchers(apiKey: string, wait: () => Promise<void> = async () => {}): TagFetchers {
  return {
    fetchTrackTags: async (artist, title) => {
      await wait();
      return (await getTrackTopTags(artist, title, apiKey)).tags;
    },
    fetchArtistTags: async (artist) => {
      await wait();
      return getArtistTopTags(artist, apiKey);
    },
  };
}
