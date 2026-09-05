const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { embedBatch, embedText } = require('./openai');

const CHUNK_SIZE = 900; // approx characters per chunk
const CHUNK_OVERLAP = 150;

function chunkText(text) {
  const clean = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    let chunk = clean.slice(start, end);
    // try to break on a sentence/paragraph boundary if possible
    if (end < clean.length) {
      const lastBreak = Math.max(chunk.lastIndexOf('\n'), chunk.lastIndexOf('. '));
      if (lastBreak > CHUNK_SIZE * 0.5) {
        chunk = chunk.slice(0, lastBreak + 1);
      }
    }
    chunks.push(chunk.trim());
    start += chunk.length - CHUNK_OVERLAP;
    if (chunk.length === 0) break;
  }
  return chunks.filter((c) => c.length > 20);
}

async function indexMaterial(materialId, fullText) {
  const chunks = chunkText(fullText);
  if (chunks.length === 0) {
    throw new Error('No extractable text was found in this file.');
  }

  // Batch embeddings in groups to stay within request limits
  const BATCH = 50;
  const insert = db.prepare(
    `INSERT INTO material_chunks (id, material_id, chunk_index, content, embedding_json)
     VALUES (?, ?, ?, ?, ?)`
  );

  const insertMany = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });

  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const embeddings = await embedBatch(slice);
    const rows = slice.map((content, j) => [
      uuidv4(),
      materialId,
      i + j,
      content,
      JSON.stringify(embeddings[j]),
    ]);
    insertMany(rows);
  }

  return chunks.length;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function retrieveRelevantChunks(materialId, query, topK = 5) {
  const rows = db
    .prepare('SELECT content, embedding_json FROM material_chunks WHERE material_id = ?')
    .all(materialId);

  if (rows.length === 0) return [];

  const queryEmbedding = await embedText(query);

  const scored = rows.map((row) => ({
    content: row.content,
    score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding_json)),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.content);
}

module.exports = { chunkText, indexMaterial, retrieveRelevantChunks };
