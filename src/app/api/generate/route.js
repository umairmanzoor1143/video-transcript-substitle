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
    const countRaw = Number(body.count);
    const count = Number.isFinite(countRaw) && countRaw > 0 && countRaw <= 10 ? Math.floor(countRaw) : 4;
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
      'MODE SHAPES (CHOOSE TONE/PATTERN BASED ON MODE)\n',
      '- professional → actionable insight, tip, or lesson for founders/developers.\n',
      '- learning → share a new learning, surprising fact, or actionable lesson.\n',
      '- reaction → sharp take or pushback on a common belief; 1–2 punchy lines.\n',
      '- relatable → first-person micro-confession with a practical takeaway.\n',
      '- listicle → one compact line with 3 fragments separated by em dashes (—) or dots · (not numbers).\n',
      '- question → single high-signal, actionable, or popular question that invites practitioners to answer with examples, constraints, or code.\n',
      '- routine → a tiny repeatable habit with context and payoff.\n\n',
      'GOOD EXAMPLES (do not copy)\n',
      '- question: How do you validate a startup idea?\n',
      '- question: What is the fastest way to ship a new product?\n',
      '- question: How do you find your first users?\n',
      '- question: What is the best way to get feedback on an MVP?\n',
      '- question: How do you avoid overengineering early?\n',
      '- learning: A new way to validate startup ideas using customer interviews.\n',
      '- learning: How to use rapid prototyping to test product-market fit.\n',
      '- learning: Lessons learned from launching a SaaS in 30 days.\n',
      '- learning: The importance of distribution over product perfection.\n',
      '- learning: How to use user feedback to iterate quickly.\n',
      '- professional: The best founders ship before they’re ready, then iterate.\n',
      '- professional: If you’re not embarrassed by v1, you shipped too late.\n',
      '- professional: Most MVPs fail because they try to do too much.\n',
      '- professional: Distribution is more important than features.\n',
      '- professional: The best feedback comes from real users, not friends.\n',
      '- professional: Speed is a feature.\n',
      '- professional: Constraints drive creativity.\n',
      '- professional: The best products solve boring problems.\n',
      '- professional: Don’t optimize for scale before you have users.\n',
      '- professional: The best way to learn is to ship and iterate.\n',
      '- professional: Don’t build for everyone; build for someone.\n',
      '- professional: The best products are opinionated.\n',
      '- professional: Don’t be afraid to delete features.\n',
      '- professional: The best founders are relentless about feedback.\n',
      '- professional: Don’t be afraid to launch ugly.\n',
      '- professional: The best products are simple.\n',
      '- professional: Don’t be afraid to say no.\n',
      '- professional: The best products are built by small teams.\n',
      '- professional: Don’t be afraid to pivot.\n',
      '- professional: The best products are built for yourself.\n',
      '- professional: Don’t be afraid to charge early.\n',
      '- professional: The best products are built in public.\n',
      '- professional: Don’t be afraid to ask for help.\n',
      '- professional: The best products are built with love.\n',
      '- professional: Don’t be afraid to fail.\n',
      '- professional: The best products are built by people who care.\n',
      '- professional: Don’t be afraid to start over.\n',
      '- professional: The best products are built by people who listen.\n',
      '- professional: Don’t be afraid to experiment.\n',
      '- professional: The best products are built by people who learn.\n',
      '- professional: Don’t be afraid to try new things.\n',
      '- professional: The best products are built by people who share.\n',
      '- professional: Don’t be afraid to ask questions.\n',
      '- professional: The best products are built by people who teach.\n',
      '- professional: Don’t be afraid to give back.\n',
      '- professional: The best products are built by people who care about users.\n',
      '- professional: Don’t be afraid to build for yourself.\n',
      '- professional: The best products are built by people who solve their own problems.\n',
      '- professional: Don’t be afraid to build for a niche.\n',
      '- professional: The best products are built by people who focus.\n',
      '- professional: Don’t be afraid to build for fun.\n',
      '- professional: The best products are built by people who enjoy the process.\n',
      '- professional: Don’t be afraid to build for the long term.\n',
      '- professional: The best products are built by people who care about quality.\n',
      '- professional: Don’t be afraid to build for impact.\n',
      '- professional: The best products are built by people who care about results.\n',
      '- professional: Don’t be afraid to build for change.\n',
      '- professional: The best products are built by people who care about making a difference.\n',
      '- professional: Don’t be afraid to build for the future.\n',
      '- professional: The best products are built by people who care about the world.\n',
      '- professional: Don’t be afraid to build for yourself.'
    ].join('');

    // ---------- New user prompt ----------
    const excludeBullets = exclude.length ? exclude.map((t) => `• ${t}`).join('\n') : ''

    const userPrompt = [
      `MODE: ${mode}`,
      `COUNT: ${count}`,
      '',
      'TASK',
      'Generate founder/dev-focused tweets that are useful, specific, and conversation-worthy. Prefer concrete constraints, trade-offs, bugs, and decisions over vague motivation.',
      '',
      'CONTEXT',
      context
        ? `Use these transcript takeaways to ground at least one detail per tweet (names, tools, limits, or numbers allowed; no fabricated data):\n${context}`
        : `Topic: ${topic}`,
      '',
      'EXCLUSIONS',
      excludeBullets || '(none)',
      '',
      'OUTPUT',
      'Return ONLY valid JSON in the exact shape: {"tweets":[{"text":"..."}]} .',
      'Do not include your notes or analysis.',
    ].join('\n')

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
