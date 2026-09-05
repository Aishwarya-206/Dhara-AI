const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { extractText } = require('../services/fileParser');
const { indexMaterial } = require('../services/rag');

const router = express.Router();

const uploadDir = process.env.UPLOAD_DIR || './data/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const ALLOWED_EXT = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md'];

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_UPLOAD_MB, 10) || 25) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Unsupported file type. Allowed: PDF, DOC, DOCX, PPT, PPTX, TXT.'));
    }
    cb(null, true);
  },
});

router.post('/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded.' });
    }

    try {
      const text = await extractText(req.file.path, req.file.originalname);
      if (!text || text.trim().length < 20) {
        fs.unlinkSync(req.file.path);
        return res.status(422).json({ error: 'Could not extract readable text from this file.' });
      }

      const materialId = uuidv4();
      db.prepare(
        `INSERT INTO materials (id, user_id, filename, file_type, char_count) VALUES (?, ?, ?, ?, ?)`
      ).run(materialId, req.user.userId, req.file.originalname, path.extname(req.file.originalname), text.length);

      const chunkCount = await indexMaterial(materialId, text);

      // Original file no longer needed after extraction+indexing
      fs.unlink(req.file.path, () => {});

      res.status(201).json({
        materialId,
        filename: req.file.originalname,
        chunkCount,
        charCount: text.length,
      });
    } catch (e) {
      console.error(e);
      if (fs.existsSync(req.file.path)) fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: e.message || 'Failed to process the uploaded file.' });
    }
  });
});

router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT id, filename, file_type, char_count, created_at FROM materials WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user.userId);
  res.json({ materials: rows });
});

router.delete('/:id', requireAuth, (req, res) => {
  const material = db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!material) return res.status(404).json({ error: 'Material not found.' });

  db.prepare('DELETE FROM material_chunks WHERE material_id = ?').run(req.params.id);
  db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
