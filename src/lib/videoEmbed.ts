export type VideoProvider = 'youtube' | 'vimeo' | 'loom';

export interface VideoEmbed {
  provider: VideoProvider;
  embedUrl: string;
}

export function parseVideoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

  // YouTube
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0];
    if (id) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      if (id) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
    }
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}` };
    const embedMatch = parsed.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}` };
  }

  // Vimeo
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const idMatch = parsed.pathname.match(/(\d+)/);
    if (idMatch) return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${idMatch[1]}` };
  }

  // Loom
  if (host === 'loom.com') {
    const m = parsed.pathname.match(/^\/(?:share|embed)\/([a-zA-Z0-9]+)/);
    if (m) return { provider: 'loom', embedUrl: `https://www.loom.com/embed/${m[1]}` };
  }

  return null;
}