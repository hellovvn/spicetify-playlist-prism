// "Grow a playlist" start screen: pick the seed song (the one playing now,
// or a pasted link) or (2026-11-26) one of your playlists as the seed. Opened by the start page's Grow tile. The layout is the
// shared SongPick screen (also used by Add a song to your playlists).

import React from "react";
import { SongPick, type PlayingSong } from "./SongPick";
import { getSources } from "../spotify/read";
import { isPlaylistUri } from "../nav";
import type { SourceOption } from "../sources/sources";

interface GrowStartProps {
  playing: PlayingSong | null;
  onStart: (seed: string) => void;
  onHome: () => void;
}

export function GrowStart({ playing, onStart, onHome }: GrowStartProps) {
  // The user's playlists for the "One of your playlists" row (Liked Songs left out).
  const [playlists, setPlaylists] = React.useState<SourceOption[] | null>(null);
  React.useEffect(() => {
    let closed = false;
    getSources()
      .then((all) => !closed && setPlaylists(all.filter((source) => isPlaylistUri(source.uri))))
      .catch((error) => {
        console.warn("[Prism] couldn't list playlists for Grow", error);
        if (!closed) setPlaylists([]);
      });
    return () => {
      closed = true;
    };
  }, []);
  return (
    <SongPick
      id="grow"
      title="Grow a playlist"
      intro="Start with a favourite song, or a whole playlist, and grow a playlist of songs that feel like it."
      hint={'Tip: right-click a song and choose "Grow a playlist with Prism", or a playlist and choose "Grow from this playlist".'}
      nextLabel="Next: pick playlists"
      playing={playing}
      onPick={onStart}
      onBack={onHome}
      playlists={playlists}
    />
  );
}
