// BlindSpot AI — OpenRouter serverless proxy

const buckets = new Map();
const LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR || 30);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const allowed = process.env.ALLOWED_ORIGIN;

  if (
    allowed &&
    req.headers.origin &&
    req.headers.origin !== allowed
  ) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '')
      .split(',')[0]
      .trim() || 'unknown';

  const now = Date.now();

  const hits = (buckets.get(ip) || []).filter(
    t => now - t < 3600e3
  );

  if (hits.length >= LIMIT) {
    return res.status(429).json({ error: 'rate_limited' });
  }

  hits.push(now);
  buckets.set(ip, hits);

  const { messages, max_tokens } = req.body || {};

  const ok =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= 30 &&
    messages.every(
      m =>
        m &&
        ['user', 'assistant'].includes(m.role) &&
        typeof m.content === 'string'
    ) &&
    messages.reduce((n, m) => n + m.content.length, 0) <= 60000;

  if (!ok) {
    return res.status(400).json({ error: 'bad request' });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({
      error: 'OPENROUTER_API_KEY is not configured'
    });
  }

  try {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://blindspotai-eight.vercel.app',
          'X-OpenRouter-Title': 'BlindSpot AI'
        },

        body: JSON.stringify({
          model:
            process.env.OPENROUTER_MODEL ||
            'openai/gpt-5-mini',

          messages,

          max_tokens: Math.min(
            Number(max_tokens) || 1500,
            3500
          )
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter error:', data);

      return res.status(502).json({
        error:
          data?.error?.message ||
          'OpenRouter request failed'
      });
    }

    const text =
      data?.choices?.[0]?.message?.content || '';

    if (!text) {
      return res.status(502).json({
        error: 'OpenRouter returned an empty response'
      });
    }

    return res.status(200).json({ text });

  } catch (error) {
    console.error('OpenRouter connection error:', error);

    return res.status(502).json({
      error: 'Unable to reach OpenRouter'
    });
  }
};
