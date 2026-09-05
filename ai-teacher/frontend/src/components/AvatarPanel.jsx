import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export default function AvatarPanel({ text, language }) {
  const [avatarConfigured, setAvatarConfigured] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    api
      .avatarStatus()
      .then((d) => setAvatarConfigured(d.configured))
      .catch(() => setAvatarConfigured(false));
  }, []);

  useEffect(() => {
    setVideoUrl('');
    setAudioUrl('');
    setError('');
  }, [text]);

  async function playVoice() {
    if (!text) return;
    setLoadingAudio(true);
    setError('');
    try {
      const blob = await api.speak(text);
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setTimeout(() => audioRef.current && audioRef.current.play(), 50);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingAudio(false);
    }
  }

  async function generateVideo() {
    if (!text) return;
    setLoadingVideo(true);
    setError('');
    try {
      const result = await api.avatarVideo(text, language);
      setVideoUrl(result.videoUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingVideo(false);
    }
  }

  return (
    <div className="avatar-panel">
      <div className="avatar-frame">
        {videoUrl ? (
          <video src={videoUrl} controls autoPlay className="avatar-video" />
        ) : (
          <div className="avatar-placeholder">
            <span className="avatar-emoji">🧑‍🏫</span>
          </div>
        )}
      </div>

      <div className="avatar-controls">
        <button className="btn-secondary" onClick={playVoice} disabled={!text || loadingAudio}>
          {loadingAudio ? 'Synthesizing…' : '🔊 Play voice'}
        </button>
        <button
          className="btn-secondary"
          onClick={generateVideo}
          disabled={!text || loadingVideo || avatarConfigured === false}
          title={avatarConfigured === false ? 'Set DID_API_KEY on the server to enable avatar video' : ''}
        >
          {loadingVideo ? 'Rendering video…' : '🎬 Generate avatar video'}
        </button>
      </div>

      {avatarConfigured === false && (
        <p className="muted small">
          Avatar video isn't configured on this server (set DID_API_KEY). Voice narration still works fully.
        </p>
      )}
      {error && <div className="alert alert-error small">{error}</div>}

      {audioUrl && <audio ref={audioRef} src={audioUrl} controls className="audio-player" />}
    </div>
  );
}
