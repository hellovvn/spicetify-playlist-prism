// "Grow a playlist" start screen: pick the seed song (the one playing now,
// or a pasted link). Opened by the start page's Grow tile. The layout is the
// shared SongPick screen (also used by Add a song to your playlists).

import React from "react";
import { SongPick, type PlayingSong } from "./SongPick";

interface GrowStartProps {
  playing: PlayingSong | null;
  onStart: (seed: string) => void;
  onHome: () => void;
}

export function GrowStart({ playing, onStart, onHome }: GrowStartProps) {
  return (
    <SongPick
      id="grow"
      title="Grow a playlist"
      intro="Start with a favourite song and grow a playlist of songs that feel like it."
      hint={'Tip: right-click any song in Spotify and choose "Grow a playlist with Prism".'}
      nextLabel="Next: pick playlists"
      playing={playing}
      onPick={onStart}
      onBack={onHome}
    />
  );
}
