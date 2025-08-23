'use client';

import { useState } from 'react';

const modes = [
  { id: 'reaction', name: 'Short powerful statement that causes a reaction' },
  { id: 'relatable', name: 'A personal story that others can relate to' },
  { id: 'listicle', name: 'Numbered list of actionable tips' },
  { id: 'question', name: 'Question that drives engagement' },
  { id: 'routine', name: 'Daily habits with results' },
];

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconMic() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function IconSparkles() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
      <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M6 16l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM18 16l.7 1.6L20 18l-1.3.4L18 20l-.7-1.6L16 18l1.3-.4L18 16z" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
      <path d="M8 10l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('reaction');
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tweets, setTweets] = useState([]);

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setTweets([]);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, mode, count, exclude: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate');
      setTweets(Array.isArray(data.tweets) ? data.tweets : []);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleMore() {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, mode, count, exclude: tweets.map((t) => t.text) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate');
      const incoming = Array.isArray(data.tweets) ? data.tweets : [];
      // De-dup safeguard on client
      const existing = new Set(tweets.map((t) => t.text.toLowerCase()));
      const merged = [...tweets];
      for (const t of incoming) {
        const key = (t.text || '').toLowerCase();
        if (!existing.has(key)) {
          existing.add(key);
          merged.push(t);
        }
      }
      setTweets(merged);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function copy(text) {
    navigator.clipboard.writeText(text);
  }

  function formatTweetText(text) {
    if (!text) return '';
    
    // Convert numbered lists to proper formatting
    let formatted = text
      .replace(/(\d+\.\s)/g, '\n$1') // Add line break before numbered items
      .replace(/(\n\d+\.\s)/g, '\n• ') // Convert numbered to bullet points
      .replace(/(\n•\s)/g, '\n• ') // Ensure consistent bullet formatting
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();
    
    return formatted;
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            AI Tweet Studio
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight text-foreground">What&apos;s on your mind today?</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">Turn a thought into a feed-ready post. Choose your style, and get crisp, original tweets in seconds.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-3 md:p-4 shadow-sm">
          <div className="rounded-xl border border-input/80 bg-background">
            {/* Top chip row */}
            <div className="flex items-center gap-2 p-3 border-b border-border/60">
              <button className="h-7 w-7 grid place-items-center rounded-full border border-input bg-card hover:bg-secondary" aria-label="Add">
                <IconPlus />
              </button>
              {topic ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-input bg-card px-3 py-1 text-xs text-foreground/80 max-w-[50%] truncate">
                  {topic}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Add a link or write a thought…</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button className="h-8 w-8 grid place-items-center rounded-lg border border-input hover:bg-secondary" aria-label="Language">
                  <IconGlobe />
                </button>
                <button className="h-8 w-8 grid place-items-center rounded-lg border border-input hover:bg-secondary" aria-label="Voice">
                  <IconMic />
                </button>
                <button className="h-8 w-8 grid place-items-center rounded-lg border border-input hover:bg-secondary" aria-label="Magic">
                  <IconSparkles />
                </button>
              </div>
            </div>
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                  <span className="text-foreground">Style</span>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="bg-transparent text-foreground text-sm focus:outline-none"
                  >
                    {modes.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm">
                  <span className="text-foreground">Persona</span>
                  <button className="inline-flex items-center gap-2 text-sm text-foreground">
                    Jarvis <IconChevron />
                  </button>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !topic.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-sm"
                >
                  <IconSparkles /> {loading ? 'Generating…' : 'Get new post ideas'}
                </button>
                <button
                  onClick={handleMore}
                  disabled={loading || !topic.trim()}
                  className="inline-flex items-center gap-2 rounded-xl border border-input bg-card text-foreground px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50"
                >
                  <IconSparkles /> Get more tweets
                </button>
              </div>
            </div>
            {/* Textarea */}
            <div className="p-3 border-t border-border/60">
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Write your thought or paste a link…"
                className="w-full resize-y min-h-28 rounded-lg border border-input px-4 py-3 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive px-4 py-3">{error}</div>
        )}

        <h2 className="mt-10 mb-4 text-2xl font-semibold text-center text-foreground">Results</h2>

        <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          {loading && (
            Array.from({ length: Math.max(2, Math.min(6, count)) }).map((_, i) => (
              <div key={`s-${i}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm animate-pulse">
                <div className="h-4 w-2/5 bg-muted rounded mb-3" />
                <div className="h-3 w-full bg-muted rounded mb-2" />
                <div className="h-3 w-11/12 bg-muted rounded mb-4" />
                <div className="h-8 w-32 bg-muted rounded" />
              </div>
            ))
          )}
          {!loading && tweets.map((t, idx) => (
            <div key={idx} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <img alt="avatar" className="h-9 w-9 rounded-full object-cover" src="https://avatar.vercel.sh/u" />
                <div className="flex-1">
                  <div className="font-semibold text-foreground">umair manzoor</div>
                  <p className="text-foreground/80 mt-1 whitespace-pre-line">{formatTweetText(t.text)}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex gap-2">
                      <a href="#" className="rounded-lg border border-input px-3 py-2 text-sm hover:bg-secondary inline-flex items-center gap-2">
                        Open in editor <IconChevron />
                      </a>
                    </div>
                    <button onClick={() => copy(t.text)} className="h-8 w-8 grid place-items-center rounded-lg border border-input hover:bg-secondary" aria-label="Copy">
                      <IconCopy />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
