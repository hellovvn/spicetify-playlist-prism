<!-- description: What Prism changes in your Spotify library, and what it never touches. -->
# What Prism changes

<p class="lead">Prism only writes to Spotify when you click a button that says so.</p>

| You click | What happens |
| --- | --- |
| **Create** ([Grow](grow.html), [Remix](remix.html)) | A **new** playlist is made and filled. |
| **Merge** | A **new** playlist is made. If "Rename the originals" is on, your own originals get "[merged] " in front of their name. Their songs, order, cover and description are never touched. |
| **Add with Prism** | One song is added to the end of the playlist you picked. |

Prism never deletes playlists and never removes or reorders songs. Tones, themes, stats and settings
are stored only on your computer. All write calls live in one file (`src/spotify/write.ts`), and a
unit test fails if one shows up anywhere else.

## Privacy

- If you add your own Last.fm API key, it's stored only in Spotify on your computer.
- Without one, Prism asks its small relay for Prism's shared Last.fm key once per Spotify start.
- Song titles and artists are sent to Last.fm to look up tags and similar songs.
- Lyrics are read to work out a mood profile. The lyrics themselves are never stored.
