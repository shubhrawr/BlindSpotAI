// Serverless proxy: keeps your Anthropic API key on the server.
const buckets = new Map(); // best-effort, per-instance rate limit
const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 30);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const allowed = process.env.ALLOWED_ORIGIN; // e.g. https://yourapp.vercel.app
  if (allowed && req.headers.origin && req.headers.origin !== allowed)
    return res.status(403).json({ error: 'forbidden' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const hits = (buckets.get(ip) || []).filter(t => now - t < 3600e3);
  if (hits.length >= LIMIT) return res.status(429).json({ error: 'rate_limited' });
  hits.push(now); buckets.set(ip, hits);

  const { messages, max_tokens } = req.body || {};
  const ok = Array.isArray(messages) && messages.length > 0 && messages.length <= 30 &&
    messages.every(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string') &&
    messages.reduce((n, m) => n + m.content.length, 0) <= 60000;
  if (!ok) return res.status(400).json({ error: 'bad request' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'server not configured' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: Math.min(Number(max_tokens) || 1500, 3500),
        messages,
      }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'upstream error' });
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(502).json({ error: 'upstream unreachable' });
  }
};
