/**
 * AIAssistant — FlowDesk Premium AI Component
 *
 * A floating, role-aware AI assistant panel.
 * Renders as a slide-in panel anchored to the bottom-right of the layout.
 * Supports streaming responses, markdown rendering, conversation history.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, X, Send, Square, RotateCcw, ChevronDown,
  Zap, AlertTriangle, Clock, Bot,
} from 'lucide-react';
import useAuthStore from '../../context/authStore';
import { useAI } from '../../hooks/useAI';

// ── Tiny markdown renderer (no dep needed — handles the common cases) ────────
function renderMarkdown(text) {
  if (!text) return '';
  return text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="fd-ai-code-inline">$1</code>')
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="fd-ai-h3">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="fd-ai-h2">$1</h2>')
    // Bullet lists
    .replace(/^\s*[-*] (.+)/gm, '<li class="fd-ai-li">$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)/gm, '<li class="fd-ai-li fd-ai-li-num">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="fd-ai-hr" />')
    // Line breaks (double newline = paragraph break)
    .replace(/\n\n/g, '</p><p class="fd-ai-p">')
    .replace(/\n/g, '<br/>');
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
          maxWidth: '82%',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          background: isUser
            ? 'linear-gradient(135deg, var(--fd-ai-accent), var(--fd-ai-accent2))'
            : 'var(--fd-ai-bubble-bg)',
          color: isUser ? '#fff' : 'var(--fd-ai-text)',
          fontSize: '13.5px',
          lineHeight: '1.6',
          boxShadow: isUser
            ? '0 2px 12px rgba(99,102,241,0.25)'
            : '0 1px 4px rgba(0,0,0,0.08)',
          border: !isUser ? '1px solid var(--fd-ai-border)' : 'none',
        }}
      >
        {isUser ? (
          <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
        ) : (
          <div>
            <p
              className="fd-ai-p"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              style={{ margin: 0 }}
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
        margin: '8px 16px',
        padding: '10px 14px',
        borderRadius: '10px',
        background: isRateLimit ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
        border: `1px solid ${isRateLimit ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        fontSize: '12.5px',
        color: isRateLimit ? '#d97706' : '#dc2626',
      }}
    >
      {isRateLimit ? <Clock size={14} style={{ marginTop: 1, flexShrink: 0 }} /> : <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />}
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
  const { messages, isStreaming, error, sendMessage, stopStreaming, clearConversation, dismissError } = useAI();

  const [isOpen, setIsOpen]       = useState(false);
  const [input, setInput]         = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const isDark = document.documentElement.classList.contains('dark') ||
    window.matchMedia('(prefers-color-scheme: dark)').matches;

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
      {/* ── CSS keyframes ─────────────────────────────────────────────── */}
      <style>{`
        :root {
          --fd-ai-accent:    #6366f1;
          --fd-ai-accent2:   #8b5cf6;
          --fd-ai-bg:        ${isDark ? '#16161e' : '#ffffff'};
          --fd-ai-surface:   ${isDark ? '#1e1e2e' : '#f8f8fc'};
          --fd-ai-bubble-bg: ${isDark ? '#252535' : '#f3f3fb'};
          --fd-ai-border:    ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.12)'};
          --fd-ai-text:      ${isDark ? '#e2e8f0' : '#1e1b4b'};
          --fd-ai-muted:     ${isDark ? '#64748b' : '#9ca3af'};
          --fd-ai-header-bg: ${isDark ? 'rgba(22,22,30,0.95)' : 'rgba(255,255,255,0.97)'};
        }
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
        @keyframes fdAiPulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.08); }
        }
        @keyframes fdAiGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          50%       { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
        }
        .fd-ai-p { margin: 0 0 6px 0; }
        .fd-ai-h2 { font-size: 15px; font-weight: 700; margin: 12px 0 6px; }
        .fd-ai-h3 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
        .fd-ai-li { margin-left: 16px; margin-bottom: 3px; list-style: disc; display: list-item; }
        .fd-ai-li-num { list-style: decimal; }
        .fd-ai-code-inline {
          background: ${isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)'};
          color: var(--fd-ai-accent);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 12px;
          font-family: 'Fira Code', 'Cascadia Code', monospace;
        }
        .fd-ai-hr { border: none; border-top: 1px solid var(--fd-ai-border); margin: 10px 0; }
        .fd-ai-input:focus { outline: none; }
        .fd-ai-suggestion-btn:hover {
          background: rgba(99,102,241,0.1) !important;
          border-color: rgba(99,102,241,0.4) !important;
          color: var(--fd-ai-accent) !important;
        }
        .fd-ai-send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .fd-ai-scrollbar::-webkit-scrollbar { width: 4px; }
        .fd-ai-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .fd-ai-scrollbar::-webkit-scrollbar-thumb { background: var(--fd-ai-border); border-radius: 2px; }
      `}</style>

      {/* ── Floating trigger button ──────────────────────────────────── */}
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
            boxShadow: '0 4px 24px rgba(99,102,241,0.4)',
            animation: 'fdAiGlow 2.5s ease infinite',
            transition: 'transform 0.2s ease',
          }}
        >
          <Sparkles size={22} color="white" />
        </button>
      )}

      {/* ── AI Panel ─────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1000,
            width: 'min(420px, calc(100vw - 32px))',
            height: isMinimized ? 'auto' : 'min(620px, calc(100vh - 48px))',
            borderRadius: '20px',
            background: 'var(--fd-ai-bg)',
            border: '1px solid var(--fd-ai-border)',
            boxShadow: isDark
              ? '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)'
              : '0 24px 80px rgba(99,102,241,0.15), 0 0 0 1px rgba(99,102,241,0.08)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fdAiPanelOpen 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 16px',
              background: 'var(--fd-ai-header-bg)',
              borderBottom: '1px solid var(--fd-ai-border)',
              backdropFilter: 'blur(12px)',
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
              <div style={{ fontSize: '11px', color: 'var(--fd-ai-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                {isStreaming ? 'Thinking…' : `${user?.role?.replace('_', ' ')} context · Llama 3.3`}
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {hasMessages && (
                <button
                  onClick={clearConversation}
                  title="New conversation"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px', borderRadius: '8px', color: 'var(--fd-ai-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  <RotateCcw size={15} />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(v => !v)}
                title={isMinimized ? 'Expand' : 'Minimize'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '8px', color: 'var(--fd-ai-muted)',
                  transition: 'all 0.15s',
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
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '6px', borderRadius: '8px', color: 'var(--fd-ai-muted)',
                  transition: 'all 0.15s',
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages area */}
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
                    <div style={{ fontSize: '12.5px', color: 'var(--fd-ai-muted)', lineHeight: 1.5, marginBottom: 20 }}>
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
                            transition: 'all 0.15s',
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

              {/* Input area */}
              <div
                style={{
                  padding: '12px 14px',
                  borderTop: '1px solid var(--fd-ai-border)',
                  background: 'var(--fd-ai-header-bg)',
                  backdropFilter: 'blur(12px)',
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
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, color: '#ef4444', transition: 'all 0.15s',
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
