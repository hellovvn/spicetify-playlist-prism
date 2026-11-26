// The "Support Prism" button in Settings > About links to the developer's Ko-fi page.
// Only a plain link: no Ko-fi script is ever loaded inside Spotify, so nothing is sent
// to Ko-fi unless someone clicks it.

// The developer's Ko-fi username (ko-fi.com/<username>). While empty, no button is shown.
export const KOFI_USERNAME = "hellovvn";

// The Ko-fi page to open, or null when no username is set yet.
export function kofiUrl(username: string = KOFI_USERNAME): string | null {
  const name = username.trim();
  if (!/^[A-Za-z0-9_]+$/.test(name)) return null;
  return `https://ko-fi.com/${name}`;
}
