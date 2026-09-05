import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Odia', 'Chinese', 'Arabic', 'Portuguese', 'Japanese'];
const LEVELS = ['beginner', 'intermediate', 'advanced'];
const DEPTHS = ['overview', 'standard', 'deep-dive'];

export default function SetupLesson() {
  const [mode, setMode] = useState('topic'); // 'topic' | 'material'
  const [topic, setTopic] = useState('');
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [uploading, setUploading] = useState(false);
  const [level, setLevel] = useState('beginner');
  const [language, setLanguage] = useState('English');
  const [objective, setObjective] = useState('');
  const [depth, setDepth] = useState('standard');
  const [timeMinutes, setTimeMinutes] = useState(20);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.listMaterials().then((d) => setMaterials(d.materials)).catch(() => {});
  }, []);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const result = await api.uploadMaterial(file);
      setMaterials((prev) => [{ id: result.materialId, filename: result.filename, file_type: '' }, ...prev]);
      setSelectedMaterial(result.materialId);
      setMode('material');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleStart(e) {
    e.preventDefault();
    setError('');
    if (mode === 'topic' && !topic.trim()) {
      setError('Please enter a topic to teach.');
      return;
    }
    if (mode === 'material' && !selectedMaterial) {
      setError('Please upload or select a material.');
      return;
    }

    setStarting(true);
    try {
      const payload = {
        level,
        language,
        objective,
        depth,
        timeMinutes: Number(timeMinutes),
      };
      if (mode === 'topic') payload.topic = topic;
      else payload.materialId = selectedMaterial;

      const result = await api.startSession(payload);
      navigate(`/teach/${result.sessionId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Plan your lesson</h1>
      <p className="muted">Tell the AI Teacher what to teach and how you learn best.</p>

      <form className="card setup-card" onSubmit={handleStart}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tab-switch">
          <button type="button" className={mode === 'topic' ? 'tab active' : 'tab'} onClick={() => setMode('topic')}>
            Teach a topic
          </button>
          <button
            type="button"
            className={mode === 'material' ? 'tab active' : 'tab'}
            onClick={() => setMode('material')}
          >
            Teach from my material
          </button>
        </div>

        {mode === 'topic' ? (
          <div className="form-group">
            <label>What do you want to learn?</label>
            <input
              placeholder="e.g. Photosynthesis, Newton's Laws, Recursion in programming"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>
        ) : (
          <div className="form-group">
            <label>Upload learning material (PDF, DOC, DOCX, PPT, PPTX, TXT)</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
              onChange={handleUpload}
              disabled={uploading}
            />
            {uploading && <p className="muted">Uploading and indexing your file…</p>}

            {materials.length > 0 && (
              <>
                <label style={{ marginTop: '1rem' }}>Or pick a previously uploaded file</label>
                <select value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)}>
                  <option value="">— Select material —</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.filename}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label>Learner level</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Teaching language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Depth</label>
            <select value={depth} onChange={(e) => setDepth(e.target.value)}>
              {DEPTHS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Time available (minutes)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={timeMinutes}
              onChange={(e) => setTimeMinutes(e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label>Learning objective (optional)</label>
          <input
            placeholder="e.g. Pass my exam, build intuition, prepare for an interview"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
          />
        </div>

        <button className="btn-primary btn-block" type="submit" disabled={starting || uploading}>
          {starting ? 'Preparing your lesson…' : 'Start lesson'}
        </button>
      </form>
    </div>
  );
}
