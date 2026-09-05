const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const JSZip = require('jszip');
const xml2js = require('xml2js');
const path = require('path');

async function parsePdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

async function parseDocx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parsePptx(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return na - nb;
    });

  const parser = new xml2js.Parser();
  const slideTexts = [];

  for (const fileName of slideFiles) {
    const xml = await zip.files[fileName].async('string');
    const parsed = await parser.parseStringPromise(xml);
    const texts = [];
    collectTextRuns(parsed, texts);
    slideTexts.push(texts.join(' '));
  }

  return slideTexts
    .map((t, i) => `Slide ${i + 1}: ${t}`)
    .join('\n\n');
}

// Recursively walk parsed XML looking for <a:t> text run nodes
function collectTextRuns(node, out) {
  if (!node || typeof node !== 'object') return;
  if (node['a:t']) {
    for (const t of node['a:t']) {
      if (typeof t === 'string') out.push(t);
      else if (t && t._) out.push(t._);
    }
  }
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (Array.isArray(val)) {
      val.forEach((v) => collectTextRuns(v, out));
    } else if (typeof val === 'object') {
      collectTextRuns(val, out);
    }
  }
}

async function parseTxt(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  switch (ext) {
    case '.pdf':
      return parsePdf(filePath);
    case '.docx':
      return parseDocx(filePath);
    case '.doc':
      // Legacy .doc binary format is not reliably parseable without extra
      // native tooling; ask the user to convert to .docx/.pdf/.txt for
      // guaranteed accurate extraction.
      throw new Error(
        'Legacy .doc files are not supported. Please upload as .docx, .pdf, or .txt.'
      );
    case '.pptx':
      return parsePptx(filePath);
    case '.ppt':
      throw new Error(
        'Legacy .ppt files are not supported. Please upload as .pptx, .pdf, or .txt.'
      );
    case '.txt':
    case '.md':
      return parseTxt(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

module.exports = { extractText };
