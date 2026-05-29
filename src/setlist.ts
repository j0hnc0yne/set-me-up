import type { Setlist, SetlistTrack } from './types';

function extractSetlistId(url: string): string {
  const match = url.match(/([a-f0-9]+)\.html$/i);
  if (!match) {
    throw new Error('Could not find a setlist ID in that URL. Make sure it\'s a direct setlist link from setlist.fm.');
  }
  return match[1];
}

function convertDate(ddMMYYYY: string): string {
  const [dd, mm, yyyy] = ddMMYYYY.split('-');
  return `${yyyy}-${mm}-${dd}`;
}

interface ApiArtist {
  name: string;
}

interface ApiSong {
  name: string;
  tape?: boolean;
  cover?: ApiArtist;
}

interface ApiSet {
  song?: ApiSong[];
}

interface ApiSetlist {
  artist: ApiArtist;
  eventDate: string; // dd-MM-yyyy
  sets: { set: ApiSet[] };
}

export async function fetchSetlist(url: string): Promise<Setlist> {
  const id = extractSetlistId(url);

  const apiKey = import.meta.env.VITE_SETLIST_FM_API_KEY;
  if (!apiKey) throw new Error('VITE_SETLIST_FM_API_KEY is not set in your .env.local file.');

  const response = await fetch(`/setlist-api/rest/1.0/setlist/${id}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
  });

  if (response.status === 401) {
    throw new Error('Invalid setlist.fm API key — check VITE_SETLIST_FM_API_KEY in .env.local.');
  }
  if (response.status === 404) {
    throw new Error('Setlist not found. Double-check the URL.');
  }
  if (!response.ok) {
    throw new Error(`setlist.fm API error (${response.status})`);
  }

  const data = await response.json() as ApiSetlist;

  const artist = data.artist.name;
  const date = convertDate(data.eventDate);

  const tracks: SetlistTrack[] = data.sets.set
    .flatMap((s) => s.song ?? [])
    .filter((song) => !song.tape)
    .map((song): SetlistTrack => ({
      name: song.name,
      isCover: Boolean(song.cover),
      coverOriginalArtist: song.cover?.name,
    }));

  if (tracks.length === 0) {
    throw new Error('This setlist has no songs yet — it may not have been filled in.');
  }

  return { artist, date, tracks };
}
