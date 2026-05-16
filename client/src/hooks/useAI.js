/**
 * useAI — FlowDesk AI Assistant Hook
 *
 * Manages conversation history, streaming SSE responses,
 * and rate limit state. Works for all roles.
 *
 * Fixes:
 *  - 30s total request timeout (aborts if server never responds)
 *  - 15s stall timeout (aborts if chunks stop mid-stream)
 *  - chunk.error properly breaks the outer read loop
 *  - chunk.done properly resolves isStreaming AND message.streaming
 *  - cleanup always runs in finally, no stuck states
 */

import { useState, useCallback, useRef } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const CONNECT_TIMEOUT_MS = 30_000;  // 30s to get first byte
const STALL_TIMEOUT_MS   = 15_000;  // 15s between chunks

export function useAI() {
  const [messages, setMessages]      = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError]            = useState(null);
  const [rateLimit, setRateLimit]    = useState(null);

  const abortRef     = useRef(null);
  const stallTimerRef = useRef(null);

  // ── helpers ──────────────────────────────────────────────────────────────

  const cleanup = useCallback((assistantMsgId) => {
    // Clear any pending stall timer
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
    setIsStreaming(false);
    if (assistantMsgId != null) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, streaming: false } : m
      ));
    } else {
      // Fallback: clear any lingering streaming flags
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    }
  }, []);

  const resetStallTimer = useCallback((controller) => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      controller.abort();
    }, STALL_TIMEOUT_MS);
  }, []);

  // ── sendMessage ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (userContent) => {
    if (!userContent.trim() || isStreaming) return;

    setError(null);

    const userMessage      = { role: 'user',      content: userContent.trim(), id: Date.now() };
    const assistantMessage = { role: 'assistant', content: '',                 id: Date.now() + 1, streaming: true };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    const history = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

    const controller = new AbortController();
    abortRef.current = controller;

    // Overall connection timeout
    const connectTimer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

    try {
      const token = localStorage.getItem('accessToken');

      const res = await fetch(`${BASE_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      clearTimeout(connectTimer);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError({ type: 'rate_limit', message: errorData.message || 'Too many requests. Please wait a moment.', retryAfter: errorData.retryAfter });
        } else if (res.status === 401) {
          setError({ type: 'api_error', message: 'Session expired. Please refresh the page.' });
        } else {
          setError({ type: 'api_error', message: errorData.message || `Server error (${res.status}). Please try again.` });
        }
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
        cleanup(null);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer      = '';
      let streamDone  = false;

      // Start stall watchdog — reset on every chunk received
      resetStallTimer(controller);

      while (!streamDone) {
        const { done, value } = await reader.read();

        if (done) break;

        // Got data — reset stall watchdog
        resetStallTimer(controller);

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);

          // SSE keep-alive ping
          if (jsonStr === '[DONE]' || jsonStr === 'ping') continue;

          let chunk;
          try {
            chunk = JSON.parse(jsonStr);
          } catch {
            continue; // skip malformed
          }

          if (chunk.error) {
            setError({ type: 'stream_error', message: chunk.error });
            streamDone = true;
            break;
          }

          if (chunk.delta) {
            accumulated += chunk.delta;
            setMessages(prev => prev.map(m =>
              m.id === assistantMessage.id ? { ...m, content: accumulated } : m
            ));
          }

          if (chunk.rateLimit) {
            setRateLimit(chunk.rateLimit);
          }

          if (chunk.done) {
            streamDone = true;
            break;
          }
        }
      }

      // Flush any remaining buffer content
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(trimmed.slice(6));
            if (chunk.delta) {
              accumulated += chunk.delta;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id ? { ...m, content: accumulated } : m
              ));
            }
          } catch { /* ignore */ }
        }
      }

      // If we got content but no explicit chunk.done, that's fine — just finish
      if (!accumulated && !error) {
        // Empty response from server
        setMessages(prev => prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, content: 'No response received. Please try again.' }
            : m
        ));
      }

    } catch (err) {
      clearTimeout(connectTimer);

      if (err.name === 'AbortError') {
        // Could be user-initiated stop OR our timeout
        const wasTimeout = !accumulated;
        if (wasTimeout) {
          setError({ type: 'timeout', message: 'Request timed out. The server took too long to respond.' });
          setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
        }
        // If there was partial content, keep it — don't remove the message
      } else {
        setError({ type: 'network_error', message: 'Connection lost. Please check your connection and try again.' });
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
      }
    } finally {
      clearTimeout(connectTimer);
      cleanup(assistantMessage.id);
    }
  }, [messages, isStreaming, cleanup, resetStallTimer]);

  // ── stopStreaming ────────────────────────────────────────────────────────

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    cleanup(null);
  }, [cleanup]);

  // ── clearConversation ────────────────────────────────────────────────────

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    cleanup(null);
    setMessages([]);
    setError(null);
  }, [cleanup]);

  // ── dismissError ─────────────────────────────────────────────────────────

  const dismissError = useCallback(() => setError(null), []);

  return {
    messages,
    isStreaming,
    error,
    rateLimit,
    sendMessage,
    stopStreaming,
    clearConversation,
    dismissError,
  };
}