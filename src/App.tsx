import { useState, useEffect } from 'react';
import type { PlaylistTrack } from './types';
import {
  initiateSpotifyAuth,
  handleAuthCallback,
  getStoredToken,
  findLiveTrack,
  findCoverTrack,
  createPlaylist,
  addTracksToPlaylist,
} from './spotify';
import { scrapeSetlist } from './setlist';
import './App.css';

type AppState = 'landing' | 'authenticated' | 'loading' | 'done' | 'error';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) return 'loading';
    return getStoredToken() ? 'authenticated' : 'landing';
  });
  const [setlistUrl, setSetlistUrl] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('Connecting to Spotify...');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;

    handleAuthCallback(code)
      .then(() => {
        window.history.replaceState({}, '', window.location.pathname);
        setAppState('authenticated');
      })
      .catch((err: Error) => {
        setError(err.message);
        setAppState('error');
      });
  }, []);

  const handleSetMeUp = async () => {
    if (!setlistUrl.trim()) return;

    setLoadingMessage('Building your playlist...');
    setAppState('loading');

    try {
      const setlist = await scrapeSetlist(setlistUrl);
      const playlistName = `${setlist.artist} set from ${setlist.date}`;
      const playlistId = await createPlaylist(playlistName);

      const resolvedTracks: PlaylistTrack[] = [];
      const uris: string[] = [];

      for (const track of setlist.tracks) {
        let spotifyTrack = null;

        if (track.isCover && track.coverOriginalArtist) {
          spotifyTrack = await findCoverTrack(
            track.name,
            setlist.artist,
            track.coverOriginalArtist,
          );
        } else {
          spotifyTrack = await findLiveTrack(track.name, setlist.artist);
        }

        resolvedTracks.push({ setlistTrack: track, spotifyTrack });
        if (spotifyTrack) uris.push(spotifyTrack.uri);
      }

      if (uris.length > 0) {
        await addTracksToPlaylist(playlistId, uris);
      }

      setTracks(resolvedTracks);
      setPlaylistUrl(`https://open.spotify.com/playlist/${playlistId}`);
      setAppState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setAppState('error');
    }
  };

  if (appState === 'landing') {
    return (
      <div className="app landing">
        <div className="landing-content">
          <h1 className="app-title">Set Me Up!</h1>
          <p className="app-tagline">
            Create a Spotify playlist based on a live show set list from setlist.fm
          </p>
          <button className="btn btn-spotify" onClick={initiateSpotifyAuth}>
            Authenticate with Spotify
          </button>
        </div>
      </div>
    );
  }

  if (appState === 'loading') {
    return (
      <div className="app loading">
        <img src="/record.jpeg" alt="Loading" className="record-spin" />
        <p className="loading-msg">{loadingMessage}</p>
      </div>
    );
  }

  if (appState === 'error') {
    return (
      <div className="app error-state">
        <div className="error-content">
          <h1 className="app-title">Set Me Up!</h1>
          <p className="error-msg">{error}</p>
          <button className="btn btn-secondary" onClick={() => setAppState('authenticated')}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (appState === 'done') {
    return (
      <div className="app done">
        <h1 className="app-title">Set Me Up!</h1>
        <a
          className="btn btn-spotify playlist-link"
          href={playlistUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open Playlist on Spotify ↗
        </a>
        <div className="track-list">
          <h2>Track Listing</h2>
          <ol>
            {tracks.map((track, i) => (
              <li key={i} className={track.spotifyTrack ? 'found' : 'skipped'}>
                <div className="track-primary">
                  <span className="track-name">{track.setlistTrack.name}</span>
                  {track.setlistTrack.isCover && (
                    <span className="badge badge-cover">cover</span>
                  )}
                  {!track.spotifyTrack && (
                    <span className="badge badge-missing">not on Spotify</span>
                  )}
                </div>
                {track.spotifyTrack && (
                  <div className="track-secondary">
                    {track.spotifyTrack.name}
                    {' — '}
                    <em>{track.spotifyTrack.album}</em>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <button
            className="btn btn-secondary try-another"
            onClick={() => {
              setSetlistUrl('');
              setPlaylistUrl('');
              setTracks([]);
              setAppState('authenticated');
            }}
          >
            Create Another Playlist
          </button>
        </div>
      </div>
    );
  }

  // authenticated state
  return (
    <div className="app authenticated">
      <h1 className="app-title">Set Me Up!</h1>
      <div className="input-section">
        <label htmlFor="setlist-url" className="input-label">
          Paste a setlist.fm URL
        </label>
        <input
          id="setlist-url"
          type="url"
          className="url-input"
          value={setlistUrl}
          onChange={(e) => setSetlistUrl(e.target.value)}
          placeholder="https://www.setlist.fm/setlist/pearl-jam/2024/wrigley-field-chicago-il-5baa4330.html"
        />
        <button
          className="btn btn-spotify"
          onClick={handleSetMeUp}
          disabled={!setlistUrl.trim()}
        >
          Set me up!
        </button>
      </div>
    </div>
  );
}
