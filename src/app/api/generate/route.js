import { ClientType, Innertube } from 'youtubei.js/web'

/**
 * POST /api/generate
 * Body: { topic: string, mode: 'reaction' | 'relatable' | 'listicle' | 'question' | 'routine', count?: number, exclude?: string[] }
 */

export async function getTranscript(videoId = 'e8krKpuaby8', lang = 'en') {
  const yt = await Innertube.create({
    client_type: ClientType.WEB,
    lang,
    region: 'JP',
    fetch: async (input, url) => {
      return fetch(input, url)
    },
  })

  const info = await yt.getInfo(videoId, 'WEB')

  // Try a small cascade of languages for better coverage
  const tryLangs = Array.from(new Set([lang, 'en', 'en-US', 'en-GB', 'auto']))
  let scriptInfo= null
  for (const L of tryLangs) {
    try {
      scriptInfo = await info.getTranscript(L)
      if (scriptInfo) break
    } catch {
      // keep trying
    }
  }
  if (!scriptInfo) {
    throw new Error('Transcript not available in requested languages.')
  }

  return scriptInfo.transcript.content.body.initial_segments.map((segment) => ({
    text: segment.snippet.text,
    startMs: segment.start_ms,
    endMs: segment.end_ms,
  }))
}

function paramsForMode(mode) {
  switch (mode) {
    case 'professional':
      return { temperature: 0.6, presence_penalty: 0.2 };
    case 'learning':
      return { temperature: 0.7, presence_penalty: 0.3 };
    case 'reaction':
      return { temperature: 0.75, presence_penalty: 0.4 };
    case 'relatable':
      return { temperature: 0.7, presence_penalty: 0.35 };
    case 'listicle':
      return { temperature: 0.65, presence_penalty: 0.3 };
    case 'question':
      return { temperature: 0.65, presence_penalty: 0.25 };
    case 'routine':
    default:
      return { temperature: 0.6, presence_penalty: 0.25 };
  }
}

function supportsJsonResponseFormat(model) {
  // Best-effort detection of models that support response_format: { type: 'json_object' }
  return /(gpt-4o|gpt-4\.1|gpt-4-turbo|o3)/i.test(model)
}

