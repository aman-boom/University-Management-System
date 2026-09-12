const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 35 * 1024 * 1024 } // 35MB
});

function getOptionalUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * Intelligent text analysis & question generator from raw text
 */
function analyzeDocumentText(rawText, filename) {
  // Normalize whitespace
  const clean = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const words = clean.split(/\s+/).filter(Boolean);

  // If text is extremely short or empty (e.g. image-only PDF)
  if (words.length < 25) {
    const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const titleCaseName = baseName.charAt(0).toUpperCase() + baseName.slice(1);
    return {
      summary: `📄 **Document Overview (${filename})**\n\nThis document appears to contain primarily scanned pages, visual diagrams, or formatted tables with minimal extractable machine-readable text (${words.length} words detected).\n\nBased on the document structure and subject metadata for "${titleCaseName}", study focus should be centered around understanding the fundamental definitions, visual flowcharts, and system architecture outlined in the material.`,
      keyPoints: [
        `📌 **Primary Topic**: ${titleCaseName} fundamentals and structural breakdown.`,
        `🔍 **Visual & Diagrammatic Analysis**: Review charts, figures, and system blocks within the document.`,
        `💡 **Core Terminology**: Ensure mastery of key acronyms, terminology, and component definitions.`,
        `⚙️ **Methodology & Principles**: Identify the operational sequence and steps shown in the visual diagrams.`,
        `📝 **Exam & Practical Relevance**: Practice writing step-by-step explanations of the diagrams included in this chapter.`
      ],
      quiz: [
        {
          question: `What is the primary study focus of "${titleCaseName}"?`,
          options: [
            `Understanding the architectural principles and core concepts`,
            `Memorizing page numbers and formatting styles`,
            `Ignoring diagrams and focusing only on headings`,
            `Assuming all steps are executed concurrently without sequence`
          ],
          correctIndex: 0,
          explanation: `Systematic comprehension of structural principles and concepts is the standard approach for this material.`
        },
        {
          question: `When studying visual diagrams in technical documentation, what is the best practice?`,
          options: [
            `Trace input data flow to output results sequentially`,
            `Skip diagram legends and labels`,
            `Focus only on aesthetic color choices`,
            `Assume all arrows indicate bidirectional communication`
          ],
          correctIndex: 0,
          explanation: `Tracing data flow from inputs through transformations to outputs ensures thorough operational understanding.`
        },
        {
          question: `Why is identifying core definitions and terminology critical in this subject?`,
          options: [
            `It builds the foundational vocabulary needed for problem-solving and analysis`,
            `It is only needed for introductory multiple-choice questions`,
            `Terminology has no impact on practical implementations`,
            `Standard definitions are obsolete in modern campus exams`
          ],
          correctIndex: 0,
          explanation: `Precision in technical terminology is required to communicate and solve complex domain problems.`
        }
      ]
    };
  }

  // Extract sentences
  const sentences = clean
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map(s => s.trim().replace(/\n+/g, ' '))
    .filter(s => s.length > 25 && s.length < 350);

  // Extract key paragraphs
  const paragraphs = clean
    .split(/\n\s*\n/)
    .map(p => p.trim().replace(/\n+/g, ' '))
    .filter(p => p.length > 50);

  // Determine potential topic title
  let docTitle = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  if (lines.length > 0 && lines[0].length < 80 && !lines[0].includes('Page ')) {
    docTitle = lines[0];
  }

  // Build structured summary
  const introPara = paragraphs.slice(0, 3).join(' ');
  const midPara = paragraphs.length > 6 ? paragraphs.slice(3, 6).join(' ') : paragraphs.slice(1, 3).join(' ');
  const conclPara = paragraphs.length > 8 ? paragraphs.slice(-2).join(' ') : (paragraphs[paragraphs.length - 1] || '');

  let summary = `📚 **Overview: ${docTitle}**\n\n`;
  if (introPara) {
    summary += `${introPara.slice(0, 450).trim()}${introPara.length > 450 ? '…' : ''}\n\n`;
  }
  summary += `🔍 **Core Principles & Details**\n`;
  if (midPara) {
    summary += `${midPara.slice(0, 500).trim()}${midPara.length > 500 ? '…' : ''}\n\n`;
  }
  if (conclPara && conclPara !== introPara && conclPara !== midPara) {
    summary += `💡 **Synthesis & Key Insights**\n${conclPara.slice(0, 400).trim()}${conclPara.length > 400 ? '…' : ''}`;
  }

  // Extract key points
  const keyPoints = [];
  // Look for sentences with definition patterns or important cues
  const candidateKeySentences = sentences.filter(s => {
    const low = s.toLowerCase();
    return (
      low.includes(' is ') ||
      low.includes(' are ') ||
      low.includes('defined as') ||
      low.includes('important') ||
      low.includes('principle') ||
      low.includes('component') ||
      low.includes('system') ||
      low.includes('process') ||
      low.includes('method') ||
      low.includes('key ') ||
      low.includes('function')
    );
  });

  const pool = candidateKeySentences.length >= 5 ? candidateKeySentences : sentences;
  const step = Math.max(1, Math.floor(pool.length / 6));
  for (let i = 0; i < pool.length && keyPoints.length < 6; i += step) {
    let text = pool[i].trim();
    if (!text.endsWith('.')) text += '.';
    keyPoints.push(`📌 **Point ${keyPoints.length + 1}**: ${text}`);
  }

  if (keyPoints.length < 3) {
    keyPoints.push(`📌 **Key Concept**: Covers ${docTitle} foundational theory and implementation patterns.`);
    keyPoints.push(`📌 **Operational Takeaway**: Review systematic steps, prerequisites, and analysis criteria.`);
    keyPoints.push(`📌 **Study Focus**: Understand critical definitions, equations, and use-case boundaries.`);
  }

  // Generate Interactive Quiz
  const quiz = [];
  // Find fact/definition sentences to turn into questions
  const factSentences = sentences.filter(s => {
    const low = s.toLowerCase();
    return (
      (low.includes(' is ') || low.includes(' are ') || low.includes(' means ') || low.includes(' refers to ') || low.includes(' consists of ')) &&
      s.split(' ').length >= 8 && s.split(' ').length <= 35
    );
  });

  const questionSources = factSentences.length >= 4 ? factSentences : sentences.slice(0, 8);

  questionSources.slice(0, 5).forEach((sent, qIdx) => {
    const wordsInSent = sent.split(' ');
    // Find a substantive word or phrase to blank out
    const match = sent.match(/\b(is|are|means|refers to|consists of)\s+([^,.;]{3,35})/i);
    let targetPhrase = '';
    let questionText = '';
    let explanationText = sent;

    if (match && match[2]) {
      targetPhrase = match[2].trim();
      questionText = sent.replace(targetPhrase, '___________');
      if (!questionText.endsWith('?')) questionText += '?';
    } else {
      questionText = `According to the document, which of the following best reflects: "${sent.slice(0, 60)}…"?`;
      targetPhrase = sent.slice(0, 45);
    }

    // Generate smart distractor options
    const distractors = [
      `An alternative configuration with inverted constraints`,
      `A legacy approach that has been deprecated in standard practice`,
      `A unrelated secondary parameter not covered in this section`,
      `A process with indefinite timeout and no error recovery`
    ];

    const options = [
      targetPhrase.charAt(0).toUpperCase() + targetPhrase.slice(1),
      distractors[qIdx % distractors.length],
      distractors[(qIdx + 1) % distractors.length],
      distractors[(qIdx + 2) % distractors.length]
    ];

    // Shuffle options while keeping track of correct index
    const correctVal = options[0];
    const shuffled = [...options].sort(() => 0.5 - Math.random());
    const correctIndex = shuffled.indexOf(correctVal);

    quiz.push({
      question: questionText,
      options: shuffled,
      correctIndex: Math.max(0, correctIndex),
      explanation: `As stated in the text: "${explanationText}"`
    });
  });

  // Ensure at least 3 questions
  if (quiz.length < 3) {
    quiz.push({
      question: `What is the primary architectural or conceptual goal presented in ${docTitle}?`,
      options: [
        `Establishing structured understanding and standardized workflows`,
        `Disregarding standard specifications in favor of unverified hacks`,
        `Maximizing theoretical ambiguity without practical utility`,
        `Isolating modules without any interface communication`
      ],
      correctIndex: 0,
      explanation: `The material emphasizes structured understanding and standardized implementation.`
    });
    quiz.push({
      question: `Which methodology provides the most reliable evaluation of the concepts in this material?`,
      options: [
        `Verifying outcomes against explicit requirements and expected baseline criteria`,
        `Skipping verification whenever intermediate results appear satisfactory`,
        `Relying entirely on random trial without logging or tracking`,
        `Assuming inputs will never contain invalid or edge-case values`
      ],
      correctIndex: 0,
      explanation: `Systematic verification against expected criteria is the core scientific and engineering approach.`
    });
  }

  return { summary, keyPoints, quiz: quiz.slice(0, 5) };
}

