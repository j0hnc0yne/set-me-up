import type { SpotifyToken, SpotifyTrack } from './types';

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1';
const SCOPES = 'playlist-modify-public playlist-modify-private';
const TOKEN_KEY = 'spotify_token';
const VERIFIER_KEY = 'pkce_verifier';

function getClientId(): string {
  const id = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  if (!id) throw new Error('VITE_SPOTIFY_CLIENT_ID is not set');
  return id;
}

function getRedirectUri(): string {
  return import.meta.env.VITE_REDIRECT_URI ?? window.location.origin;
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join('');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function initiateSpotifyAuth(): Promise<void> {
  const verifier = generateRandomString(128);
  const challenge = await generateCodeChallenge(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    scope: SCOPES,
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });

  window.location.href = `${SPOTIFY_AUTH_URL}?${params}`;
}

export async function handleAuthCallback(code: string): Promise<void> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!verifier) throw new Error('No PKCE verifier found — please try authenticating again');

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
      client_id: getClientId(),
      code_verifier: verifier,
    }),
  });

  if (!response.ok) throw new Error('Failed to exchange authorization code for token');

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const token: SpotifyToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  sessionStorage.removeItem(VERIFIER_KEY);
}

export function getStoredToken(): SpotifyToken | null {
  const stored = sessionStorage.getItem(TOKEN_KEY);
  if (!stored) return null;
  const token = JSON.parse(stored) as SpotifyToken;
  if (Date.now() > token.expiresAt) return null;
  return token;
}

async function refreshAccessToken(refreshToken: string): Promise<SpotifyToken> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: getClientId(),
    }),
  });

  if (!response.ok) throw new Error('Session expired — please authenticate again');

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const token: SpotifyToken = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

async function getValidAccessToken(): Promise<string> {
  const stored = sessionStorage.getItem(TOKEN_KEY);
  if (!stored) throw new Error('Not authenticated');

  let token = JSON.parse(stored) as SpotifyToken;
  if (Date.now() > token.expiresAt - 60_000) {
    token = await refreshAccessToken(token.refreshToken);
  }
  return token.accessToken;
}

async function spotifyFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = await getValidAccessToken();
  return fetch(`${SPOTIFY_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

interface SpotifySearchItem {
  uri: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string };
}

interface SpotifySearchResponse {
  tracks: { items: SpotifySearchItem[] };
}

async function searchSpotify(query: string): Promise<SpotifyTrack | null> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: '5' });
  const response = await spotifyFetch(`/search?${params}`);
  if (!response.ok) return null;

  const data = await response.json() as SpotifySearchResponse;
  const items = data.tracks.items;
  if (items.length === 0) return null;

  const item = items[0];
  return {
    uri: item.uri,
    name: item.name,
    artists: item.artists.map((a) => a.name),
    album: item.album.name,
  };
}

export async function findLiveTrack(trackName: string, artist: string): Promise<SpotifyTrack | null> {
  const live = await searchSpotify(`${trackName} ${artist} live`);
  if (live) return live;
  return searchSpotify(`${trackName} ${artist}`);
}

export async function findCoverTrack(
  trackName: string,
  coveringArtist: string,
  originalArtist: string,
): Promise<SpotifyTrack | null> {
  const liveCover = await searchSpotify(`${trackName} ${coveringArtist} live`);
  if (liveCover) return liveCover;

  const anyCover = await searchSpotify(`${trackName} ${coveringArtist}`);
  if (anyCover) return anyCover;

  return searchSpotify(`${trackName} ${originalArtist}`);
}

export async function createPlaylist(name: string): Promise<string> {
  const meResponse = await spotifyFetch('/me');
  if (!meResponse.ok) throw new Error('Failed to get Spotify user profile');
  const me = await meResponse.json() as { id: string };

  const response = await spotifyFetch(`/users/${me.id}/playlists`, {
    method: 'POST',
    body: JSON.stringify({ name, public: true }),
  });
  if (!response.ok) throw new Error('Failed to create Spotify playlist');

  const data = await response.json() as { id: string };
  return data.id;
}

export async function addTracksToPlaylist(playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const response = await spotifyFetch(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris: batch }),
    });
    if (!response.ok) throw new Error('Failed to add tracks to playlist');
  }
}
