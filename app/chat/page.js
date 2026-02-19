'use client';

import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, query, orderBy, onSnapshot,
  doc, getDoc, serverTimestamp, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

// ─── Helpers ─────────────────────────────────────────────────────
const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

const formatTimeFull = (ts) => {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

const Avatar = ({ user, size = 10 }) => {
  const px = size * 4;
  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  if (user?.profilePic) {
    return (
      <img
        src={user.profilePic}
        alt={user.fullName}
        style={{ width: px, height: px, minWidth: px, minHeight: px }}
        className="rounded-full object-cover border-2 border-yellow-400 flex-shrink-0"
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px, minWidth: px, minHeight: px, fontSize: Math.max(10, px * 0.3) }}
      className="rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-blue-900 font-bold border-2 border-yellow-400 flex-shrink-0"
    >
      {initials}
    </div>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────
const MessageBubble = ({ msg, isMe, showAvatar, isConsecutive, friendProfile, chatId }) => {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.text);
  const [saving, setSaving] = useState(false);
  const editRef = useRef(null);

  useEffect(() => {
    if (editing) {
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [editing]);

  const handleSaveEdit = async () => {
    const trimmed = editText.trim();
    if (!trimmed) { setEditing(false); setEditText(msg.text); return; }
    if (trimmed === msg.text) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
        text: trimmed,
        edited: true,
      });
      setEditing(false);
    } catch (err) {
      console.error('Edit failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', msg.id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(); }
    if (e.key === 'Escape') { setEditing(false); setEditText(msg.text); }
  };

  return (
    <div
      className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
    >
      {/* Friend avatar */}
      {!isMe && (
        <div style={{ width: 28, height: 28, minWidth: 28 }} className="flex-shrink-0 mb-5">
          {showAvatar && <Avatar user={friendProfile} size={7} />}
        </div>
      )}

      {/* Bubble row: icons + bubble */}
      <div className={`flex items-end gap-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>

        {/* Edit/Delete icons — my messages only, hover */}
        {isMe && !editing && (
          <div className={`flex flex-col gap-0.5 mb-5 transition-all duration-150 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
            {/* Edit */}
            <button
              onClick={() => { setEditing(true); setEditText(msg.text); }}
              title="Edit"
              className="w-5 h-5 rounded-full bg-white/10 hover:bg-blue-500/50 text-blue-300 hover:text-white flex items-center justify-center transition-all"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            {/* Delete */}
            <button
              onClick={handleDelete}
              title="Delete"
              className="w-5 h-5 rounded-full bg-white/10 hover:bg-red-500/50 text-blue-300 hover:text-red-300 flex items-center justify-center transition-all"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        )}

        {/* Bubble */}
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[260px] sm:max-w-[340px]`}>
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                ref={editRef}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="px-3 py-2 rounded-2xl bg-white/20 border-2 border-yellow-400 text-white text-sm focus:outline-none w-40 sm:w-56"
              />
              {/* Save */}
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center text-blue-900 hover:bg-yellow-300 transition-all flex-shrink-0"
              >
                {saving ? (
                  <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </button>
              {/* Cancel */}
              <button
                onClick={() => { setEditing(false); setEditText(msg.text); }}
                className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-all flex-shrink-0"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
          ) : (
            <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
              isMe
                ? 'bg-yellow-400 text-blue-900 font-medium rounded-br-sm'
                : 'bg-white/15 text-white rounded-bl-sm backdrop-blur-sm'
            }`}>
              {msg.text}
              {msg.edited && <span className="text-xs opacity-40 ml-1 italic">(edited)</span>}
            </div>
          )}

          {/* Timestamp */}
          {!editing && (
            <span className={`text-xs text-blue-400 mt-0.5 px-1 flex items-center gap-0.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              {formatTimeFull(msg.createdAt)}
              {isMe && (
                <span className={msg.read ? 'text-yellow-400' : 'text-blue-500'} style={{ fontSize: 10 }}>
                  {msg.read ? '✓✓' : '✓'}
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Chat Page ───────────────────────────────────────────────
export default function ChatPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedFriendProfile, setSelectedFriendProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const unsubMessagesRef = useRef(null);
  const unsubUnreadsRef = useRef([]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Load friends
  useEffect(() => {
    if (!userProfile || !user) return;
    const friendIds = userProfile.friends || [];
    if (friendIds.length === 0) { setFriends([]); setLoadingFriends(false); return; }
    Promise.all(friendIds.map(uid => getDoc(doc(db, 'users', uid)))).then(docs => {
      setFriends(docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })));
      setLoadingFriends(false);
    });
  }, [userProfile, user]);

  // Unread counts
  useEffect(() => {
    if (!user || friends.length === 0) return;
    unsubUnreadsRef.current.forEach(u => u());
    unsubUnreadsRef.current = friends.map(friend => {
      const chatId = getChatId(user.uid, friend.uid);
      const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'desc'));
      return onSnapshot(q, snap => {
        const count = snap.docs.filter(d => d.data().senderId !== user.uid && d.data().read === false).length;
        setUnreadCounts(prev => ({ ...prev, [friend.uid]: count }));
      });
    });
    return () => unsubUnreadsRef.current.forEach(u => u());
  }, [user, friends]);

  // Messages listener — KEY FIX: use docChanges to handle deletes properly
  useEffect(() => {
    if (!selectedFriend || !user) return;
    if (unsubMessagesRef.current) unsubMessagesRef.current();
    setLoadingMessages(true);
    setMessages([]);

    const chatId = getChatId(user.uid, selectedFriend);
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));

    unsubMessagesRef.current = onSnapshot(q, async snap => {
      // Build fresh messages array from ALL current docs (handles deletes automatically)
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setLoadingMessages(false);

      // Mark unread as read
      const unread = snap.docs.filter(d => d.data().senderId !== user.uid && !d.data().read);
      if (unread.length > 0) {
        await Promise.all(unread.map(d => updateDoc(d.ref, { read: true })));
        setUnreadCounts(prev => ({ ...prev, [selectedFriend]: 0 }));
      }
    });

    return () => { if (unsubMessagesRef.current) unsubMessagesRef.current(); };
  }, [selectedFriend, user]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectFriend = async (friendId) => {
    setSelectedFriend(friendId);
    setShowSidebar(false); // hide sidebar on mobile when chat opens
    const d = await getDoc(doc(db, 'users', friendId));
    if (d.exists()) setSelectedFriendProfile({ id: d.id, ...d.data() });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const goBack = () => {
    setSelectedFriend(null);
    setSelectedFriendProfile(null);
    setMessages([]);
    setShowSidebar(true);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      const chatId = getChatId(user.uid, selectedFriend);
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text,
        senderId: user.uid,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Send failed:', err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); }
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const filteredFriends = friends.filter(f =>
    (f.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.school || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 overflow-hidden">

      {/* BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 bg-blue-900/80 backdrop-blur-lg border-b border-white/10 shadow-xl flex-shrink-0">
        <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-3">
            {/* Back to feed */}
            <Link href="/feed" className="flex items-center gap-1.5 text-blue-200 hover:text-white transition-colors text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              <span className="hidden sm:inline">Feed</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <Image src="/tsok-logo.png" alt="TSOK" width={32} height={32} />
            <div>
              <h1 className="text-white font-bold text-base leading-none">Messages</h1>
              <p className="text-yellow-400 text-xs">TSOK Community</p>
            </div>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{totalUnread}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Avatar user={userProfile} size={8} />
          </div>
        </div>
      </nav>

      {/* Body */}
      <div className="relative z-10 flex flex-1 overflow-hidden max-w-6xl w-full mx-auto w-full">

        {/* ── Sidebar ── */}
        <div className={`
          flex flex-col bg-white/5 backdrop-blur-lg border-r border-white/10 flex-shrink-0
          transition-all duration-300
          ${showSidebar ? 'w-full' : 'w-0 overflow-hidden'}
          sm:w-72 sm:overflow-visible
        `}>
          {/* Header */}
          <div className="p-3 border-b border-white/10 flex-shrink-0">
            <h2 className="text-white font-bold text-sm mb-2.5 flex items-center gap-2">
              💬 Chats
              {totalUnread > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{totalUnread}</span>
              )}
            </h2>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          {/* Friends list */}
          <div className="flex-1 overflow-y-auto">
            {loadingFriends ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-7 h-7 border-4 border-yellow-400 border-t-transparent rounded-full" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center px-4 py-10">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-blue-300 text-sm font-semibold">No friends yet</p>
                <p className="text-blue-400 text-xs mt-1">Add friends from the Feed!</p>
                <Link href="/feed" className="mt-3 inline-block px-4 py-2 bg-yellow-400 text-blue-900 text-xs font-bold rounded-xl hover:bg-yellow-300 transition-colors">
                  Go to Feed →
                </Link>
              </div>
            ) : filteredFriends.map(friend => {
              const unread = unreadCounts[friend.uid] || 0;
              const isSelected = selectedFriend === friend.uid;
              return (
                <button
                  key={friend.uid}
                  onClick={() => selectFriend(friend.uid)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 active:scale-98 ${
                    isSelected
                      ? 'bg-yellow-400/20 border-l-4 border-l-yellow-400'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar user={friend} size={10} />
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold border border-blue-900" style={{ fontSize: 9 }}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSelected ? 'text-yellow-300' : 'text-white'}`}>
                      {friend.fullName}
                    </p>
                    <p className="text-blue-400 text-xs truncate">{friend.school || friend.position || 'TSOK Member'}</p>
                  </div>
                  {unread > 0 && (
                    <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Chat Window ── */}
        <div className={`
          flex-col flex-1 overflow-hidden
          ${showSidebar ? 'hidden sm:flex' : 'flex'}
        `}>
          {!selectedFriend ? (
            // Desktop empty state
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-6xl mb-4"
              >
                💬
              </motion.div>
              <h3 className="text-white text-xl font-bold mb-2">Start a Conversation</h3>
              <p className="text-blue-300 text-sm">Select a friend from the list</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-lg border-b border-white/10 flex-shrink-0">
                {/* Back (mobile) */}
                <button
                  onClick={goBack}
                  className="sm:hidden text-blue-300 hover:text-white transition-colors p-1 -ml-1"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <Avatar user={selectedFriendProfile} size={9} />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{selectedFriendProfile?.fullName || '...'}</p>
                  <p className="text-blue-400 text-xs truncate">{selectedFriendProfile?.school || selectedFriendProfile?.position || 'TSOK Member'}</p>
                </div>
                <Link
                  href={`/profile/${selectedFriend}`}
                  className="text-blue-300 hover:text-yellow-400 text-xs px-2.5 py-1.5 bg-white/10 rounded-xl hover:bg-white/20 transition-all whitespace-nowrap"
                >
                  Profile
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="text-5xl mb-3">👋</div>
                    <p className="text-white font-semibold">Say hi to {selectedFriendProfile?.firstName || 'your friend'}!</p>
                    <p className="text-blue-300 text-sm mt-1">Start your conversation.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.senderId === user.uid;
                    const prevMsg = messages[idx - 1];
                    const showAvatar = !isMe && (!prevMsg || prevMsg.senderId !== msg.senderId);
                    const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId;
                    return (
                      <MessageBubble
                        key={msg.id}
                        msg={msg}
                        isMe={isMe}
                        showAvatar={showAvatar}
                        isConsecutive={isConsecutive}
                        friendProfile={selectedFriendProfile}
                        chatId={getChatId(user.uid, selectedFriend)}
                      />
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-3 sm:px-4 py-3 bg-white/5 backdrop-blur-lg border-t border-white/10 flex-shrink-0">
                <form onSubmit={sendMessage} className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={newMessage}
                    onChange={e => {
                      setNewMessage(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={`Message ${selectedFriendProfile?.firstName || ''}...`}
                    rows={1}
                    className="flex-1 px-4 py-2.5 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none overflow-hidden"
                    style={{ minHeight: 44, maxHeight: 100 }}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="w-11 h-11 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-blue-900 rounded-2xl flex items-center justify-center transition-all shadow-lg flex-shrink-0 active:scale-95"
                  >
                    {sending ? (
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                    )}
                  </button>
                </form>
                <p className="text-blue-500 text-xs mt-1 text-center hidden sm:block">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
