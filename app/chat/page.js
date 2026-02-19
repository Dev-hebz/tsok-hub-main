'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, addDoc, query, orderBy, onSnapshot,
  doc, getDoc, getDocs, serverTimestamp, where,
  updateDoc, arrayUnion
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

// ─── Helpers ────────────────────────────────────────────────────
const formatTime = (ts) => {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

const formatTimeFull = (ts) => {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
};

// Generate consistent chat room ID from two UIDs
const getChatId = (uid1, uid2) => [uid1, uid2].sort().join('_');

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
      style={{ width: px, height: px, minWidth: px, minHeight: px, fontSize: px * 0.3 }}
      className="rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-blue-900 font-bold border-2 border-yellow-400 flex-shrink-0"
    >
      {initials}
    </div>
  );
};

// ─── Main Chat Page ──────────────────────────────────────────────
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

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const unsubMessagesRef = useRef(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Load friends list
  useEffect(() => {
    if (!userProfile || !user) return;
    const friendIds = userProfile.friends || [];
    if (friendIds.length === 0) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }
    Promise.all(friendIds.map(uid => getDoc(doc(db, 'users', uid))))
      .then(docs => {
        const list = docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() }));
        setFriends(list);
        setLoadingFriends(false);
      });
  }, [userProfile, user]);

  // Track unread counts for each friend
  useEffect(() => {
    if (!user || friends.length === 0) return;
    const unsubs = friends.map(friend => {
      const chatId = getChatId(user.uid, friend.uid);
      const q = query(
        collection(db, 'chats', chatId, 'messages'),
        where('senderId', '!=', user.uid),
        where('read', '==', false)
      );
      return onSnapshot(q, snap => {
        setUnreadCounts(prev => ({ ...prev, [friend.uid]: snap.size }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [user, friends]);

  // Load messages for selected friend
  useEffect(() => {
    if (!selectedFriend || !user) return;

    // Cleanup previous listener
    if (unsubMessagesRef.current) unsubMessagesRef.current();

    setLoadingMessages(true);
    setMessages([]);

    const chatId = getChatId(user.uid, selectedFriend);
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    unsubMessagesRef.current = onSnapshot(q, async snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      setLoadingMessages(false);

      // Mark all received messages as read
      const unread = snap.docs.filter(d => d.data().senderId !== user.uid && !d.data().read);
      await Promise.all(unread.map(d => updateDoc(d.ref, { read: true })));
      setUnreadCounts(prev => ({ ...prev, [selectedFriend]: 0 }));
    });

    return () => {
      if (unsubMessagesRef.current) unsubMessagesRef.current();
    };
  }, [selectedFriend, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectFriend = async (friendId) => {
    setSelectedFriend(friendId);
    const d = await getDoc(doc(db, 'users', friendId));
    if (d.exists()) setSelectedFriendProfile({ id: d.id, ...d.data() });
    inputRef.current?.focus();
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
      console.error('Error sending message:', err);
      setNewMessage(text); // restore on error
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e);
    }
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const filteredFriends = friends.filter(f =>
    f.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.school?.toLowerCase().includes(searchQuery.toLowerCase())
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

      {/* Animated BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 bg-blue-900/80 backdrop-blur-lg border-b border-white/10 shadow-xl flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/feed" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
              </svg>
              <span className="hidden sm:inline">Back to Feed</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Image src="/tsok-logo.png" alt="TSOK" width={36} height={36} />
            <div>
              <h1 className="text-white font-bold text-lg leading-none">Messages</h1>
              <p className="text-yellow-400 text-xs">TSOK Community</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Avatar user={userProfile} size={9} />
            <span className="hidden sm:block text-white text-sm font-semibold">
              {userProfile?.firstName}
            </span>
          </div>
        </div>
      </nav>

      {/* Chat Layout */}
      <div className="relative z-10 flex flex-1 overflow-hidden max-w-6xl w-full mx-auto">

        {/* ── Friends Sidebar ── */}
        <div className={`flex flex-col bg-white/5 backdrop-blur-lg border-r border-white/10 flex-shrink-0 transition-all ${selectedFriend ? 'w-0 sm:w-72 overflow-hidden' : 'w-full sm:w-72'}`}>

          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/10 flex-shrink-0">
            <h2 className="text-white font-bold text-base mb-3">
              💬 Chats
              {totalUnread > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">{totalUnread}</span>
              )}
            </h2>
            <input
              type="text"
              placeholder="Search friends..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
            />
          </div>

          {/* Friends List */}
          <div className="flex-1 overflow-y-auto">
            {loadingFriends ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin w-8 h-8 border-3 border-yellow-400 border-t-transparent rounded-full" />
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="text-4xl mb-3">👥</div>
                <p className="text-blue-300 text-sm font-semibold">No friends yet</p>
                <p className="text-blue-400 text-xs mt-1">Add friends from the Feed to start chatting!</p>
                <Link href="/feed" className="mt-4 inline-block px-4 py-2 bg-yellow-400 text-blue-900 text-xs font-bold rounded-xl hover:bg-yellow-300 transition-colors">
                  Go to Feed →
                </Link>
              </div>
            ) : (
              filteredFriends.map(friend => {
                const unread = unreadCounts[friend.uid] || 0;
                const isSelected = selectedFriend === friend.uid;
                return (
                  <motion.button
                    key={friend.uid}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectFriend(friend.uid)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all border-b border-white/5 ${
                      isSelected
                        ? 'bg-yellow-400/20 border-l-4 border-l-yellow-400'
                        : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="relative">
                      <Avatar user={friend} size={11} />
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold border-2 border-blue-900">
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
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat Window ── */}
        <div className={`flex flex-col flex-1 overflow-hidden ${!selectedFriend ? 'hidden sm:flex' : 'flex'}`}>

          {!selectedFriend ? (
            // Empty state
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="text-7xl mb-6"
              >
                💬
              </motion.div>
              <h3 className="text-white text-2xl font-bold mb-2">Start a Conversation</h3>
              <p className="text-blue-300 text-sm">Select a friend from the list to start chatting in real-time!</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white/5 backdrop-blur-lg border-b border-white/10 flex-shrink-0">
                {/* Back button on mobile */}
                <button
                  onClick={() => { setSelectedFriend(null); setSelectedFriendProfile(null); setMessages([]); }}
                  className="sm:hidden text-blue-300 hover:text-white transition-colors mr-1"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>

                <Avatar user={selectedFriendProfile} size={10} />
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">{selectedFriendProfile?.fullName || '...'}</p>
                  <p className="text-blue-400 text-xs">{selectedFriendProfile?.school || selectedFriendProfile?.position || 'TSOK Member'}</p>
                </div>
                <Link
                  href={`/profile/${selectedFriend}`}
                  className="text-blue-300 hover:text-yellow-400 transition-colors text-xs px-3 py-1.5 bg-white/10 rounded-xl hover:bg-white/20"
                >
                  View Profile
                </Link>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {loadingMessages ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-10">
                    <div className="text-5xl mb-4">👋</div>
                    <p className="text-white font-semibold">Say hi to {selectedFriendProfile?.firstName || 'your friend'}!</p>
                    <p className="text-blue-300 text-sm mt-1">This is the start of your conversation.</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => {
                      const isMe = msg.senderId === user.uid;
                      const prevMsg = messages[idx - 1];
                      const showAvatar = !isMe && (!prevMsg || prevMsg.senderId !== msg.senderId);
                      const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId;

                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}
                        >
                          {/* Avatar placeholder for alignment */}
                          {!isMe && (
                            <div style={{ width: 32, height: 32, minWidth: 32 }} className="flex-shrink-0">
                              {showAvatar && <Avatar user={selectedFriendProfile} size={8} />}
                            </div>
                          )}

                          {/* Bubble */}
                          <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div
                              className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                                isMe
                                  ? 'bg-yellow-400 text-blue-900 font-medium rounded-br-sm'
                                  : 'bg-white/15 text-white rounded-bl-sm backdrop-blur-sm'
                              }`}
                            >
                              {msg.text}
                            </div>
                            <span className={`text-xs text-blue-400 mt-1 px-1 flex items-center gap-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                              {formatTimeFull(msg.createdAt)}
                              {isMe && (
                                <span className={msg.read ? 'text-yellow-400' : 'text-blue-500'}>
                                  {msg.read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message Input */}
              <div className="px-4 py-3 bg-white/5 backdrop-blur-lg border-t border-white/10 flex-shrink-0">
                <form onSubmit={sendMessage} className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={e => {
                        setNewMessage(e.target.value);
                        // Auto resize
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${selectedFriendProfile?.firstName || ''}...`}
                      rows={1}
                      className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all resize-none overflow-hidden"
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    disabled={!newMessage.trim() || sending}
                    className="flex-shrink-0 w-12 h-12 bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 disabled:cursor-not-allowed text-blue-900 rounded-2xl flex items-center justify-center transition-all shadow-lg"
                  >
                    {sending ? (
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                      </svg>
                    )}
                  </motion.button>
                </form>
                <p className="text-blue-500 text-xs mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
