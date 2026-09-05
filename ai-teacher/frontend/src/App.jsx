import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import SetupLesson from './pages/SetupLesson.jsx';
import Teach from './pages/Teach.jsx';
import Profile from './pages/Profile.jsx';
import { setToken } from './api.js';

function useAuth() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('ai_teacher_user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = (token, userObj) => {
    setToken(token);
    localStorage.setItem('ai_teacher_user', JSON.stringify(userObj));
    setUser(userObj);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem('ai_teacher_user');
    setUser(null);
  };

  return { user, login, logout };
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function NavBar({ user, onLogout }) {
  const navigate = useNavigate();
  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <span className="brand-icon">🎓</span> AI Teacher
      </Link>
      {user && (
        <nav className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/setup">New Lesson</Link>
          <Link to="/profile">Profile</Link>
          <button
            className="btn-ghost"
            onClick={() => {
              onLogout();
              navigate('/login');
            }}
          >
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  const { user, login, logout } = useAuth();

  return (
    <div className="app-shell">
      <NavBar user={user} onLogout={logout} />
      <main className="app-main">
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={login} />} />
          <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register onLogin={login} />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute user={user}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/setup"
            element={
              <ProtectedRoute user={user}>
                <SetupLesson />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teach/:sessionId"
            element={
              <ProtectedRoute user={user}>
                <Teach />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute user={user}>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
          <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </main>
    </div>
  );
}
