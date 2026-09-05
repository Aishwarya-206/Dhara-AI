const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { textToSpeech } = require('../services/openai');
const { createAvatarVideo, isAvatarConfigured } = require('../services/videoService');

const router = express.Router();

// Real AI voice narration (always available once OPENAI_API_KEY is set)
router.post('/speak', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required.' });

    const audioBuffer = await textToSpeech(text.slice(0, 4000));
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error(err);
    res.status(err.code === 'MISSING_API_KEY' ? 503 : 500).json({ error: err.message || 'Failed to synthesize speech.' });
  }
});

// Real talking-head avatar video via D-ID (requires DID_API_KEY)
router.post('/avatar-video', requireAuth, async (req, res) => {
  try {
    const { text, language } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required.' });

    const result = await createAvatarVideo({ text: text.slice(0, 1000), language });
    res.json(result);
  } catch (err) {
    if (err.code === 'AVATAR_NOT_CONFIGURED') {
      return res.status(503).json({ error: err.message, configured: false });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate avatar video.' });
  }
});

router.get('/avatar-status', requireAuth, (req, res) => {
  res.json({ configured: isAvatarConfigured() });
});

module.exports = router;
