import type { Setlist, SetlistTrack } from './types';

const CORS_PROXY = 'https://api.allorigins.win/get?url=';

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractArtistFromUrl(url: string): string {
  const match = url.match(/setlist\.fm\/setlist\/([^/]+)\//);
  return match ? slugToName(match[1]) : 'Unknown Artist';
}

function extractYearFromUrl(url: string): string {
  const match = url.match(/setlist\.fm\/setlist\/[^/]+\/(\d{4})\//);
  return match ? match[1] : '';
}

interface JsonLdEvent {
  '@type'?: string;
  startDate?: string;
  performer?: { name?: string } | Array<{ name?: string }>;
}

function parseJsonLd(doc: Document): { artist?: string; date?: string } {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent ?? '') as JsonLdEvent | JsonLdEvent[];
      const events = Array.isArray(parsed) ? parsed : [parsed];
      for (const event of events) {
        if (event['@type'] === 'MusicEvent' || event['@type'] === 'Event') {
          const date = typeof event.startDate === 'string'
            ? event.startDate.substring(0, 10)
            : undefined;

          let artist: string | undefined;
          if (event.performer) {
            const performer = Array.isArray(event.performer)
              ? event.performer[0]
              : event.performer;
            if (typeof performer?.name === 'string') artist = performer.name;
          }

          if (date || artist) return { artist, date };
        }
      }
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return {};
}

function parseTracks(doc: Document): SetlistTrack[] {
  const songEls = Array.from(doc.querySelectorAll('li.setlistParts.song'));
  const tracks: SetlistTrack[] = [];

  for (const li of songEls) {
    const songLabel = li.querySelector('a.songLabel');
    if (!songLabel) continue;

    const name = songLabel.textContent?.trim();
    if (!name) continue;

    const liText = li.textContent ?? '';
    const coverMatch = liText.match(/\(([^)]+?)\s+cover\)/i);

    if (coverMatch) {
      tracks.push({
        name,
        isCover: true,
        coverOriginalArtist: coverMatch[1].trim(),
      });
    } else {
      tracks.push({ name, isCover: false });
    }
  }

  return tracks;
}

export async function scrapeSetlist(url: string): Promise<Setlist> {
  const proxyUrl = `${CORS_PROXY}${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error('Failed to fetch the setlist page. Check your URL and try again.');

  const data = await response.json() as { contents: string };
  const html = data.contents;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const { artist: jsonArtist, date: jsonDate } = parseJsonLd(doc);

  const artist = jsonArtist ?? extractArtistFromUrl(url);
  const date = jsonDate ?? extractYearFromUrl(url);

  const tracks = parseTracks(doc);

  if (tracks.length === 0) {
    throw new Error('No tracks found in that setlist. Please check the URL and try again.');
  }

  return { artist, date, tracks };
}
