/**
 * useAI — FlowDesk AI Assistant Hook
 *
 * Manages conversation history, streaming SSE responses,
 * and rate limit state. Works for all roles.
 */

import { useState, useCallback, useRef } from 'react';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export function useAI() {
  const [messages, setMessages]     = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError]           = useState(null);
  const [rateLimit, setRateLimit]   = useState(null);
  const abortRef = useRef(null);

  const sendMessage = useCallback(async (userContent) => {
    if (!userContent.trim() || isStreaming) return;

    setError(null);

    const userMessage = { role: 'user', content: userContent.trim(), id: Date.now() };
    const assistantMessage = { role: 'assistant', content: '', id: Date.now() + 1, streaming: true };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);

    // Build the history to send (exclude the empty assistant message we just added)
    const history = [...messages, userMessage].map(({ role, content }) => ({ role, content }));

    try {
      const token = localStorage.getItem('accessToken');

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`${BASE_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setError({ type: 'rate_limit', message: errorData.message, retryAfter: errorData.retryAfter });
        } else {
          setError({ type: 'api_error', message: errorData.message || 'Something went wrong' });
        }
        // Remove the empty assistant message
        setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          try {
            const chunk = JSON.parse(jsonStr);

            if (chunk.error) {
              setError({ type: 'stream_error', message: chunk.error });
              break;
            }

            if (chunk.delta) {
              accumulated += chunk.delta;
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, content: accumulated }
                  : m
              ));
            }

            if (chunk.done) {
              setMessages(prev => prev.map(m =>
                m.id === assistantMessage.id
                  ? { ...m, streaming: false }
                  : m
              ));
            }

            if (chunk.rateLimit) {
              setRateLimit(chunk.rateLimit);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

    } catch (err) {
      if (err.name === 'AbortError') return;
      setError({ type: 'network_error', message: 'Connection lost. Please try again.' });
      setMessages(prev => prev.filter(m => m.id !== assistantMessage.id));
    } finally {
      setIsStreaming(false);
      setMessages(prev => prev.map(m =>
        m.streaming ? { ...m, streaming: false } : m
      ));
    }
  }, [messages, isStreaming]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

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
