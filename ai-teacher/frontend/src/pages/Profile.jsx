import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    api
      .getProfile()
      .then((data) => {
        setProfile(data.profile);
        setRecentSessions(data.recentSessions);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadRecommendations() {
    setLoadingRecs(true);
    try {
      const data = await api.getRecommendations();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingRecs(false);
    }
  }

  if (loading) return <div className="page"><p className="muted">Loading profile…</p></div>;
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>;

  const strengthKeys = Object.keys(profile.strengths || {});
  const weaknessKeys = Object.keys(profile.weaknesses || {});

  return (
    <div className="page">
      <h1>Your learning profile</h1>

      <div className="stat-row">
        <div className="card stat-card">
          <div className="stat-value">{profile.totalSessions}</div>
          <div className="stat-label">Lessons completed</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{profile.defaultLevel}</div>
          <div className="stat-label">Default level</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{profile.defaultLanguage}</div>
          <div className="stat-label">Default language</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h3>Strong concepts</h3>
          {strengthKeys.length === 0 ? (
            <p className="muted">None yet — keep learning!</p>
          ) : (
            <ul className="tag-list">
              {strengthKeys.map((k) => (
                <li key={k} className="tag tag-strong">{k}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h3>Weak concepts</h3>
          {weaknessKeys.length === 0 ? (
            <p className="muted">None identified yet.</p>
          ) : (
            <ul className="tag-list">
              {weaknessKeys.map((k) => (
                <li key={k} className="tag tag-weak">{k}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Recommended learning path</h3>
        {recommendations.length === 0 ? (
          <button className="btn-secondary" onClick={loadRecommendations} disabled={loadingRecs}>
            {loadingRecs ? 'Thinking…' : 'Get personalized recommendations'}
          </button>
        ) : (
          <ol>
            {recommendations.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        )}
      </div>

      <div className="card">
        <h3>Recent sessions</h3>
        {recentSessions.length === 0 ? (
          <p className="muted">No sessions yet.</p>
        ) : (
          <table className="simple-table">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Level</th>
                <th>Language</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentSessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.topic}</td>
                  <td>{s.level}</td>
                  <td>{s.language}</td>
                  <td>{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
