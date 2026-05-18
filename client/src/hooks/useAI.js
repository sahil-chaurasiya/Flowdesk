/**
 * useAI — FlowDesk AI Assistant Hook
 *
 * FIXES in this version:
 *  - Stall timer now only resets on actual content chunks, NOT on every raw read
 *    (previously empty SSE keep-alives were resetting the timer, masking real stalls)
 *  - AbortError handling: always cleans up streaming state whether partial or full abort
 *  - chunk.error breaks cleanly without one extra reader.read() iteration
 *  - `error` state reference in finally replaced with a local flag to avoid stale closure
 *  - connectTimer cleared immediately after first byte, not only in catch
 */

import { useState, useCallback, useRef } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const CONNECT_TIMEOUT_MS = 30_000;  // 30s to get first byte from server
const STALL_TIMEOUT_MS   = 20_000;  // 20s between actual content chunks (not keep-alives)

export function useAI() {
  const [messages, setMessages]      = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError]            = useState(null);
  const [rateLimit, setRateLimit]    = useState(null);

  const abortRef      = useRef(null);
  const stallTimerRef = useRef(null);

  // ── helpers ──────────────────────────────────────────────────────────────

  const cleanup = useCallback((assistantMsgId) => {
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
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    }
  }, []);

  /**
   * Reset stall timer ONLY when we receive actual content (delta or done).
   * Keep-alive pings (': ping\n\n') are ignored — they don't count as progress.
   */
  const resetStallTimer = useCallback((controller) => {
    if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    stallTimerRef.current = setTimeout(() => {
      console.warn('[useAI] Stall timeout — aborting stream');
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

    // Overall connect timeout — cleared as soon as we get the response headers
    const connectTimer = setTimeout(() => {
      console.warn('[useAI] Connect timeout — aborting');
      controller.abort();
    }, CONNECT_TIMEOUT_MS);

    let accumulated  = '';
    let hadError     = false; // local flag, avoids stale closure on `error` state

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

      // Got headers — kill connect timer, start stall watchdog
      clearTimeout(connectTimer);
      resetStallTimer(controller);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError({ type: 'rate_limit', message: errorData.message || 'Too many requests. Please wait a moment.', retryAfter: errorData.retryAfter });
        } else if (res.status === 401) {
          setError({ type: 'api_error', message: 'Session expired. Please refresh the page.' });
        } else {
          setError({ type: 'api_error', message: errorData.message || `Server error (${res.status}). Please try again.` });
        }
        hadError = true;
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer     = '';
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();

          // Skip empty lines and SSE keep-alive comments (': ping')
          // Do NOT reset stall timer on these — they're not real progress
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (!trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]' || jsonStr === 'ping') continue;

          let chunk;
          try {
            chunk = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (chunk.error) {
            setError({ type: 'stream_error', message: chunk.error });
            hadError = true;
            streamDone = true;
            break; // exits for-loop; while checks streamDone next iteration
          }

          if (chunk.delta) {
            accumulated += chunk.delta;
            // Reset stall timer only on real content
            resetStallTimer(controller);
            setMessages(prev => prev.map(m =>
              m.id === assistantMessage.id ? { ...m, content: accumulated } : m
            ));
          }

          if (chunk.rateLimit) {
            setRateLimit(chunk.rateLimit);
          }

          if (chunk.done) {
            // Reset stall timer — this is the final real event
            resetStallTimer(controller);
            streamDone = true;
            break;
          }
        }
      }

      // Flush any remaining partial buffer (edge case)
      if (buffer.trim() && buffer.trim().startsWith('data: ')) {
        try {
          const chunk = JSON.parse(buffer.trim().slice(6));
          if (chunk.delta) {
            accumulated += chunk.delta;
            setMessages(prev => prev.map(m =>
              m.id === assistantMessage.id ? { ...m, content: accumulated } : m
            ));
          }
        } catch { /* ignore */ }
      }

      // Empty response — show fallback instead of blank bubble
      if (!accumulated && !hadError) {
        setMessages(prev => prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, content: 'No response received. Please try again.' }
            : m
        ));
      }

    } catch (err) {
      clearTimeout(connectTimer);

      if (err.name === 'AbortError') {
        if (!accumulated) {
          // Timed out before any content — remove the empty bubble and show error
          setError({ type: 'timeout', message: 'Request timed out. The server took too long to respond.' });
          setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
          hadError = true;
        }
        // If partial content exists, keep it — just stop streaming (cleanup handles it)
      } else {
        setError({ type: 'network_error', message: 'Connection lost. Please check your connection and try again.' });
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
        hadError = true;
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