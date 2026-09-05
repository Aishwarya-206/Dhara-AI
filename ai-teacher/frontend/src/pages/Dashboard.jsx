import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listSessions()
      .then((data) => setSessions(data.sessions))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Your lessons</h1>
        <Link to="/setup" className="btn-primary">
          + New lesson
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="skeleton-list">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card empty-state">
          <p>You haven't started a lesson yet.</p>
          <Link to="/setup" className="btn-primary">
            Start your first lesson
          </Link>
        </div>
      ) : (
        <div className="session-grid">
          {sessions.map((s) => (
            <Link to={`/teach/${s.id}`} key={s.id} className="card session-card">
              <div className="session-topic">{s.topic || 'Untitled lesson'}</div>
              <div className="session-meta">
                <span className={`badge badge-${s.status}`}>{s.status}</span>
                <span>{s.level}</span>
                <span>{s.language}</span>
              </div>
              <div className="session-stage">Stage: {s.stage}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
