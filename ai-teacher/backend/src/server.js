require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const migrate = require('./migrate');
const authRoutes = require('./routes/auth');
const materialsRoutes = require('./routes/materials');
const chatRoutes = require('./routes/chat');
const profileRoutes = require('./routes/profile');
const mediaRoutes = require('./routes/media');

// Ensure schema exists before handling any requests
migrate();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    openaiConfigured: !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your-openai-key-here'),
    avatarConfigured: !!process.env.DID_API_KEY,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/media', mediaRoutes);

// 404 handler
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Central error handler (catches anything thrown synchronously in routes)
app.use((err, req, res, next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`AI Teacher backend listening on port ${PORT}`);
});
