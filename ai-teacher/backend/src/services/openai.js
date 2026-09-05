const fetch = require('node-fetch');
require('dotenv').config();

const API_BASE = 'https://api.openai.com/v1';

function requireKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.includes('your-openai-key-here')) {
    const err = new Error(
      'OPENAI_API_KEY is not configured on the server. Set it in your .env file.'
    );
    err.code = 'MISSING_API_KEY';
    throw err;
  }
  return key;
}

async function chatComplete({ messages, temperature = 0.6, jsonMode = false, maxTokens = 1400 }) {
  const key = requireKey();
  const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI chat completion failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function embedText(text) {
  const key = requireKey();
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

  const res = await fetch(`${API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: text }),
  });

  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`OpenAI embeddings failed (${res.status}): ${text2}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

async function embedBatch(texts) {
  const key = requireKey();
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

  const res = await fetch(`${API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input: texts }),
  });

  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`OpenAI embeddings batch failed (${res.status}): ${text2}`);
  }

  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

async function textToSpeech(text) {
  const key = requireKey();
  const model = process.env.OPENAI_TTS_MODEL || 'tts-1';
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';

  const res = await fetch(`${API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, voice, input: text, response_format: 'mp3' }),
  });

  if (!res.ok) {
    const text2 = await res.text();
    throw new Error(`OpenAI TTS failed (${res.status}): ${text2}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { chatComplete, embedText, embedBatch, textToSpeech };
