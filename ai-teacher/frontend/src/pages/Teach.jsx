import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import OnScreenPanel from '../components/OnScreenPanel.jsx';
import AvatarPanel from '../components/AvatarPanel.jsx';
import Assessment from '../components/Assessment.jsx';

function safeParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

export default function Teach() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [latestContent, setLatestContent] = useState(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current && bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function load() {
    try {
      const data = await api.getSession(sessionId);
      setSession(data.session);
      setMessages(data.messages);
      const lastAssistant = [...data.messages].reverse().find((m) => m.role === 'assistant' && m.meta_json);
      if (lastAssistant) {
        const meta = safeParse(lastAssistant.meta_json, null);
        if (meta) setLatestContent(meta.on_screen_content);
      }
      if (data.session.stage === 'assessment' || data.session.status === 'complete') {
        setShowAssessment(true);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput('');
    setSending(true);
    setError('');

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: 'user', content: userMsg, created_at: new Date().toISOString() },
    ]);

    try {
      const result = await api.sendMessage(sessionId, userMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-reply-${Date.now()}`,
          role: 'assistant',
          content: result.reply,
          stage: result.stage,
          meta_json: JSON.stringify(result),
          created_at: new Date().toISOString(),
        },
      ]);
      setLatestContent(result.on_screen_content);
      setSession((s) => ({ ...s, stage: result.stage, current_subtopic: result.current_subtopic }));
      if (result.stage === 'assessment' || result.session_complete) {
        setShowAssessment(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!session) {
    return (
      <div className="page">
        {error ? <div className="alert alert-error">{error}</div> : <p className="muted">Loading lesson…</p>}
      </div>
    );
  }

  const lastAssistantText = [...messages].reverse().find((m) => m.role === 'assistant')?.content || '';

  return (
    <div className="teach-layout">
      <div className="teach-main">
        <div className="teach-header">
          <div>
            <h2>{session.topic}</h2>
            <div className="session-meta">
              <span className="badge">{session.stage}</span>
              <span>{session.level}</span>
              <span>{session.language}</span>
              {session.current_subtopic && <span>· {session.current_subtopic}</span>}
            </div>
          </div>
          {session.status !== 'complete' && (
            <button className="btn-secondary" onClick={() => setShowAssessment(true)}>
              Take final assessment
            </button>
          )}
        </div>

        <div className="chat-window">
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.role}`}>
              <div className="chat-role">{m.role === 'user' ? 'You' : 'AI Teacher'}</div>
              <div className="chat-content">{m.content}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {showAssessment ? (
          <Assessment sessionId={sessionId} onComplete={() => {}} />
        ) : (
          <form className="chat-input-row" onSubmit={handleSend}>
            <input
              placeholder="Type your answer or question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            <button className="btn-primary" type="submit" disabled={sending}>
              {sending ? 'Thinking…' : 'Send'}
            </button>
          </form>
        )}
      </div>

      <aside className="teach-sidebar">
        <OnScreenPanel content={latestContent} stage={session.stage} subtopic={session.current_subtopic} />
        <AvatarPanel text={lastAssistantText} language={session.language} />
      </aside>
    </div>
  );
}
