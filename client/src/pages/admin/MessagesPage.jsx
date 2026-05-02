import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, MessageSquare } from 'lucide-react';
import api from '../../lib/api';
import useAuthStore from '../../context/authStore';
import { useSocket } from '../../context/SocketContext';
import { Avatar, Spinner } from '../../components/shared/LoadingScreen';
import { timeAgo, formatDate } from '../../lib/utils';

function ConversationList({ conversations, activeId, onSelect, loading }) {
  if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;
  if (!conversations.length) return <div className="p-8 text-center text-slate-400 text-sm">No conversations yet</div>;
  return (
    <div className="divide-y divide-slate-100">
      {conversations.map(conv => (
        <button key={conv._id} onClick={() => onSelect(conv)}
          className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left ${activeId === conv._id ? 'bg-blue-50/60' : ''}`}>
          <Avatar name={conv.client?.company} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-800 text-sm truncate">{conv.client?.company}</div>
            <div className="text-xs text-slate-400 truncate mt-0.5">
              {conv.lastMessage?.content || 'No messages yet'}
            </div>
          </div>
          {conv.lastMessageAt && <div className="text-xs text-slate-400 flex-shrink-0">{timeAgo(conv.lastMessageAt)}</div>}
        </button>
      ))}
    </div>
  );
}

function ChatWindow({ conversation, currentUser, socket }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(null);
  const bottomRef = useRef();
  const typingTimeout = useRef();

  useEffect(() => {
    if (!conversation) return;
    setLoading(true);
    api.get(`/messages/${conversation._id}`).then(r => {
      setMessages(r.data.messages);
      setLoading(false);
    });

    if (socket) {
      socket.emit('join:conversation', conversation._id);
      socket.on('message:new', (msg) => {
        setMessages(prev => [...prev, msg]);
      });
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
      clearTimeout(typingTimeout.current);
      typingTimeout.current = setTimeout(() => socket.emit('typing:stop', { conversationId: conversation._id }), 2000);
    }
  };

  if (!conversation) return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
      <MessageSquare size={40} className="mb-3 opacity-40" />
      <p className="text-sm">Select a conversation to start messaging</p>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
        <Avatar name={conversation.client?.company} size="sm" />
        <div>
          <div className="font-semibold text-slate-800 text-sm">{conversation.client?.company}</div>
          <div className="text-xs text-slate-400">{conversation.participants?.length} participants</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading ? <div className="flex justify-center pt-8"><Spinner /></div> : (
          messages.map((msg, i) => {
            const isMe = String(msg.sender?._id) === String(currentUser._id);
            const showAvatar = !isMe && (i === 0 || String(messages[i-1]?.sender?._id) !== String(msg.sender?._id));
            return (
              <div key={msg._id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                {!isMe && <div className="w-8 flex-shrink-0">{showAvatar && <Avatar name={msg.sender?.name} size="sm" />}</div>}
                <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                  {showAvatar && !isMe && <div className="text-xs text-slate-500 mb-1 px-1">{msg.sender?.name}</div>}
                  <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-brand-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'} ${msg.isDeleted ? 'italic opacity-60' : ''}`}>
                    {msg.content}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 px-1">{timeAgo(msg.createdAt)}</div>
                </div>
              </div>
            );
          })
        )}
        {typing && <div className="text-xs text-slate-400 italic">{typing} is typing...</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-slate-200 flex-shrink-0">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => { setInput(e.target.value); handleTyping(); }}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Type a message..."
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <button onClick={handleSend} disabled={!input.trim() || sending}
            className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl w-10 h-10 flex items-center justify-center transition-colors flex-shrink-0">
            {sending ? <Spinner size="sm" className="border-white/30 border-t-white" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMessagesPage() {
  const { clientId } = useParams();
  const { user } = useAuthStore();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/messages/conversations').then(r => {
      setConversations(r.data.conversations);
      setLoading(false);

      // Auto-select if clientId in URL
      if (clientId) {
        const found = r.data.conversations.find(c => String(c.client?._id) === clientId);
        if (found) setActive(found);
        else {
          api.get(`/messages/conversations/${clientId}`).then(cr => setActive(cr.data.conversation));
        }
      }
    });
  }, [clientId]);

  // Listen for new messages across all conversations
  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', (msg) => {
      setConversations(prev => prev.map(c =>
        String(c._id) === String(msg.conversation)
          ? { ...c, lastMessage: msg, lastMessageAt: new Date() }
          : c
      ));
    });
    return () => socket.off('message:new');
  }, [socket]);

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
      {/* Sidebar */}
      <div className="w-72 border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Messages</h2>
          <p className="text-xs text-slate-400 mt-0.5">{conversations.length} conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConversationList conversations={conversations} activeId={active?._id} onSelect={setActive} loading={loading} />
        </div>
      </div>

      {/* Chat */}
      <ChatWindow conversation={active} currentUser={user} socket={socket} />
    </div>
  );
}
