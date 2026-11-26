<!-- description: How to get your own free Last.fm API key for Prism (optional), and what Prism's key messages mean. -->
# Getting a Last.fm API key

<p class="lead">Optional. Prism comes with a shared Last.fm key, so you don't need one.</p>

Prism reads genre and mood tags and similar songs from Last.fm. Your own free key is handy if the
shared one is ever busy. It takes about a minute:

1. Sign in to [Last.fm](https://www.last.fm/login) (or [make a free account](https://www.last.fm/join)).
2. Open [last.fm/api/account/create](https://www.last.fm/api/account/create) and fill in the form:
   - **Contact email:** your email
   - **Application name:** anything, for example `Prism`
   - **Application description**, **Callback URL** and **Application homepage:** can stay empty
3. Click **Submit**. The next page shows an **API key** and a **Shared secret**.
4. Copy the **API key** (the Shared secret isn't needed).
5. In Spotify, open Prism's **Settings** (the Settings button on the Prism page, or Spotify's
   profile menu &gt; **Prism settings**), paste the key and click **Test & save**.

Lost the key? Your keys are listed at [last.fm/api/accounts](https://www.last.fm/api/accounts).
The key stays on your computer (in Spotify's local storage) and is never sent anywhere except
Last.fm. Last.fm's API is free for non-commercial use ([terms](https://www.last.fm/api/tos)).

## If Prism says something about your key

| Message | What to do |
| --- | --- |
| "Couldn't get Prism's shared Last.fm access" | Prism couldn't fetch its shared key (offline?): try again, or add your own key. |
| "Prism's shared Last.fm access isn't working right now" | Try again later, or add your own key (steps above). |
| "Last.fm doesn't accept your API key" | The key was mistyped, or the Shared secret was pasted instead: copy the API key again. |
| "Last.fm has suspended your API key" | Make a new key (step 2) and save it in Settings. |
| "Last.fm rate limit hit" | Too many requests at once: wait a minute and try again. |
