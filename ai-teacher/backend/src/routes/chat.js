const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const teachingEngine = require('../services/teachingEngine');

const router = express.Router();

router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const { materialId, topic, level, language, objective, depth, timeMinutes } = req.body;

    if (!topic && !materialId) {
      return res.status(400).json({ error: 'Provide either a topic or an uploaded material to teach from.' });
    }
    if (!level || !language || !depth || !timeMinutes) {
      return res.status(400).json({ error: 'level, language, depth, and timeMinutes are required.' });
    }

    if (materialId) {
      const material = db.prepare('SELECT id FROM materials WHERE id = ? AND user_id = ?').get(materialId, req.user.userId);
      if (!material) return res.status(404).json({ error: 'Material not found.' });
    }

    const result = await teachingEngine.createSession({
      userId: req.user.userId,
      materialId: materialId || null,
      topic,
      level,
      language,
      objective,
      depth,
      timeMinutes,
    });

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(err.code === 'MISSING_API_KEY' ? 503 : 500).json({ error: err.message || 'Failed to start session.' });
  }
});

router.get('/sessions', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, topic, level, language, stage, status, created_at, updated_at FROM sessions WHERE user_id = ? ORDER BY updated_at DESC')
    .all(req.user.userId);
  res.json({ sessions: rows });
});

router.get('/sessions/:id', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const messages = db
    .prepare('SELECT id, role, content, stage, meta_json, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(req.params.id);

  res.json({ session, messages });
});

router.post('/sessions/:id/message', requireAuth, async (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const result = await teachingEngine.processTurn({ sessionId: req.params.id, userMessage: message });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.code === 'MISSING_API_KEY' ? 503 : 500).json({ error: err.message || 'Failed to process message.' });
  }
});

router.post('/sessions/:id/assessment', requireAuth, async (req, res) => {
  try {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const result = await teachingEngine.generateAssessment(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to generate assessment.' });
  }
});

router.post('/assessments/:id/grade', requireAuth, async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers) return res.status(400).json({ error: 'Answers are required.' });

    const grading = await teachingEngine.gradeAssessment({ assessmentId: req.params.id, answers });
    res.json(grading);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to grade assessment.' });
  }
});

module.exports = router;
