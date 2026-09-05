import React, { useState } from 'react';
import { api } from '../api.js';

export default function Assessment({ sessionId, onComplete }) {
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [grading, setGrading] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const result = await api.generateAssessment(sessionId);
      setAssessment(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError('');
    try {
      const result = await api.gradeAssessment(assessment.assessmentId, answers);
      setGrading(result);
      onComplete && onComplete(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!assessment) {
    return (
      <div className="card assessment-card">
        <h3>Final Assessment</h3>
        <p className="muted">Ready to check what you've learned?</p>
        {error && <div className="alert alert-error">{error}</div>}
        <button className="btn-primary" onClick={generate} disabled={loading}>
          {loading ? 'Generating quiz…' : 'Start final assessment'}
        </button>
      </div>
    );
  }

  if (grading) {
    return (
      <div className="card assessment-card">
        <h3>Results</h3>
        <div className="score-circle">{Math.round(grading.score_percent)}%</div>
        <div className="grading-section">
          <h4>Strengths</h4>
          <ul>{grading.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="grading-section">
          <h4>Areas to improve</h4>
          <ul>{grading.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
        <div className="grading-section">
          <h4>Recommended next steps</h4>
          <ul>{grading.recommended_next_steps.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      </div>
    );
  }

  return (
    <div className="card assessment-card">
      <h3>Final Assessment</h3>
      {error && <div className="alert alert-error">{error}</div>}
      {assessment.questions.map((q) => (
        <div key={q.id} className="quiz-question">
          <p className="quiz-prompt">{q.question}</p>
          {q.type === 'mcq' && q.options ? (
            <div className="quiz-options">
              {q.options.map((opt, i) => (
                <label key={i} className="quiz-option">
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          ) : (
            <input
              className="quiz-input"
              placeholder="Your answer"
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <button className="btn-primary" onClick={submit} disabled={loading}>
        {loading ? 'Grading…' : 'Submit answers'}
      </button>
    </div>
  );
}
