import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Send, MessageSquare, Users, UserPlus, X, ArrowLeft } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import { Avatar, Spinner } from '../../components/shared/LoadingScreen';
import { timeAgo } from '../../lib/utils';

const ROLE_LABELS = {
  admin: 'Admin', manager: 'Project Manager',
  performance_marketer: 'Perf. Marketer', social_media_manager: 'Social Manager',
  video_editor: 'Video Editor', graphic_designer: 'Graphic Designer',
  copywriter: 'Copywriter', client: 'Client',
};

// ── Conversation List ─────────────────────────────────────────────────────────
function ConversationList({ conversations, activeId, onSelect, loading }) {
  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer w-9 h-9 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="shimmer h-3 w-2/3 rounded" />
              <div className="shimmer h-2.5 w-1/2 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <div className="p-8 text-center">
        <MessageSquare size={22} color="#ccc9c2" strokeWidth={1.3} className="mx-auto mb-3" />
        <p className="text-[13px] font-medium" style={{ color: '#44423d' }}>No conversations</p>
        <p className="text-[11.5px] mt-0.5" style={{ color: '#a8a49e' }}>Conversations appear here</p>
      </div>
    );
  }

  return (
    <div>
      {conversations.map(conv => {
        const isActive = activeId === conv._id;
        return (
          <button
            key={conv._id}
            onClick={() => onSelect(conv)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b transition-all"
            style={{
              borderColor: '#f2f0ec',
              background: isActive ? '#eff0fe' : 'transparent',
            }}
            onMouseEnter={e => !isActive && (e.currentTarget.style.background = '#fafaf9')}
            onMouseLeave={e => e.currentTarget.style.background = isActive ? '#eff0fe' : 'transparent'}
          >
            <Avatar name={conv.client?.company} size="sm" />
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-medium truncate"
                style={{ color: isActive ? '#3a56d4' : '#1a1916' }}
              >
                {conv.client?.company}
              </div>
              <div className="text-[11px] truncate mt-0.5" style={{ color: '#a8a49e' }}>
                {conv.lastMessage?.content || 'No messages yet'}
              </div>
            </div>
            {conv.lastMessageAt && (
              <div className="text-[10.5px] font-mono flex-shrink-0" style={{ color: '#ccc9c2' }}>
                {timeAgo(conv.lastMessageAt)}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Participants Panel ────────────────────────────────────────────────────────
function ParticipantsPanel({ conversation, currentUser, onUpdated, onClose }) {
  const [allTeam, setAllTeam] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addId, setAddId] = useState('');
  const isManager = ['admin', 'manager'].includes(currentUser?.role);
  const participants = conversation?.participants || [];
  const clientIds = new Set(participants.filter(p => p.role === 'client').map(p => String(p._id)));
  const participantIds = new Set(participants.map(p => String(p._id)));

  useEffect(() => {
    api.get('/users?limit=100').then(r => {
      setAllTeam((r.data.users || []).filter(u => u.role !== 'client'));
    });
  }, []);

  const available = allTeam.filter(m => !participantIds.has(String(m._id)));

  const handleAdd = async () => {
    if (!addId) return;
    setSaving(true);
    try {
      const clientId = conversation?.client?._id || conversation?.client;
      const res = await api.post(`/messages/conversations/${clientId}/add-participant`, { userId: addId });
      setAddId('');
      onUpdated(res.data.conversation);
    } finally { setSaving(false); }
  };

  const handleRemove = async (userId) => {
    setSaving(true);
    try {
      const clientId = conversation?.client?._id || conversation?.client;
      const res = await api.delete(`/messages/conversations/${clientId}/remove-participant`, { data: { userId } });
      onUpdated(res.data.conversation);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#ffffff' }}>
      <div
        className="px-4 py-3.5 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: '#eeece8', background: '#fafaf9' }}
      >
        <div className="flex items-center gap-2">
          <Users size={13} color="#a8a49e" strokeWidth={1.7} />
          <span className="font-semibold text-[13px]" style={{ color: '#1a1916' }}>
            Participants
          </span>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5"><X size={13} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {participants.map(p => (
          <div
            key={p._id}
            className="flex items-center gap-2.5 px-2 py-2.5 rounded-lg group"
            onMouseEnter={e => e.currentTarget.style.background = '#fafaf9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Avatar name={p.name} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium truncate" style={{ color: '#1a1916' }}>{p.name}</div>
              <div className="text-[11px]" style={{ color: '#a8a49e' }}>{ROLE_LABELS[p.role] || p.role}</div>
            </div>
            {isManager && !clientIds.has(String(p._id)) && String(p._id) !== String(currentUser._id) && (
              <button
                onClick={() => handleRemove(p._id)}
                disabled={saving}
                className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all"
                style={{ color: '#ccc9c2' }}
                onMouseEnter={e => e.currentTarget.style.color = '#b91c1c'}
                onMouseLeave={e => e.currentTarget.style.color = '#ccc9c2'}
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isManager && (
        <div className="p-3.5 border-t space-y-2.5" style={{ borderColor: '#eeece8' }}>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: '#a8a49e' }}>
            Add member
          </p>
          <select
            value={addId}
            onChange={e => setAddId(e.target.value)}
            className="fd-input text-[12px]"
          >
            <option value="">Select team member...</option>
            {available.map(m => (
              <option key={m._id} value={m._id}>
                {m.name} · {ROLE_LABELS[m.role] || m.role}
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!addId || saving}
            className="btn-primary w-full text-[12px] py-2"
          >
            {saving ? <Spinner size="sm" /> : <UserPlus size={12} />}
            Add to conversation
          </button>
        </div>
      )}
    </div>
  );
}

// ── Chat Window ───────────────────────────────────────────────────────────────
function ChatWindow({ conversation: initial, currentUser, socket, onConversationUpdate, onBack }) {
  const [conversation, setConversation] = useState(initial);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const isManager = ['admin', 'manager'].includes(currentUser?.role);
  const bottomRef = useRef();
  const typingTimer = useRef();

  useEffect(() => {
    setConversation(initial);
    setShowPanel(false);
  }, [initial?._id]);

  useEffect(() => {
    if (!conversation) return;
    setLoading(true);
    api.get(`/messages/${conversation._id}`).then(r => {
      setMessages(r.data.messages);
      setLoading(false);
    });
    if (socket) {
      socket.emit('join:conversation', conversation._id);
      socket.on('message:new', m => setMessages(p => [...p, m]));
      socket.on('typing:start', ({ name }) => setTyping(name));
      socket.on('typing:stop', () => setTyping(null));
    }
    return () => {
      if (socket) {
        socket.emit('leave:conversation', conversation._id);
        socket.off('message:new');
        socket.off('typing:start');
        socket.off('typing:stop');
      }
    };
  }, [conversation?._id, socket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/messages/${conversation._id}`, { content: input.trim() });
      setInput('');
    } finally { setSending(false); }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing:start', { conversationId: conversation._id });
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => socket.emit('typing:stop', { conversationId: conversation._id }), 2000);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: '#fafaf9' }}>
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: '#f0eeea', border: '1px solid #e8e5e0' }}
        >
          <MessageSquare size={24} color="#ccc9c2" strokeWidth={1.3} />
        </div>
        <p className="text-[14px] font-semibold" style={{ color: '#44423d' }}>Select a conversation</p>
        <p className="text-[12.5px] mt-1" style={{ color: '#a8a49e' }}>Choose a client on the left</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat header */}
        <div
          className="px-5 py-3.5 border-b flex items-center gap-3 flex-shrink-0"
          style={{ borderColor: '#eeece8', background: '#ffffff' }}
        >
          {onBack && (
            <button onClick={onBack} className="md:hidden btn-ghost p-1.5 flex-shrink-0">
              <ArrowLeft size={15} />
            </button>
          )}
          <Avatar name={conversation.client?.company} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] font-semibold truncate" style={{ color: '#1a1916' }}>
              {conversation.client?.company}
            </div>
            <div className="text-[11px] hidden sm:block" style={{ color: '#a8a49e' }}>
              {conversation.participants?.length} participant{conversation.participants?.length !== 1 ? 's' : ''}
            </div>
          </div>
          <button
            onClick={() => setShowPanel(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all border"
            style={showPanel
              ? { background: '#eff0fe', color: '#3a56d4', borderColor: '#c5d4fb' }
              : { background: '#ffffff', color: '#7a7770', borderColor: '#e0ddd7' }
            }
          >
            <Users size={12} strokeWidth={1.7} />
            <span className="hidden sm:inline">{isManager ? 'Manage' : 'View'}</span>
          </button>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto p-5 space-y-4"
          style={{ background: '#fafaf9' }}
        >
          {loading ? (
            <div className="flex justify-center pt-10"><Spinner /></div>
          ) : messages.map((msg, i) => {
            const isMe = String(msg.sender?._id) === String(currentUser._id);
            const showAvatar = !isMe && (i === 0 || String(messages[i - 1]?.sender?._id) !== String(msg.sender?._id));
            return (
              <div key={msg._id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && (
                  <div className="w-7 flex-shrink-0 mt-auto">
                    {showAvatar && <Avatar name={msg.sender?.name} size="xs" />}
                  </div>
                )}
                <div className={`max-w-[70%] sm:max-w-[60%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showAvatar && !isMe && (
                    <div className="text-[11px] mb-1 px-1" style={{ color: '#a8a49e' }}>
                      {msg.sender?.name}
                    </div>
                  )}
                  <div
                    className="px-4 py-2.5 text-[13px] leading-relaxed"
                    style={
                      isMe
                        ? {
                            background: '#4f6ef0', color: '#ffffff',
                            borderRadius: '16px', borderBottomRightRadius: '4px',
                            boxShadow: '0 1px 4px rgba(79,110,240,0.25)',
                          }
                        : {
                            background: '#ffffff', color: '#1a1916',
                            borderRadius: '16px', borderBottomLeftRadius: '4px',
                            border: '1px solid #e8e5e0',
                            boxShadow: '0 1px 2px rgba(28,25,20,0.04)',
                          }
                    }
                  >
                    {msg.content}
                  </div>
                  <div className="text-[10.5px] mt-1 px-1 font-mono" style={{ color: '#ccc9c2' }}>
                    {timeAgo(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })}

          {typing && (
            <div className="flex gap-2.5">
              <div className="w-7" />
              <div
                className="px-4 py-2.5 rounded-2xl rounded-bl-sm border"
                style={{ background: '#ffffff', border: '1px solid #e8e5e0' }}
              >
                <div className="flex items-center gap-1">
                  {[0, 0.18, 0.36].map((d, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-[#ccc9c2] animate-bounce"
                      style={{ animationDelay: `${d}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="px-4 py-3.5 border-t flex-shrink-0"
          style={{ borderColor: '#eeece8', background: '#ffffff' }}
        >
          <div className="flex items-center gap-2.5">
            <input
              value={input}
              onChange={e => { setInput(e.target.value); handleTyping(); }}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Write a message..."
              className="fd-input flex-1"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="btn-primary flex-shrink-0 p-2.5"
            >
              {sending ? <Spinner size="sm" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* Participants panel */}
      {showPanel && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 backdrop-blur-sm"
            style={{ background: 'rgba(26,25,22,0.2)' }}
            onClick={() => setShowPanel(false)}
          />
          <div
            className="md:hidden fixed right-0 top-0 bottom-0 w-72 z-50 border-l shadow-float animate-slide-in-right"
            style={{ borderColor: '#eeece8' }}
          >
            <ParticipantsPanel
              conversation={conversation}
              currentUser={currentUser}
              onUpdated={c => { setConversation(p => ({ ...p, participants: c.participants })); onConversationUpdate?.(c); }}
              onClose={() => setShowPanel(false)}
            />
          </div>
          <div
            className="hidden md:block w-60 border-l flex-shrink-0"
            style={{ borderColor: '#eeece8' }}
          >
            <ParticipantsPanel
              conversation={conversation}
              currentUser={currentUser}
              onUpdated={c => { setConversation(p => ({ ...p, participants: c.participants })); onConversationUpdate?.(c); }}
              onClose={() => setShowPanel(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function AdminMessagesPage() {
  const { clientId } = useParams();
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState('list');

  useEffect(() => {
    api.get('/messages/conversations').then(r => {
      const convs = r.data.conversations;
      setConversations(convs);
      setLoading(false);
      if (clientId) {
        const found = convs.find(c => String(c.client?._id) === clientId);
        if (found) { setActive(found); setMobileView('chat'); }
        else {
          api.get(`/messages/conversations/${clientId}`).then(cr => {
            setActive(cr.data.conversation);
            setMobileView('chat');
          });
        }
      }
    });
  }, [clientId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', msg => {
      setConversations(prev => prev.map(c =>
        String(c._id) === String(msg.conversation)
          ? { ...c, lastMessage: msg, lastMessageAt: new Date() }
          : c
      ));
    });
    return () => socket.off('message:new');
  }, [socket]);

  return (
    <div
      className="h-[calc(100vh-7.5rem)] sm:h-[calc(100vh-8rem)] flex rounded-2xl overflow-hidden animate-fade-in"
      style={{
        background: '#ffffff',
        border: '1px solid #e8e5e0',
        boxShadow: '0 1px 2px rgba(28,25,20,0.04)',
      }}
    >
      {/* Sidebar */}
      <div
        className={`w-full md:w-[260px] border-r flex flex-col flex-shrink-0 ${mobileView === 'chat' ? 'hidden md:flex' : 'flex'}`}
        style={{ borderColor: '#eeece8' }}
      >
        <div
          className="px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: '#eeece8', background: '#fafaf9' }}
        >
          <h2 className="text-[14px] font-semibold" style={{ color: '#1a1916' }}>Messages</h2>
          <p className="text-[11.5px] mt-0.5" style={{ color: '#a8a49e' }}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations}
            activeId={active?._id}
            onSelect={c => { setActive(c); setMobileView('chat'); }}
            loading={loading}
          />
        </div>
      </div>

      {/* Chat */}
      <div className={`flex-1 flex min-h-0 overflow-hidden ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}`}>
        <ChatWindow
          conversation={active}
          currentUser={user}
          socket={socket}
          onConversationUpdate={updated => setActive(p => p ? { ...p, ...updated } : p)}
          onBack={() => setMobileView('list')}
        />
      </div>
    </div>
  );
}
