const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { chatComplete } = require('./openai');
const { retrieveRelevantChunks } = require('./rag');
const {
  buildPlannerPrompt,
  buildTeachingSystemPrompt,
  buildAssessmentPrompt,
  buildGradingPrompt,
} = require('./prompts');

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch (e) {
    // Attempt to salvage JSON if the model wrapped it in text/fences
    const match = str.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        return fallback;
      }
    }
    return fallback;
  }
}

async function createSession({ userId, materialId, topic, level, language, objective, depth, timeMinutes }) {
  let materialExcerpt = '';
  if (materialId) {
    const chunk = db
      .prepare('SELECT content FROM material_chunks WHERE material_id = ? ORDER BY chunk_index ASC LIMIT 3')
      .all(materialId);
    materialExcerpt = chunk.map((c) => c.content).join('\n');
  }

  const plannerPrompt = buildPlannerPrompt({
    topic,
    level,
    language,
    objective,
    depth,
    timeMinutes,
    hasMaterial: !!materialId,
    materialExcerpt,
  });

  const raw = await chatComplete({
    messages: [{ role: 'user', content: plannerPrompt }],
    jsonMode: true,
    temperature: 0.4,
  });

  const plan = safeJsonParse(raw, {
    lesson_title: topic || 'Lesson',
    teaching_language: language,
    subtopics: [{ title: topic || 'Introduction', objective: objective || 'Understand basics', est_minutes: timeMinutes }],
    final_assessment_questions: 3,
  });

  const sessionId = uuidv4();
  db.prepare(
    `INSERT INTO sessions (id, user_id, material_id, topic, level, language, objective, depth, time_minutes, stage, current_subtopic, plan_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'understand', ?, ?)`
  ).run(
    sessionId,
    userId,
    materialId || null,
    plan.lesson_title || topic,
    level,
    language,
    objective || null,
    depth,
    timeMinutes,
    plan.subtopics && plan.subtopics[0] ? plan.subtopics[0].title : topic,
    JSON.stringify(plan)
  );

  const introMessage = `Welcome! Today we'll cover: ${plan.lesson_title}. Here's the plan: ${plan.subtopics
    .map((s, i) => `${i + 1}. ${s.title}`)
    .join(', ')}. Let's begin with "${plan.subtopics[0].title}". Say "start" or ask me anything to begin.`;

  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, stage) VALUES (?, ?, 'assistant', ?, 'plan')`
  ).run(uuidv4(), sessionId, introMessage);

  db.prepare(
    `UPDATE learner_profiles SET total_sessions = total_sessions + 1, updated_at = datetime('now') WHERE user_id = ?`
  ).run(userId);

  return { sessionId, plan, introMessage };
}

function getSessionHistory(sessionId, limit = 16) {
  const rows = db
    .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId);
  return rows.slice(-limit);
}

function planSummaryText(plan) {
  if (!plan || !plan.subtopics) return '';
  return plan.subtopics.map((s, i) => `${i + 1}. ${s.title} — ${s.objective}`).join('\n');
}

async function processTurn({ sessionId, userMessage }) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) throw new Error('Session not found');

  const plan = safeJsonParse(session.plan_json, { subtopics: [] });

  let groundingContext = '';
  if (session.material_id) {
    const chunks = await retrieveRelevantChunks(
      session.material_id,
      `${session.current_subtopic || ''} ${userMessage}`,
      4
    );
    groundingContext = chunks.join('\n---\n');
  }

  const systemPrompt = buildTeachingSystemPrompt({
    level: session.level,
    language: session.language,
    objective: session.objective,
    depth: session.depth,
    planSummary: planSummaryText(plan),
    groundingContext,
    stage: session.stage,
    currentSubtopic: session.current_subtopic,
  });

  const history = getSessionHistory(sessionId);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: userMessage },
  ];

  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, stage) VALUES (?, ?, 'user', ?, ?)`
  ).run(uuidv4(), sessionId, userMessage, session.stage);

  const raw = await chatComplete({ messages, jsonMode: true, temperature: 0.55 });
  const result = safeJsonParse(raw, {
    reply: raw,
    stage: session.stage,
    current_subtopic: session.current_subtopic,
    misconceptions_detected: [],
    concept_updates: {},
    on_screen_content: { title: session.current_subtopic || '', bullets: [], visual_description: '' },
    session_complete: false,
  });

  db.prepare(
    `INSERT INTO messages (id, session_id, role, content, stage, meta_json) VALUES (?, ?, 'assistant', ?, ?, ?)`
  ).run(uuidv4(), sessionId, result.reply, result.stage, JSON.stringify(result));

  db.prepare(
    `UPDATE sessions SET stage = ?, current_subtopic = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    result.stage,
    result.current_subtopic || session.current_subtopic,
    result.session_complete ? 'complete' : 'active',
    sessionId
  );

  // Update learner profile mastery map
  if (result.concept_updates && Object.keys(result.concept_updates).length > 0) {
    updateLearnerProfile(session.user_id, result.concept_updates);
  }

  return result;
}

function updateLearnerProfile(userId, conceptUpdates) {
  const profile = db.prepare('SELECT * FROM learner_profiles WHERE user_id = ?').get(userId);
  if (!profile) return;

  const mastery = safeJsonParse(profile.concept_mastery_json, {});
  const strengths = safeJsonParse(profile.strengths_json, {});
  const weaknesses = safeJsonParse(profile.weaknesses_json, {});

  for (const [concept, status] of Object.entries(conceptUpdates)) {
    mastery[concept] = status;
    if (status === 'strong') {
      strengths[concept] = (strengths[concept] || 0) + 1;
      delete weaknesses[concept];
    } else if (status === 'weak') {
      weaknesses[concept] = (weaknesses[concept] || 0) + 1;
    }
  }

  db.prepare(
    `UPDATE learner_profiles
     SET concept_mastery_json = ?, strengths_json = ?, weaknesses_json = ?, updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(JSON.stringify(mastery), JSON.stringify(strengths), JSON.stringify(weaknesses), userId);
}

