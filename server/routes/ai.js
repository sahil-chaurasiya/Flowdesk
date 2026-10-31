/**
 * AI Assistant Routes — FlowDesk
 * /api/ai
 *
 * All routes require JWT auth (protect middleware).
 * Context is ALWAYS built server-side via aiContextBuilder.
 * The frontend NEVER controls what data the AI sees.
 */

const express  = require('express');
const router   = express.Router();
const { protect }         = require('../middleware/auth');
const { aiRateLimiter }   = require('../middleware/aiRateLimiter');
const { streamAIResponse, getAIResponse } = require('../services/groqService');
const { asyncHandler }    = require('../middleware/error');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat/stream  — streaming SSE endpoint (primary)
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/chat/stream',
  protect,
  aiRateLimiter,
  async (req, res) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ success: false, message: 'messages array is required' });
      }

      // Sanitize messages — only allow role/content, strip everything else
      // Cap conversation history at last 20 turns to stay within context limits
      const sanitized = messages
        .slice(-20)
        .filter(m => m.role && m.content && typeof m.content === 'string')
        .map(m => ({
          role:    ['user', 'assistant'].includes(m.role) ? m.role : 'user',
          content: m.content.slice(0, 4000), // cap per-message length
        }));

      if (sanitized.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid messages provided' });
      }

      // req.user is set by protect middleware — context built server-side inside groqService
      await streamAIResponse(req.user, sanitized, res);

    } catch (err) {
      console.error('[AI Route] Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'AI service error. Please try again.' });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'AI service error' })}\n\n`);
        res.end();
      }
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/chat  — non-streaming fallback
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  '/chat',
  protect,
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array is required' });
    }

    const sanitized = messages
      .slice(-20)
      .filter(m => m.role && m.content && typeof m.content === 'string')
      .map(m => ({
        role:    ['user', 'assistant'].includes(m.role) ? m.role : 'user',
        content: m.content.slice(0, 4000),
      }));

    const result = await getAIResponse(req.user, sanitized);

    res.json({
      success: true,
      message: result.content,
      usage: result.usage,
      rateLimit: req.aiRateLimit,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/ai/status  — check if AI is available + rate limit info
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  '/status',
  protect,
  aiRateLimiter,
  (req, res) => {
    res.json({
      success: true,
      available: !!process.env.GROQ_API_KEY,
      rateLimit: req.aiRateLimit,
      model: 'llama-3.3-70b-versatile',
    });
  }
);

module.exports = router;
