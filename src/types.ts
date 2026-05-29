export interface SetlistTrack {
  name: string;
  isCover: boolean;
  coverOriginalArtist?: string;
}

export interface Setlist {
  artist: string;
  date: string; // YYYY-MM-DD or YYYY if only year available
  tracks: SetlistTrack[];
}

export interface SpotifyToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: string[];
  album: string;
}

export interface PlaylistTrack {
  setlistTrack: SetlistTrack;
  spotifyTrack: SpotifyTrack | null;
}
