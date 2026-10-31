/**
 * AIAssistant — FlowDesk Premium AI Component
 *
 * A floating, role-aware AI assistant panel.
 * Renders as a slide-in panel anchored to the bottom-right of the layout.
 * Supports streaming responses, full markdown rendering, dark/light theme.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Square, RotateCcw, ChevronDown,
  Zap, AlertTriangle, Clock, Bot,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useAI } from '../../hooks/useAI';
import { useTheme } from '../../context/ThemeContext';

// ── Markdown renderer — line-by-line block parser ────────────────────────────
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function applyInline(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="fd-ai-code-inline">$1</code>');
}

function isTableSep(line) {
  return /^\|?[\s\-:|]+\|[\s\-:|]*$/.test(line.trim());
}
function isTableRow(line) {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}
function parseTableRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
}

function renderMarkdown(text) {
  if (!text) return '';

  const lines = text.split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(escapeHtml(lines[i]));
        i++;
      }
      i++; // skip closing ```
      out.push(`<pre class="fd-ai-pre">${lang ? `<span class="fd-ai-lang">${escapeHtml(lang)}</span>` : ''}<code class="fd-ai-code-block">${codeLines.join('\n')}</code></pre>`);
      continue;
    }

    // ── Heading
    if (/^### (.+)/.test(trimmed)) {
      out.push(`<h3 class="fd-ai-h3">${applyInline(trimmed.slice(4))}</h3>`);
      i++; continue;
    }
    if (/^## (.+)/.test(trimmed)) {
      out.push(`<h2 class="fd-ai-h2">${applyInline(trimmed.slice(3))}</h2>`);
      i++; continue;
    }
    if (/^# (.+)/.test(trimmed)) {
      out.push(`<h1 class="fd-ai-h1">${applyInline(trimmed.slice(2))}</h1>`);
      i++; continue;
    }

    // ── Horizontal rule
    if (/^---+$/.test(trimmed)) {
      out.push('<hr class="fd-ai-hr" />');
      i++; continue;
    }

    // ── Blockquote
    if (trimmed.startsWith('> ')) {
      out.push(`<blockquote class="fd-ai-blockquote">${applyInline(trimmed.slice(2))}</blockquote>`);
      i++; continue;
    }

    // ── Table: detect header row followed by separator row
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = parseTableRow(trimmed);
      i += 2; // skip header + separator
      const bodyRows = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        bodyRows.push(parseTableRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headers.map(h => `<th class="fd-ai-th">${applyInline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = bodyRows.length
        ? `<tbody>${bodyRows.map(row => `<tr>${row.map(c => `<td class="fd-ai-td">${applyInline(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
        : '';
      out.push(`<div class="fd-ai-table-wrap"><table class="fd-ai-table">${thead}${tbody}</table></div>`);
      continue;
    }

    // ── Bullet list
    if (/^[-*•] /.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[ \t]*[-*•] /.test(lines[i])) {
        items.push(`<li class="fd-ai-li">${applyInline(lines[i].replace(/^[ \t]*[-*•] /, ''))}</li>`);
        i++;
      }
      out.push(`<ul class="fd-ai-ul">${items.join('')}</ul>`);
      continue;
    }

    // ── Numbered list
    if (/^\d+\. /.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(`<li class="fd-ai-li">${applyInline(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      out.push(`<ol class="fd-ai-ol">${items.join('')}</ol>`);
      continue;
    }

    // ── Blank line — just skip
    if (!trimmed) {
      i++; continue;
    }

    // ── Paragraph — collect until blank line or block element
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(```|#{1,3} |---+$|> |\d+\. |[-*•] )/.test(lines[i].trim()) &&
      !isTableRow(lines[i].trim())
    ) {
      paraLines.push(applyInline(lines[i]));
      i++;
    }
    if (paraLines.length) {
      out.push(`<p class="fd-ai-p">${paraLines.join('<br/>')}</p>`);
    }
  }

  return out.join('');
}

// ── Suggested prompts by role ────────────────────────────────────────────────
const SUGGESTIONS = {
  admin: [
    'Which team members are overloaded this week?',
    'Summarize overdue tasks across all clients',
    'Which clients have no activity in the last 7 days?',
    'Give me a quick performance overview',
  ],
  manager: [
    'Show me all tasks due this week',
    'Which projects need urgent attention?',
    'Summarize the team\'s current workload',
    'Which client has the most pending tasks?',
  ],
  client: [
    'What\'s the status of my project?',
    'Any tasks due soon?',
    'Summarize my latest reports',
    'What files have been shared with me?',
  ],
  default: [
    'What tasks are assigned to me this week?',
    'Do I have any overdue tasks?',
    'Show me my upcoming deadlines',
    'What\'s pending in review?',
  ],
};

function getSuggestions(role) {
  return SUGGESTIONS[role] || SUGGESTIONS.default;
}

// ── Animated typing cursor ──────────────────────────────────────────────────
function TypingCursor() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '2px',
        height: '14px',
        background: 'var(--fd-ai-accent)',
        borderRadius: '1px',
        marginLeft: '2px',
        verticalAlign: 'middle',
        animation: 'fdAiCursor 0.8s steps(1) infinite',
      }}
    />
  );
}

// ── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: '8px',
        marginBottom: '16px',
        alignItems: 'flex-start',
        animation: 'fdAiSlideIn 0.2s ease',
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--fd-ai-accent), var(--fd-ai-accent2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '2px',
          }}
        >
          <Bot size={14} color="white" />
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: '85%',
          padding: isUser ? '10px 14px' : '12px 16px',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isUser
            ? 'linear-gradient(135deg, var(--fd-ai-accent), var(--fd-ai-accent2))'
            : 'var(--fd-ai-bubble-bg)',
          color: isUser ? '#fff' : 'var(--fd-ai-text)',
          fontSize: '13.5px',
          lineHeight: '1.65',
          boxShadow: isUser
            ? '0 2px 12px rgba(99,102,241,0.25)'
            : '0 1px 4px var(--fd-ai-shadow)',
          border: !isUser ? '1px solid var(--fd-ai-border)' : 'none',
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div className="fd-ai-prose">
            <div
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
            />
            {message.streaming && <TypingCursor />}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Error banner ─────────────────────────────────────────────────────────────
function ErrorBanner({ error, onDismiss }) {
  if (!error) return null;

  const isRateLimit = error.type === 'rate_limit';

  return (
    <div
      style={{
        margin: '8px 0 4px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: isRateLimit ? 'var(--fd-ai-warn-bg)' : 'var(--fd-ai-error-bg)',
        border: `1px solid ${isRateLimit ? 'var(--fd-ai-warn-border)' : 'var(--fd-ai-error-border)'}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        fontSize: '12.5px',
        color: isRateLimit ? 'var(--fd-ai-warn-text)' : 'var(--fd-ai-error-text)',
      }}
    >
      {isRateLimit
        ? <Clock size={14} style={{ marginTop: 1, flexShrink: 0 }} />
        : <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
      }
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{isRateLimit ? 'Rate limit reached' : 'Something went wrong'}</div>
        <div style={{ opacity: 0.8, marginTop: 2 }}>{error.message}</div>
      </div>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: 0 }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AIAssistant() {
  const { user } = useAuthStore();
  const { isDark } = useTheme();
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearConversation, dismissError } = useAI();

  const [isOpen, setIsOpen]           = useState(false);
  const [input, setInput]             = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  const suggestions = getSuggestions(user?.role);
  const hasMessages  = messages.length > 0;
  const firstName    = user?.name?.split(' ')[0] || 'there';

  // Auto-scroll
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    sendMessage(input);
    setInput('');
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestion = (text) => {
    sendMessage(text);
  };

  return (
    <>
      {/* ── CSS ─────────────────────────────────────────────────────────── */}
      <style>{`
        /* ── Theme-reactive CSS variables ── */
        :root[data-theme="dark"] {
          --fd-ai-accent:        #6366f1;
          --fd-ai-accent2:       #8b5cf6;
          --fd-ai-bg:            #15151f;
          --fd-ai-surface:       #1e1e2e;
          --fd-ai-bubble-bg:     #23233a;
          --fd-ai-border:        rgba(99,102,241,0.18);
          --fd-ai-text:          #e2e8f0;
          --fd-ai-text-secondary:#94a3b8;
          --fd-ai-muted:         #64748b;
          --fd-ai-header-bg:     rgba(21,21,31,0.96);
          --fd-ai-shadow:        rgba(0,0,0,0.25);
          --fd-ai-code-bg:       rgba(99,102,241,0.12);
          --fd-ai-pre-bg:        #0d0d14;
          --fd-ai-pre-border:    rgba(99,102,241,0.15);
          --fd-ai-blockquote-bg: rgba(99,102,241,0.08);
          --fd-ai-blockquote-border: rgba(99,102,241,0.4);
          --fd-ai-error-bg:      rgba(239,68,68,0.1);
          --fd-ai-error-border:  rgba(239,68,68,0.3);
          --fd-ai-error-text:    #f87171;
          --fd-ai-warn-bg:       rgba(245,158,11,0.1);
          --fd-ai-warn-border:   rgba(245,158,11,0.3);
          --fd-ai-warn-text:     #fbbf24;
          --fd-ai-suggestion-hover-bg: rgba(99,102,241,0.12);
        }

        :root[data-theme="light"] {
          --fd-ai-accent:        #4f46e5;
          --fd-ai-accent2:       #7c3aed;
          --fd-ai-bg:            #ffffff;
          --fd-ai-surface:       #f5f5fd;
          --fd-ai-bubble-bg:     #f0f0fb;
          --fd-ai-border:        rgba(79,70,229,0.12);
          --fd-ai-text:          #1e1b4b;
          --fd-ai-text-secondary:#4338ca;
          --fd-ai-muted:         #9ca3af;
          --fd-ai-header-bg:     rgba(255,255,255,0.97);
          --fd-ai-shadow:        rgba(79,70,229,0.08);
          --fd-ai-code-bg:       rgba(79,70,229,0.08);
          --fd-ai-pre-bg:        #f1f1f9;
          --fd-ai-pre-border:    rgba(79,70,229,0.12);
          --fd-ai-blockquote-bg: rgba(79,70,229,0.05);
          --fd-ai-blockquote-border: rgba(79,70,229,0.35);
          --fd-ai-error-bg:      rgba(239,68,68,0.06);
          --fd-ai-error-border:  rgba(239,68,68,0.2);
          --fd-ai-error-text:    #dc2626;
          --fd-ai-warn-bg:       rgba(245,158,11,0.07);
          --fd-ai-warn-border:   rgba(245,158,11,0.25);
          --fd-ai-warn-text:     #b45309;
          --fd-ai-suggestion-hover-bg: rgba(79,70,229,0.07);
        }

        /* ── Animations ── */
        @keyframes fdAiCursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes fdAiSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fdAiPanelOpen {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fdAiGlow {
          0%, 100% { box-shadow: 0 4px 24px rgba(99,102,241,0.35), 0 0 0 0 rgba(99,102,241,0.3); }
          50%       { box-shadow: 0 4px 24px rgba(99,102,241,0.5), 0 0 0 8px rgba(99,102,241,0); }
        }

        /* ── Prose / Markdown styles ── */
        .fd-ai-prose { color: var(--fd-ai-text); }

        .fd-ai-prose .fd-ai-p {
          margin: 0 0 8px 0;
          line-height: 1.65;
        }
        .fd-ai-prose .fd-ai-p:last-child { margin-bottom: 0; }

        .fd-ai-prose .fd-ai-h1 {
          font-size: 16px;
          font-weight: 700;
          color: var(--fd-ai-text);
          margin: 14px 0 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--fd-ai-border);
          line-height: 1.3;
        }
        .fd-ai-prose .fd-ai-h2 {
          font-size: 14.5px;
          font-weight: 700;
          color: var(--fd-ai-text);
          margin: 12px 0 5px;
          line-height: 1.3;
        }
        .fd-ai-prose .fd-ai-h3 {
          font-size: 13px;
          font-weight: 600;
          color: var(--fd-ai-text-secondary);
          margin: 10px 0 4px;
          line-height: 1.3;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .fd-ai-prose .fd-ai-ul,
        .fd-ai-prose .fd-ai-ol {
          margin: 6px 0 8px 0;
          padding-left: 0;
          list-style: none;
        }
        .fd-ai-prose .fd-ai-li {
          position: relative;
          padding-left: 18px;
          margin-bottom: 5px;
          line-height: 1.6;
          color: var(--fd-ai-text);
        }
        .fd-ai-prose .fd-ai-ul .fd-ai-li::before {
          content: '';
          position: absolute;
          left: 5px;
          top: 8px;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--fd-ai-accent);
          opacity: 0.7;
        }
        .fd-ai-prose .fd-ai-ol {
          counter-reset: fd-counter;
        }
        .fd-ai-prose .fd-ai-ol .fd-ai-li {
          counter-increment: fd-counter;
        }
        .fd-ai-prose .fd-ai-ol .fd-ai-li::before {
          content: counter(fd-counter) '.';
          position: absolute;
          left: 0;
          top: 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--fd-ai-accent);
          min-width: 16px;
        }

        .fd-ai-prose .fd-ai-pre {
          background: var(--fd-ai-pre-bg);
          border: 1px solid var(--fd-ai-pre-border);
          border-radius: 8px;
          padding: 12px 14px;
          margin: 8px 0;
          overflow-x: auto;
          scrollbar-width: thin;
        }
        .fd-ai-prose .fd-ai-code-block {
          font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', ui-monospace, monospace;
          font-size: 12px;
          color: var(--fd-ai-text);
          line-height: 1.6;
          white-space: pre;
          display: block;
        }
        .fd-ai-prose .fd-ai-code-inline {
          background: var(--fd-ai-code-bg);
          color: var(--fd-ai-accent);
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
          white-space: nowrap;
        }
        .fd-ai-prose .fd-ai-blockquote {
          border-left: 3px solid var(--fd-ai-blockquote-border);
          background: var(--fd-ai-blockquote-bg);
          padding: 8px 12px;
          margin: 8px 0;
          border-radius: 0 6px 6px 0;
          font-style: italic;
          color: var(--fd-ai-text-secondary);
        }
        .fd-ai-prose .fd-ai-hr {
          border: none;
          border-top: 1px solid var(--fd-ai-border);
          margin: 12px 0;
        }

        /* ── Tables ── */
        .fd-ai-prose .fd-ai-table-wrap {
          width: 100%;
          overflow-x: auto;
          margin: 8px 0;
          border-radius: 8px;
          border: 1px solid var(--fd-ai-border);
        }
        .fd-ai-prose .fd-ai-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          min-width: 260px;
        }
        .fd-ai-prose .fd-ai-th {
          background: var(--fd-ai-surface);
          color: var(--fd-ai-accent);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 8px 12px;
          text-align: left;
          border-bottom: 1px solid var(--fd-ai-border);
          white-space: nowrap;
        }
        .fd-ai-prose .fd-ai-td {
          padding: 7px 12px;
          color: var(--fd-ai-text);
          border-bottom: 1px solid var(--fd-ai-border);
          vertical-align: top;
          line-height: 1.5;
        }
        .fd-ai-prose .fd-ai-table tbody tr:last-child .fd-ai-td {
          border-bottom: none;
        }
        .fd-ai-prose .fd-ai-table tbody tr:hover .fd-ai-td {
          background: var(--fd-ai-suggestion-hover-bg);
          transition: background 0.12s;
        }

        /* ── Code lang label ── */
        .fd-ai-lang {
          display: block;
          font-size: 10px;
          font-family: 'Fira Code', ui-monospace, monospace;
          color: var(--fd-ai-muted);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .fd-ai-prose strong {
          font-weight: 700;
          color: var(--fd-ai-text);
        }
        .fd-ai-prose em {
          font-style: italic;
          color: var(--fd-ai-text-secondary);
        }

        /* ── Input focus ── */
        .fd-ai-input:focus { outline: none; }
        .fd-ai-input::placeholder { color: var(--fd-ai-muted); }

        /* ── Suggestion buttons ── */
        .fd-ai-suggestion-btn {
          transition: all 0.15s ease !important;
        }
        .fd-ai-suggestion-btn:hover {
          background: var(--fd-ai-suggestion-hover-bg) !important;
          border-color: rgba(99,102,241,0.35) !important;
          color: var(--fd-ai-accent) !important;
          transform: translateX(2px);
        }

        /* ── Header buttons ── */
        .fd-ai-icon-btn:hover {
          background: var(--fd-ai-surface) !important;
          color: var(--fd-ai-text) !important;
        }

        /* ── Send button ── */
        .fd-ai-send-btn:hover:not(:disabled) { transform: scale(1.07); }

        /* ── Scrollbar ── */
        .fd-ai-scrollbar::-webkit-scrollbar { width: 4px; }
        .fd-ai-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .fd-ai-scrollbar::-webkit-scrollbar-thumb {
          background: var(--fd-ai-border);
          border-radius: 2px;
        }
      `}</style>

      {/* ── Floating trigger button ──────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="FlowDesk AI Assistant"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fdAiGlow 2.5s ease infinite',
            transition: 'transform 0.2s ease',
          }}
        >
          <Sparkles size={22} color="white" />
        </button>
      )}

      {/* ── AI Panel ─────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            width: 'min(420px, calc(100vw - 32px))',
            height: isMinimized ? 'auto' : 'min(640px, calc(100vh - 48px))',
            borderRadius: '20px',
            background: 'var(--fd-ai-bg)',
            border: '1px solid var(--fd-ai-border)',
            boxShadow: isDark
              ? '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)'
              : '0 24px 80px rgba(79,70,229,0.12), 0 0 0 1px rgba(79,70,229,0.07)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fdAiPanelOpen 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 16px',
              background: 'var(--fd-ai-header-bg)',
              borderBottom: '1px solid var(--fd-ai-border)',
              backdropFilter: 'blur(12px)',
              flexShrink: 0,
            }}
          >
            {/* Logo */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={16} color="white" />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--fd-ai-text)', lineHeight: 1.2 }}>
                FlowDesk AI
              </div>
              <div style={{ fontSize: '11px', color: 'var(--fd-ai-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: isStreaming ? '#f59e0b' : '#22c55e', display: 'inline-block', transition: 'background 0.3s' }} />
                {isStreaming ? 'Thinking…' : `${user?.role?.replace('_', ' ')} · Llama 3.3`}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '2px' }}>
              {hasMessages && (
                <button
                  onClick={clearConversation}
                  title="New conversation"
                  className="fd-ai-icon-btn"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px', borderRadius: '8px', color: 'var(--fd-ai-muted)',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center',
                  }}
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(v => !v)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                className="fd-ai-icon-btn"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '8px', color: 'var(--fd-ai-muted)',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center',
                }}
              >
                <ChevronDown
                  size={15}
                  style={{ transform: isMinimized ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </button>
              <button
                onClick={() => { setIsOpen(false); setIsMinimized(false); }}
                title="Close"
                className="fd-ai-icon-btn"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '8px', color: 'var(--fd-ai-muted)',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* ── Messages area ── */}
              <div
                className="fd-ai-scrollbar"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Welcome state */}
                {!hasMessages && (
                  <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
                    <div
                      style={{
                        width: '52px', height: '52px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 12px',
                      }}
                    >
                      <Zap size={24} color="var(--fd-ai-accent)" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--fd-ai-text)', marginBottom: 4 }}>
                      Hey {firstName} 👋
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--fd-ai-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                      I know your FlowDesk data. Ask me anything<br />about tasks, deadlines, clients, and more.
                    </div>

                    {/* Suggestions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', textAlign: 'left' }}>
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          className="fd-ai-suggestion-btn"
                          onClick={() => handleSuggestion(s)}
                          style={{
                            background: 'var(--fd-ai-surface)',
                            border: '1px solid var(--fd-ai-border)',
                            borderRadius: '10px',
                            padding: '9px 13px',
                            fontSize: '12.5px',
                            color: 'var(--fd-ai-text)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            lineHeight: 1.4,
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Message list */}
                {messages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))}

                {/* Error */}
                <ErrorBanner error={error} onDismiss={dismissError} />

                <div ref={messagesEndRef} />
              </div>

              {/* ── Input area ── */}
              <div
                style={{
                  padding: '12px 14px',
                  borderTop: '1px solid var(--fd-ai-border)',
                  background: 'var(--fd-ai-header-bg)',
                  backdropFilter: 'blur(12px)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    background: 'var(--fd-ai-surface)',
                    border: '1px solid var(--fd-ai-border)',
                    borderRadius: '14px',
                    padding: '8px 8px 8px 14px',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <textarea
                    ref={inputRef}
                    className="fd-ai-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything about your work…"
                    disabled={isStreaming}
                    rows={1}
                    style={{
                      flex: 1,
                      background: 'none',
                      border: 'none',
                      resize: 'none',
                      fontSize: '13.5px',
                      color: 'var(--fd-ai-text)',
                      lineHeight: '1.5',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      fontFamily: 'inherit',
                      caretColor: 'var(--fd-ai-accent)',
                    }}
                    onInput={e => {
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                    }}
                  />

                  {isStreaming ? (
                    <button
                      onClick={stopStreaming}
                      title="Stop"
                      style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: 'var(--fd-ai-error-bg)',
                        border: '1px solid var(--fd-ai-error-border)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, color: 'var(--fd-ai-error-text)', transition: 'all 0.15s',
                      }}
                    >
                      <Square size={13} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="fd-ai-send-btn"
                      title="Send (Enter)"
                      style={{
                        width: '32px', height: '32px', borderRadius: '10px',
                        background: input.trim()
                          ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                          : 'var(--fd-ai-border)',
                        border: 'none',
                        cursor: input.trim() ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.2s',
                      }}
                    >
                      <Send size={14} color={input.trim() ? 'white' : 'var(--fd-ai-muted)'} />
                    </button>
                  )}
                </div>

                <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '10.5px', color: 'var(--fd-ai-muted)' }}>
                  AI uses your scoped FlowDesk data only · Enter to send
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}