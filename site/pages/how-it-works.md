<!-- description: How Prism matches songs: Last.fm tags, lyrics mood, tempo and key, judged song by song. -->
# How songs are matched

<p class="lead">Prism judges every song on its own signals, not on its artist's genres.</p>

| Signal | Weight | Where it comes from |
| --- | --- | --- |
| Genre and mood tags | 60 | Last.fm song tags. Songs without any use their artist's tags at half weight. |
| Lyrics mood | 15 | Lyrics words sorted into 8 moods (love, heartbreak, desire, party…). English only. |
| Tempo (BPM) | 15 | Spotify |
| Musical key | 10 | Spotify (Camelot wheel) |

## Clean tags

Tags are cleaned first: only real genres (the MusicBrainz genre list plus a few extras) and mood
tags are kept, so personal labels like "my top songs" or "saw live" are dropped.

## Remix groups

[Remix](remix.html) groups songs with the same signals. Rare genres count more than ones that are
everywhere, like "pop", and the same input always gives the same groups.
