import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export const runtime = 'nodejs';

function extractYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&\n?#]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function normalizeTranscript(raw) {
  return raw.map((entry) => {
    const startSeconds = typeof entry.offset === 'number' ? entry.offset : (typeof entry.start === 'number' ? entry.start : 0);
    const durationSeconds = typeof entry.duration === 'number' ? entry.duration : (typeof entry.end === 'number' ? (entry.end - (entry.start ?? startSeconds)) : 0);
    return {
      text: entry.text ?? '',
      start: startSeconds,
      end: startSeconds + durationSeconds,
      offset: Math.round(startSeconds * 1000),
      duration: Math.round(durationSeconds * 1000),
    };
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const videoLink = body?.videoLink;
    if (!videoLink) {
      return NextResponse.json({ success: false, error: 'videoLink is required' }, { status: 400 });
    }

    const youtubeId = extractYouTubeId(String(videoLink));
    if (!youtubeId) {
      return NextResponse.json({ success: false, error: 'Only YouTube links are supported' }, { status: 400 });
    }

    const raw = await YoutubeTranscript.fetchTranscript(youtubeId);
    const transcript = normalizeTranscript(raw);

    return NextResponse.json({ success: true, transcript });
  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to fetch transcript' }, { status: 500 });
  }
}