export async function POST(request) {
  try {
    const body = await request.json();
    let topic = typeof body.topic === 'string' ? body.topic.trim() : '';
    const validModes = ['professional', 'learning', 'reaction', 'relatable', 'listicle', 'question', 'routine'];
    const mode = validModes.includes(body.mode) ? body.mode : 'professional';
    const count = 6;
    const exclude = Array.isArray(body.exclude) ? body.exclude.filter((t) => typeof t === 'string') : [];
    const textLimitRaw = Number(body.textLimit);
    const textLimit = Number.isFinite(textLimitRaw) && textLimitRaw >= 40 && textLimitRaw <= 280 ? Math.floor(textLimitRaw) : 280;


    if (!topic) {
        if (mode === 'professional') {
        topic = 'Share a professional insight or actionable advice for founders or developers.';
      } else {
        topic = 'Share a useful, specific, and conversation-worthy post for founders or developers.';
      }
    }

    if (!topic) {
      return new Response(JSON.stringify({ error: 'Please provide a topic or draft text.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiKey = process.env.OPENAI_API_KEY
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY on server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // If the topic is a YouTube URL, fetch the transcript text and use it as context
    let context = ''
    try {
      const ytMatch = topic.match(
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i
      )
      if (ytMatch) {
        const videoId = ytMatch[1]
        const items = await getTranscript(videoId)
        // Join into a single string and trim to keep tokens manageable
        context = items.map((i) => i.text).join(' ').slice(0, 5000)
      }
    } catch {
      // Silently ignore transcript errors and fall back to topic only
    }

    // ---------- New, sharper system prompt ----------
    const systemPrompt = [
      mode === 'professional'
        ? 'You are a professional social media ghostwriter for founders and developers. Write crisp, actionable, and insightful posts that demonstrate expertise and provide real value.'
        : mode === 'learning'
        ? 'You are a learning-focused ghostwriter. Share new knowledge, surprising facts, or actionable lessons that help founders and developers grow.'
        : 'You are a senior X (Twitter) ghostwriter for a technical founder who builds multiple startups, ships fast, and speaks plainly.\n\n',
      'OUTPUT FORMAT (HARD CONSTRAINTS)\n',
      `- Return JSON ONLY: {"tweets":[{"text":"..."}]}\n`,
      `- Exactly COUNT items; each item is a single tweet (<=${textLimit} chars).\n`,
      '- 1–2 sentences max. No hashtags, no links, no mentions, no quote marks, no numbered lists, no emojis.\n\n',
      'AUDIENCE & VOICE\n',
      '- Audience: developers, indie makers, technical founders, startup operators.\n',
      '- Voice: direct, specific, slightly contrarian, practical, builder energy. Never fluffy or motivational.\n',
      '- Assume the author codes (React/Next.js, Supabase, AWS, Postgres), ships MVPs, measures, iterates.\n\n',
      'QUALITY BAR (PASS THE “SWEAT” TEST)\n',
      '- Specific: include at least one concrete detail (tools, numbers, constraints, trade-offs, failure mode).\n',
      '- Weird: avoid consensus phrasing; add a sharp angle or unexpected contrast.\n',
      '- Empirical: refer to a cause/effect (“did X, saw Y”) or a falsifiable claim.\n',
      '- Actionable: a tiny “do this / avoid that” or a pointed question that elicits useful replies.\n',
      '- Tension: highlight a trade-off or a choice (speed vs polish, product vs distribution, etc.).\n\n',
      'STRICT CONTENT RULES\n',
      '- Banned: leverage, synergy, grind, crush it, game-changer, journey, consistency is key, build in public, hustle, thought leader, optimize to infinity, AI will replace everything.\n',
      '- No generic “keep going”, “stay consistent”, or empty motivation.\n',
      '- Do not fabricate metrics, logos, or names. If specifics are missing, use realistic software constraints (timeouts, p95 latency, cache misses, cold starts, index scans, etc.).\n',
      '- Language: match the user input language; default to English.\n\n',
      'USE OF CONTEXT (WHEN YOUTUBE TRANSCRIPT IS PRESENT)\n',
      '- Extract 3–6 concrete facts first (frameworks, APIs, errors, trade-offs, numbers, quotes). Use at least one fact per tweet.\n',
      '- Prefer conflict points, failed assumptions, counterintuitive lessons, or design/API limitations.\n\n',
    ].join('');

    // ---------- New user prompt ----------
    let userPrompt;
    if (context) {
      userPrompt = [
        `You just watched this YouTube video. Here are the main points from the transcript:`,
        context,
        '',
        `Write ${count} short, practical, and real posts (max ${textLimit} characters each) inspired by the transcript above.`,
        'Each post should be a complete thought, not a list, and should sound like something a real person would share on social media.',
        'Avoid generic advice, avoid buzzwords, and don’t repeat the transcript verbatim. Use your own words, be specific, and keep it natural.',
        'No hashtags, no links, no mentions, no emojis, no numbered lists, no quote marks.',
        'Focus on the transcript and then focus on the topic and then write posts about it.',
        'If you can, make each post a little different in style or focus.'
      ].join('\n');
    } else {
      userPrompt = [
        `Write ${count} short, practical, and real posts (max ${textLimit} characters each) about this topic:`,
        topic,
        '',
        'Each post should be a complete thought, not a list, and should sound like something a real person would share on social media.',
        'Avoid generic advice, avoid buzzwords, and don’t repeat the topic verbatim. Use your own words, be specific, and keep it natural.',
        'No hashtags, no links, no mentions, no emojis, no numbered lists, no quote marks.',
        'If you can, make each post a little different in style or focus.'
      ].join('\n');
    }

    const excludeBullets = exclude.length ? exclude.map((t) => `• ${t}`).join('\n') : ''

    const { temperature, presence_penalty } = paramsForMode(mode)

    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      top_p: 0.92,
      presence_penalty,
      frequency_penalty: 0.2,
      max_tokens: 1000,
      n: 1,
    }

    if (supportsJsonResponseFormat(model)) {
      payload.response_format = { type: 'json_object' }
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text()
      return new Response(JSON.stringify({ error: 'OpenAI error', details: errText }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await openaiResponse.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Attempt strict JSON parse, with fallback to strip fences if model added them
    let parsed
    const trimmed = content
      .trim()
      .replace(/^```json\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/\n?```$/i, '')
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      // As a safety net, craft minimal structure if parsing fails
      parsed = { tweets: [{ text: trimmed.slice(0, 280) }] }
    }

    // Normalize to ensure we return a safe, expected shape
    function cleanTweet(raw) {
      if (typeof raw !== 'string') return ''
      let text = raw.trim()
      // Drop surrounding quotes
      if (
        (text.startsWith('"') && text.endsWith('"')) ||
        (text.startsWith("'") && text.endsWith("'"))
      ) {
        text = text.slice(1, -1).trim()
      }
      // Remove hashtags/links/mentions as a last-resort safety net
      text = text.replace(/#[\w-]+/g, '').replace(/https?:\/\/\S+/g, '').replace(/@[\w-]+/g, '').trim()
      // Collapse whitespace
      text = text.replace(/\s+/g, ' ')
      // Do NOT slice text here; just return as-is
      return text;
    }

    const seen = new Set(exclude.map((t) => t.toLowerCase()))
    const normalized = []

    // Only accept exactly 'count' posts, no more, no less (if possible)
    if (Array.isArray(parsed.tweets)) {
      for (const t of parsed.tweets) {
        const text = cleanTweet(t?.text);
        if (!text || text.length > textLimit) continue;
        const key = text.toLowerCase();
        if (seen.has(key)) continue; // avoid duplicates with prior results
        seen.add(key);
        normalized.push({ text });
        if (normalized.length >= count) break;
      }
    }
    // If not enough, pad with empty posts to always return 6
    while (normalized.length < count) {
      normalized.push({ text: '' });
    }

    if (normalized.length === 0) {
      return new Response(JSON.stringify({ error: 'No content generated.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ tweets: normalized }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Unexpected server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
