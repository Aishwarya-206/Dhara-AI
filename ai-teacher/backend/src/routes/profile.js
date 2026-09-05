const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { chatComplete } = require('../services/openai');

const router = express.Router();

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

router.get('/', requireAuth, (req, res) => {
  const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(req.user.userId);
  if (!profile) return res.status(404).json({ error: 'Profile not found.' });

  const sessions = db
    .prepare('SELECT id, topic, level, language, stage, status, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(req.user.userId);

  res.json({
    profile: {
      defaultLevel: profile.default_level,
      defaultLanguage: profile.default_language,
      strengths: safeParse(profile.strengths_json, {}),
      weaknesses: safeParse(profile.weaknesses_json, {}),
      conceptMastery: safeParse(profile.concept_mastery_json, {}),
      totalSessions: profile.total_sessions,
    },
    recentSessions: sessions,
  });
});

router.put('/', requireAuth, (req, res) => {
  const { defaultLevel, defaultLanguage } = req.body;
  db.prepare(
    `UPDATE learner_profiles SET default_level = COALESCE(?, default_level), default_language = COALESCE(?, default_language), updated_at = datetime('now') WHERE user_id = ?`
  ).run(defaultLevel || null, defaultLanguage || null, req.user.userId);
  res.json({ success: true });
});

router.get('/recommendations', requireAuth, async (req, res) => {
  try {
    const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(req.user.userId);
    const weaknesses = safeParse(profile.weaknesses_json, {});
    const strengths = safeParse(profile.strengths_json, {});

    if (Object.keys(weaknesses).length === 0 && Object.keys(strengths).length === 0) {
      return res.json({ recommendations: ['Complete a lesson to receive personalized recommendations.'] });
    }

    const prompt = `A learner has these weak concepts: ${Object.keys(weaknesses).join(', ') || 'none'} and strong concepts: ${Object.keys(strengths).join(', ') || 'none'}.
Suggest a short prioritized learning path of 3-5 next steps as a JSON object: { "recommendations": [string] }`;

    const raw = await chatComplete({ messages: [{ role: 'user', content: prompt }], jsonMode: true, temperature: 0.5 });
    const parsed = safeParse(raw, { recommendations: [] });
    res.json(parsed);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate recommendations.' });
  }
});

module.exports = router;