async function generateAssessment(sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) throw new Error('Session not found');

  const msgs = db
    .prepare("SELECT meta_json FROM messages WHERE session_id = ? AND meta_json IS NOT NULL")
    .all(sessionId);

  const conceptsSet = new Set();
  for (const m of msgs) {
    const meta = safeJsonParse(m.meta_json, {});
    if (meta.concept_updates) {
      Object.keys(meta.concept_updates).forEach((c) => conceptsSet.add(c));
    }
    if (meta.current_subtopic) conceptsSet.add(meta.current_subtopic);
  }

  const plan = safeJsonParse(session.plan_json, { subtopics: [], final_assessment_questions: 3 });
  const concepts = conceptsSet.size > 0 ? Array.from(conceptsSet) : plan.subtopics.map((s) => s.title);

  const prompt = buildAssessmentPrompt({
    conceptsCovered: concepts,
    level: session.level,
    language: session.language,
    count: plan.final_assessment_questions || 3,
  });

  const raw = await chatComplete({ messages: [{ role: 'user', content: prompt }], jsonMode: true, temperature: 0.5 });
  const parsed = safeJsonParse(raw, { questions: [] });

  const assessmentId = uuidv4();
  db.prepare(
    `INSERT INTO assessments (id, session_id, questions_json) VALUES (?, ?, ?)`
  ).run(assessmentId, sessionId, JSON.stringify(parsed.questions));

  return { assessmentId, questions: parsed.questions };
}

async function gradeAssessment({ assessmentId, answers }) {
  const assessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(assessmentId);
  if (!assessment) throw new Error('Assessment not found');

  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(assessment.session_id);
  const questions = safeJsonParse(assessment.questions_json, []);

  const prompt = buildGradingPrompt({ questions, answers, language: session.language });
  const raw = await chatComplete({ messages: [{ role: 'user', content: prompt }], jsonMode: true, temperature: 0.3 });
  const grading = safeJsonParse(raw, {
    per_question: [],
    score_percent: 0,
    strengths: [],
    weaknesses: [],
    recommended_next_steps: [],
  });

  db.prepare(
    `UPDATE assessments SET answers_json = ?, score = ? WHERE id = ?`
  ).run(JSON.stringify(answers), grading.score_percent, assessmentId);

  // Fold results into learner profile
  const conceptUpdates = {};
  grading.strengths.forEach((s) => (conceptUpdates[s] = 'strong'));
  grading.weaknesses.forEach((w) => (conceptUpdates[w] = 'weak'));
  if (Object.keys(conceptUpdates).length > 0) {
    updateLearnerProfile(session.user_id, conceptUpdates);
  }

  db.prepare(`UPDATE sessions SET stage = 'complete', status = 'complete' WHERE id = ?`).run(session.id);

  return grading;
}

module.exports = {
  createSession,
  processTurn,
  generateAssessment,
  gradeAssessment,
  getSessionHistory,
};
