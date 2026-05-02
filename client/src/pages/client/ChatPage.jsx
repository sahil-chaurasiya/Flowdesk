import React, { useEffect, useState, useRef } from 'react';
import { Send, Paperclip, Phone, Video, MoreHorizontal } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import { Avatar, Spinner } from '../../components/shared/LoadingScreen';
import { timeAgo, formatDate } from '../../lib/utils';
import { format, isSameDay, parseISO } from 'date-fns';

function DateSeparator({ date }) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const label = isSameDay(d, new Date())
    ? 'Today'
    : isSameDay(d, new Date(Date.now() - 86400000))
    ? 'Yesterday'
    : format(d, 'MMMM d, yyyy');
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-xs text-slate-400 font-medium px-2">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

export default function ClientChatPage() {
  const { user } = useAuthStore();
  const { socket } = useSocket();

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(null);
  const [online, setOnline] = useState({});

  const bottomRef = useRef();
  const inputRef = useRef();
  const typingTimer = useRef();

  // Load conversation
  useEffect(() => {
    if (!user?.clientId) return;
    api.get(`/messages/conversations/${user.clientId}`).then(res => {
      setConversation(res.data.conversation);
      return api.get(`/messages/${res.data.conversation._id}?limit=100`);
    }).then(res => {
      setMessages(res.data.messages);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.clientId]);

  // Socket events
  useEffect(() => {
    if (!socket || !conversation) return;

    socket.emit('join:conversation', conversation._id);

    socket.on('message:new', (msg) => {
      setMessages(prev => {
        // avoid duplicates
        if (prev.find(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('typing:start', ({ name, userId }) => {
      if (userId !== user._id) setTyping(name);
    });

    socket.on('typing:stop', () => setTyping(null));

    return () => {
      socket.emit('leave:conversation', conversation._id);
      socket.off('message:new');
      socket.off('typing:start');
      socket.off('typing:stop');
    };
  }, [socket, conversation?._id]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = async () => {
    if (!input.trim() || sending || !conversation) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await api.post(`/messages/${conversation._id}`, { content: text });
    } catch {
      setInput(text); // restore on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (socket && conversation) {
      socket.emit('typing:start', { conversationId: conversation._id });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        socket.emit('typing:stop', { conversationId: conversation._id });
      }, 2000);
    }
  };

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const day = msg.createdAt?.split('T')[0] || 'unknown';
    if (!acc[day]) acc[day] = [];
    acc[day].push(msg);
    return acc;
  }, {});

  const teamParticipants = conversation?.participants?.filter(p => p.role !== 'client') || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-4 flex-shrink-0 bg-white">
        <div className="flex -space-x-2">
          {teamParticipants.slice(0, 3).map(p => (
            <Avatar key={p._id} name={p.name} size="sm" className="ring-2 ring-white" />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 text-sm">
            {teamParticipants.length > 0
              ? teamParticipants.map(p => p.name).join(', ')
              : 'Your Account Team'}
          </div>
          <div className="text-xs text-slate-400">
            {teamParticipants.map(p => p.jobTitle || p.role?.replace('_', ' ')).filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-emerald-600 font-medium">Online</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
              <Send size={24} className="text-brand-400" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Start the conversation</h3>
            <p className="text-slate-400 text-sm max-w-xs">
              Send a message to your account team. They typically respond within a few hours.
            </p>
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([day, dayMsgs]) => (
              <div key={day}>
                <DateSeparator date={day} />
                <div className="space-y-3">
                  {dayMsgs.map((msg, i) => {
                    const isMe = String(msg.sender?._id) === String(user._id);
                    const prevMsg = dayMsgs[i - 1];
                    const showAvatar = !isMe && (
                      !prevMsg ||
                      String(prevMsg.sender?._id) !== String(msg.sender?._id) ||
                      (new Date(msg.createdAt) - new Date(prevMsg.createdAt)) > 5 * 60 * 1000
                    );
                    const showTimestamp = !dayMsgs[i + 1] ||
                      String(dayMsgs[i + 1]?.sender?._id) !== String(msg.sender?._id) ||
                      (new Date(dayMsgs[i + 1]?.createdAt) - new Date(msg.createdAt)) > 5 * 60 * 1000;

                    return (
                      <div key={msg._id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar spacer for non-me messages */}
                        {!isMe && (
                          <div className="w-8 flex-shrink-0 flex items-end">
                            {showAvatar && <Avatar name={msg.sender?.name} size="sm" />}
                          </div>
                        )}

                        <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                          {showAvatar && !isMe && (
                            <span className="text-xs text-slate-500 mb-1 px-1 font-medium">{msg.sender?.name}</span>
                          )}
                          <div className={`
                            px-4 py-2.5 text-sm leading-relaxed
                            ${isMe
                              ? 'bg-brand-600 text-white rounded-2xl rounded-tr-sm'
                              : 'bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm'
                            }
                            ${msg.isDeleted ? 'italic opacity-60' : ''}
                          `}>
                            {msg.content}
                          </div>
                          {showTimestamp && (
                            <span className="text-xs text-slate-400 mt-1 px-1">
                              {format(typeof msg.createdAt === 'string' ? parseISO(msg.createdAt) : new Date(msg.createdAt), 'h:mm a')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex gap-2.5 mt-3">
                <div className="w-8 flex-shrink-0" />
                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                  <span className="text-xs text-slate-500 italic mr-1">{typing} is typing</span>
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-4 border-t border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-end gap-3 bg-slate-50 rounded-2xl border border-slate-200 px-4 py-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none max-h-32 leading-relaxed"
            style={{ minHeight: '24px' }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-9 h-9 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Send size={15} />
            }
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-center">
          Messages are monitored by your account team · Typically replies within 2–4 hours
        </p>
      </div>
    </div>
  );
}
