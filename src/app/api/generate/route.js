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

    // Fallbacks for empty input
    const fallbackQuestions = [
      'How do you validate a startup idea?',
      'What is the fastest way to ship a new product?',
      'How do you find your first users?',
      'What is the best way to get feedback on an MVP?',
      'How do you avoid overengineering early?',
      'What is a common mistake when launching a SaaS?',
      'How do you balance speed and quality in product development?',
      'What is the best way to learn from failed launches?',
      'How do you prioritize features for launch?',
      'What is the most underrated skill for founders?'
    ];
    const fallbackLearnings = [
      'A new way to validate startup ideas using customer interviews.',
      'How to use rapid prototyping to test product-market fit.',
      'Lessons learned from launching a SaaS in 30 days.',
      'The importance of distribution over product perfection.',
      'How to use user feedback to iterate quickly.',
      'Why most MVPs fail and how to avoid it.',
      'How to leverage open source tools for faster shipping.',
      'The role of constraints in creative product development.',
      'How to build a landing page that actually converts.',
      'What I learned from my first failed startup.'
    ];
    if (!topic) {
      if (mode === 'question') {
        topic = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
      } else if (mode === 'learning') {
        topic = fallbackLearnings[Math.floor(Math.random() * fallbackLearnings.length)];
      } else if (mode === 'professional') {
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
      // Mode persona
      mode === 'professional'
        ? 'You are a professional social media ghostwriter. You write crisp, useful posts that read like a human wrote them.'
        : mode === 'learning'
        ? 'You are a learning-focused ghostwriter. You share fresh takeaways in plain, human language.'
        : 'You are a senior ghostwriter for social media who writes like a real person, not a bot.\n',
    
      // Output format
      'OUTPUT FORMAT (HARD CONSTRAINTS)\n',
      `- Return JSON ONLY: {"tweets":[{"text":"..."}]}\n`,
      `- Exactly COUNT items; each item is a single post (<=${textLimit} chars).\n`,
      '- 1–2 sentences max. No hashtags, no links, no mentions, no quote marks, no lists, no emojis.\n\n',
    
      // Voice & audience (human)
      'VOICE & STYLE\n',
      '- Human, conversational, and direct. Use contractions (don’t, can’t), vary sentence length, sometimes add a short aside in parentheses.\n',
      '- Prefer first person (“I”) or second person (“you”) when natural. Avoid corporate tone and slogans.\n',
      '- Show, don’t tell. Concrete details over abstractions.\n\n',
    
      // Quality bar
      'QUALITY BAR\n',
      '- Specific: include a concrete detail (tool, term, number, date, failure mode, quote paraphrase).\n',
      '- Grounded: if transcript context is present, each post MUST clearly reference at least one fact from it.\n',
      '- Actionable: include a tiny “do this / avoid that” or a sharp observation.\n',
      '- No filler motivation or clichés.\n\n',
    
      // Strict rules
      'STRICT RULES\n',
      '- Banned words/phrases: leverage, synergy, grind, crush it, game-changer, journey, consistency is key, thought leader, build in public.\n',
      '- Never say “the transcript,” “the video,” or describe your own process. Just write the post.\n',
      '- Do not fabricate names, metrics, or quotes.\n',
      `- Language: match the input language; default to English.\n\n`,
    
      // Mode shapes (kept, but phrased humanly)
      'MODE SHAPES\n',
      '- professional → one clear insight or tactic.\n',
      '- learning → share a new learning or surprising takeaway.\n',
      '- reaction → sharp take/pushback on a common belief.\n',
      '- relatable → first-person micro-confession + tiny lesson.\n',
      '- listicle → a single line with 2–3 fragments split by em dashes — not numbers.\n',
      '- question → one high-signal question that invites examples and constraints.\n',
      '- routine → a tiny repeatable habit with context and payoff.\n',
    ].join('')
    

    // ---------- New user prompt ----------
    let userPrompt;
    if (context) {
      userPrompt = [
        'You have transcript text from a YouTube video below.',
        'First, silently extract 4–8 concrete facts (frameworks/APIs, terms used, metrics, dates, named constraints, short quote fragments) — do NOT output them.',
        `Then write exactly ${count} short posts (max ${textLimit} chars each) that clearly draw on those facts.`,
        'Rules:',
        '1) Each post must include at least ONE explicit concrete detail from the transcript (a term, API, number, named person, date, or paraphrased quote).',
        '2) Write like a human: natural cadence, small asides, no stiff “corporate” phrasing.',
        '3) No hashtags, links, mentions, lists, or emojis. 1–2 sentences per post.',
        '4) Do not mention “the video” or “the transcript.” Do not explain your process.',
        '5) Vary angle and rhythm across posts.',
        '',
        'Transcript:',
        context,
      ].join('\n')
    } else {
      userPrompt = [
        `Write exactly ${count} short posts (max ${textLimit} chars each) about this topic:`,
        topic,
        '',
        'Write like a human (conversational, specific, no fluff).',
        'Each post should contain at least one concrete detail (term, number, example, constraint).',
        'No hashtags, links, mentions, lists, or emojis. 1–2 sentences per post.',
        'Vary angle and rhythm across posts.',
      ].join('\n')
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