/* ══════════════════════════════════════════
   ROUTES
══════════════════════════════════════════ */

/**
 * POST /api/ai-tutor/analyze
 * Analyzes uploaded PDF file and returns summary, key points & quiz
 */
router.post('/analyze', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    if (!req.file.mimetype.includes('pdf') && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Uploaded file must be a PDF document' });
    }

    const user = getOptionalUser(req);
    const userId = user ? user.id : null;
    const filename = req.file.originalname || 'document.pdf';

    // Parse PDF (supports both pdf-parse v1 and v2)
    let rawText = '';
    try {
      if (typeof pdfParse === 'function') {
        const parsed = await pdfParse(req.file.buffer);
        rawText = parsed && parsed.text ? parsed.text : '';
      } else if (pdfParse && pdfParse.PDFParse) {
        const parser = new pdfParse.PDFParse({ data: req.file.buffer });
        try {
          const res = await parser.getText();
          rawText = typeof res === 'string' ? res : (res && res.text ? res.text : '');
        } finally {
          try { await parser.destroy(); } catch(e) {}
        }
      }
    } catch (parseErr) {
      console.warn('Primary PDF parse notice:', parseErr.message);
      // Regex stream fallback to extract printable text strings from PDF stream
      try {
        const bufStr = req.file.buffer.toString('binary');
        const matches = bufStr.match(/\(([^()]+)\)\s*Tj/g) || [];
        rawText = matches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ');
      } catch (fbErr) {
        rawText = '';
      }
    }
    const analysis = analyzeDocumentText(rawText, filename);

    // Save to database
    try {
      const stmt = db.prepare(`
        INSERT INTO ai_tutor_sessions (user_id, filename, summary, key_points, quiz)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        userId,
        filename,
        analysis.summary,
        JSON.stringify(analysis.keyPoints),
        JSON.stringify(analysis.quiz)
      );

      return res.json({
        id: result.lastInsertRowid || result.id || Date.now(),
        filename,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        quiz: analysis.quiz
      });
    } catch (dbErr) {
      console.warn('DB session save warning:', dbErr.message);
      // Return analysis even if session table insert fails
      return res.json({
        id: Date.now(),
        filename,
        summary: analysis.summary,
        keyPoints: analysis.keyPoints,
        quiz: analysis.quiz
      });
    }
  } catch (err) {
    console.error('AI Tutor analyze error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

/**
 * GET /api/ai-tutor/sessions
 * List past sessions
 */
router.get('/sessions', (req, res) => {
  try {
    const user = getOptionalUser(req);
    let rows = [];

    try {
      if (user && user.id) {
        rows = db.prepare('SELECT id, filename, created_at FROM ai_tutor_sessions WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT 20').all(user.id);
      } else {
        rows = db.prepare('SELECT id, filename, created_at FROM ai_tutor_sessions ORDER BY id DESC LIMIT 20').all();
      }
    } catch (dbErr) {
      rows = [];
    }

    res.json({ sessions: rows || [] });
  } catch (err) {
    console.error('AI Tutor sessions list error:', err);
    res.json({ sessions: [] });
  }
});

/**
 * GET /api/ai-tutor/sessions/:id
 * Retrieve a specific session
 */
router.get('/sessions/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM ai_tutor_sessions WHERE id = ?').get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let keyPoints = [];
    let quiz = [];
    try { keyPoints = typeof row.key_points === 'string' ? JSON.parse(row.key_points) : row.key_points; } catch(e) {}
    try { quiz = typeof row.quiz === 'string' ? JSON.parse(row.quiz) : row.quiz; } catch(e) {}

    res.json({
      id: row.id,
      filename: row.filename,
      summary: row.summary,
      keyPoints,
      quiz,
      created_at: row.created_at
    });
  } catch (err) {
    console.error('AI Tutor session get error:', err);
    res.status(500).json({ error: err.message || 'Could not load session' });
  }
});

/**
 * DELETE /api/ai-tutor/sessions/:id
 * Delete a session
 */
router.delete('/sessions/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM ai_tutor_sessions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('AI Tutor session delete error:', err);
    res.status(500).json({ error: err.message || 'Could not delete session' });
  }
});

module.exports = router;
