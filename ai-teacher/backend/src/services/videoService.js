const fetch = require('node-fetch');
require('dotenv').config();

const DID_API_BASE = 'https://api.d-id.com';

function isAvatarConfigured() {
  return !!process.env.DID_API_KEY;
}

// Creates a real talking-head avatar video via the D-ID API (https://docs.d-id.com/).
// Requires DID_API_KEY to be set. If not configured, this function tells the
// caller explicitly rather than returning a fake/mock video URL.
async function createAvatarVideo({ text, language }) {
  if (!isAvatarConfigured()) {
    const err = new Error(
      'Avatar video is not configured on this server. Set DID_API_KEY in .env to enable talking-head video generation.'
    );
    err.code = 'AVATAR_NOT_CONFIGURED';
    throw err;
  }

  const key = process.env.DID_API_KEY;
  const avatarImage =
    process.env.DID_AVATAR_IMAGE_URL ||
    'https://create-images-results.d-id.com/DefaultPresenters/Emma_f/image.jpeg';

  const createRes = await fetch(`${DID_API_BASE}/talks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(key).toString('base64')}`,
    },
    body: JSON.stringify({
      source_url: avatarImage,
      script: {
        type: 'text',
        input: text,
        provider: { type: 'microsoft', voice_id: pickVoiceForLanguage(language) },
      },
      config: { fluent: true, pad_audio: 0 },
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`D-ID talk creation failed (${createRes.status}): ${body}`);
  }

  const created = await createRes.json();
  const talkId = created.id;

  // Poll for completion (D-ID renders asynchronously)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const statusRes = await fetch(`${DID_API_BASE}/talks/${talkId}`, {
      headers: { Authorization: `Basic ${Buffer.from(key).toString('base64')}` },
    });
    if (!statusRes.ok) continue;
    const status = await statusRes.json();
    if (status.status === 'done') {
      return { videoUrl: status.result_url, talkId };
    }
    if (status.status === 'error' || status.status === 'rejected') {
      throw new Error(`D-ID video generation failed: ${JSON.stringify(status)}`);
    }
  }

  throw new Error('D-ID video generation timed out. Please try again.');
}

function pickVoiceForLanguage(language) {
  const map = {
    English: 'en-US-JennyNeural',
    Spanish: 'es-ES-ElviraNeural',
    French: 'fr-FR-DeniseNeural',
    German: 'de-DE-KatjaNeural',
    Hindi: 'hi-IN-SwaraNeural',
    Odia: 'hi-IN-SwaraNeural',
    Chinese: 'zh-CN-XiaoxiaoNeural',
    Arabic: 'ar-SA-ZariyahNeural',
    Portuguese: 'pt-BR-FranciscaNeural',
    Japanese: 'ja-JP-NanamiNeural',
  };
  return map[language] || 'en-US-JennyNeural';
}

module.exports = { createAvatarVideo, isAvatarConfigured };
