import { ClientType, Innertube } from 'youtubei.js/web'
/**
 * POST /api/generate
 * Body: { topic: string, mode: 'reaction' | 'relatable' | 'listicle' | 'question' | 'routine', count?: number, exclude?: string[] }
 */
export async function getTranscript(videoId = 'e8krKpuaby8', lang = 'ja') {
  const yt = await Innertube.create({
    client_type: ClientType.WEB,
    lang: lang,
    region: 'JP',
    fetch: async (input, url) => {
      return fetch(input, url)
    },
  })
  let info = await yt.getInfo(videoId, 'WEB')
  let scriptInfo = await info.getTranscript(lang)
  return scriptInfo.transcript.content.body.initial_segments.map((segment) => ({
    text: segment.snippet.text,
    startMs: segment.start_ms,
    endMs: segment.end_ms,
  }))
}
export async function POST(request) {
  try {
    const body = await request.json();
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const validModes = ['reaction', 'relatable', 'listicle', 'question', 'routine'];
    const mode = validModes.includes(body.mode) ? body.mode : 'reaction';
    const countRaw = Number(body.count);
    const count = Number.isFinite(countRaw) && countRaw > 0 && countRaw <= 10 ? Math.floor(countRaw) : 4;
    const exclude = Array.isArray(body.exclude) ? body.exclude.filter((t) => typeof t === 'string') : [];

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Please provide a topic or draft text.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY on server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // If the topic is a YouTube URL, fetch the transcript text and use it as context
    let context = '';
    try {
      const ytMatch = topic.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i);
      if (ytMatch) {
        const videoId = ytMatch[1];
        const items = await getTranscript(videoId)
        // const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
        context = items.map((i) => i.text).join(' ').slice(0, 5000);
      }
    } catch (_) {
      // Silently ignore transcript errors and fall back to topic only
    }

    const systemPrompt = [
      'You are a senior X/Twitter ghostwriter for tech founders. Write high-signal posts only. ',
      'HARD CONSTRAINTS:\n',
      '- Output JSON ONLY in the exact shape: {"tweets":[{"text":"..."}]} . No code fences, no prose.\n',
      '- Exactly COUNT items. Each item is a standalone tweet (<=280 chars).\n',
      '- 1–2 sentences max. Active voice. Strong verbs. No buzzwords.\n',
      '- No hashtags, no links, no mentions, no numbered lists, no quote marks around the tweet.\n',
      '- no emoji.\n',
      '\nGOOD EXAMPLES (do not copy):\n',
      '- reaction: Most "strategy" is fear wearing an MBA.\n',
      '- reaction: Ship the embarrassing v1. Feedback is your only cofounder.\n',
      '- relatable: I spent 3 hours picking a font. Shipped nothing. The week I stopped, I got my first customer. Focus beats aesthetics.\n',
      '- relatable: I used to rewrite emails 5 times. One day I hit send on the first draft. Nothing broke. Speed is a moat.\n',
      '\nLanguage: match the user input language.'
    ].join('');

    const userPrompt = [
      `MODE: ${mode === 'reaction' ? 'reaction' : mode === 'relatable' ? 'relatable' : mode === 'listicle' ? 'listicle' : mode === 'question' ? 'question' : 'routine'}`,
      `COUNT: ${count}`,
      'TASK: Generate tweets for the following topic or rough draft.',
      context ? `SOURCE: YouTube transcript summary below (trimmed).\n${context}` : `TOPIC: ${topic}`,
      exclude.length ? `EXCLUDE (do not repeat same or paraphrased): ${exclude.map((t) => `• ${t}`).join('\n')}` : '',
      'Return only valid JSON.'
    ].join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: mode === 'reaction' ? 0.85 : mode === 'listicle' ? 0.8 : 0.75,
        top_p: 0.95,
        presence_penalty: mode === 'reaction' ? 0.3 : 0.2,
        frequency_penalty: 0.2,
        max_tokens: 1000,
        n: 1,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      return new Response(JSON.stringify({ error: 'OpenAI error', details: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await openaiResponse.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Attempt strict JSON parse, with fallback to strip fences if model added them
    let parsed;
    const trimmed = content.trim()
      .replace(/^```json\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/\n?```$/i, '');
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // As a safety net, craft minimal structure if parsing fails
      parsed = { tweets: [{ text: trimmed.slice(0, 280) }] };
    }

    // Normalize to ensure we return a safe, expected shape
    function cleanTweet(raw) {
      if (typeof raw !== 'string') return '';
      let text = raw.trim();
      // Drop surrounding quotes
      if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\'') && text.endsWith('\''))) {
        text = text.slice(1, -1).trim();
      }
      // Remove hashtags/links/mentions as a last-resort safety net
      text = text.replace(/#[\w-]+/g, '').replace(/https?:\/\/\S+/g, '').replace(/@[\w-]+/g, '').trim();
      // Collapse whitespace
      text = text.replace(/\s+/g, ' ');
      // Enforce length
      if (text.length > 280) text = text.slice(0, 279).trimEnd();
      return text;
    }

    const seen = new Set(exclude.map((t) => t.toLowerCase()));
    const normalized = Array.isArray(parsed.tweets)
      ? []
      : [];

    if (Array.isArray(parsed.tweets)) {
      for (const t of parsed.tweets) {
        const text = cleanTweet(t?.text);
        if (!text) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue; // avoid duplicates with prior results
        seen.add(key);
        normalized.push({ text });
        if (normalized.length >= count) break;
      }
    }

    if (normalized.length === 0) {
      return new Response(JSON.stringify({ error: 'No content generated.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ tweets: normalized }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unexpected server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}


