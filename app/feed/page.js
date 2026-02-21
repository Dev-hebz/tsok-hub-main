'use client';

import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, query, orderBy, onSnapshot,
  doc, updateDoc, arrayUnion, arrayRemove, deleteDoc,
  getDoc, getDocs, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Toast, ConfirmModal, AlertModal } from '../../components/Modals';

// ─── Helpers ───────────────────────────────────────────────────────────────
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

const Avatar = ({ user, size = 10, className = '' }) => {
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
        className={`rounded-full object-cover border-2 border-yellow-400 flex-shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: px, height: px, minWidth: px, minHeight: px, fontSize: px * 0.3 }}
      className={`rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-blue-900 font-bold text-sm border-2 border-yellow-400 flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  );
};

// ─── Comment Component ──────────────────────────────────────────────────────
const CommentItem = ({ comment, postId, currentUser, currentProfile }) => {
  const [authorProfile, setAuthorProfile] = useState(null);

  useEffect(() => {
    if (comment.authorId) {
      getDoc(doc(db, 'users', comment.authorId)).then(d => {
        if (d.exists()) setAuthorProfile(d.data());
      });
    }
  }, [comment.authorId]);

  const handleDeleteComment = async () => {
    if (currentUser?.uid !== comment.authorId) return;
    await deleteDoc(doc(db, 'posts', postId, 'comments', comment.id));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-2 mt-2"
    >
      <Avatar user={authorProfile} size={8} />
      <div className="flex-1">
        <div className="bg-white/10 rounded-2xl px-3 py-2">
          <p className="text-white text-xs font-semibold">{authorProfile?.fullName || 'Member'}</p>
          <p className="text-blue-100 text-sm">{comment.text}</p>
        </div>
        <div className="flex items-center gap-3 mt-1 px-2">
          <span className="text-blue-300 text-xs">{formatTime(comment.createdAt)}</span>
          {currentUser?.uid === comment.authorId && (
            <button onClick={handleDeleteComment} className="text-red-400 text-xs hover:text-red-300 transition-colors">
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Post Component ─────────────────────────────────────────────────────────
// ─── Image Lightbox Viewer ──────────────────────────────────────────────────
const ImageViewer = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const zoom = (factor) => {
    setScale(s => Math.min(Math.max(s * factor, 0.5), 5));
  };

  const resetZoom = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  // Mouse drag
  const onMouseDown = (e) => {
    if (scale <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - lastPos.x, y: e.clientY - lastPos.y });
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    const newPos = { x: e.clientX - dragStart.x, y: e.clientY - dragStart.y };
    setPos(newPos);
    setLastPos(newPos);
  };
  const onMouseUp = () => setDragging(false);

  // Touch pinch-to-zoom
  const lastDist = useRef(null);
  const onTouchMove = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastDist.current) {
        const factor = dist / lastDist.current;
        setScale(s => Math.min(Math.max(s * factor, 0.5), 5));
      }
      lastDist.current = dist;
    }
  };
  const onTouchEnd = () => { lastDist.current = null; };

  // Scroll to zoom
  const onWheel = (e) => {
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1.1 : 0.9);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          {/* Zoom controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => zoom(0.8)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all text-lg font-bold"
            >−</button>
            <button
              onClick={resetZoom}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all min-w-[52px] text-center"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={() => zoom(1.2)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all text-lg font-bold"
            >+</button>
          </div>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-red-500/60 text-white flex items-center justify-center transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Image area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex items-center justify-center"
          style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={src}
            alt="Full view"
            draggable={false}
            style={{
              transform: `scale(${scale}) translate(${pos.x / scale}px, ${pos.y / scale}px)`,
              transition: dragging ? 'none' : 'transform 0.15s ease',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              userSelect: 'none',
            }}
          />
        </div>

        {/* Bottom hint */}
        <div className="text-center py-2 text-white/30 text-xs flex-shrink-0 hidden sm:block">
          Scroll to zoom · Drag to pan · Esc to close
        </div>
        <div className="text-center py-2 text-white/30 text-xs flex-shrink-0 sm:hidden">
          Pinch to zoom · Tap outside to close
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

const PostCard = ({ post, currentUser, currentProfile }) => {
  const [authorProfile, setAuthorProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  useEffect(() => {
    if (post.authorId) {
      getDoc(doc(db, 'users', post.authorId)).then(d => {
        if (d.exists()) setAuthorProfile(d.data());
      });
    }
    setLiked(post.likes?.includes(currentUser?.uid));
    setLikeCount(post.likes?.length || 0);
  }, [post, currentUser]);

  // Real-time comments
  useEffect(() => {
    if (!showComments) return;
    const q = query(
      collection(db, 'posts', post.id, 'comments'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [post.id, showComments]);

  const handleLike = async () => {
    if (!currentUser) return;
    const postRef = doc(db, 'posts', post.id);
    if (liked) {
      await updateDoc(postRef, { likes: arrayRemove(currentUser.uid) });
      setLiked(false);
      setLikeCount(c => c - 1);
    } else {
      await updateDoc(postRef, { likes: arrayUnion(currentUser.uid) });
      setLiked(true);
      setLikeCount(c => c + 1);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !currentUser) return;
    await addDoc(collection(db, 'posts', post.id, 'comments'), {
      text: newComment.trim(),
      authorId: currentUser.uid,
      createdAt: serverTimestamp(),
    });
    setNewComment('');
  };

  const handleDeletePost = async () => {
    setConfirmDelete(true);
  };

  const confirmDeletePost = async () => {
    setConfirmDelete(false);
    await deleteDoc(doc(db, 'posts', post.id));
  };

  const canDelete = currentUser?.uid === post.authorId || currentProfile?.isAdmin;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl overflow-hidden shadow-xl"
    >
      {/* Post Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.authorId}`}>
            <Avatar user={authorProfile} size={10} />
          </Link>
          <div>
            <Link href={`/profile/${post.authorId}`} className="text-white font-semibold hover:text-yellow-300 transition-colors">
              {authorProfile?.fullName || 'TSOK Member'}
            </Link>
            <p className="text-blue-300 text-xs">{authorProfile?.school || authorProfile?.position || ''}</p>
            <p className="text-blue-400 text-xs">{formatTime(post.createdAt)}</p>
          </div>
        </div>
        {canDelete && (
          <button
            onClick={handleDeletePost}
            className="text-red-400 hover:text-red-300 p-2 hover:bg-white/10 rounded-full transition-all"
            title="Delete post"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Post Content */}
      {post.text && (
        <div className="px-4 pb-3">
          <p className="text-white text-base leading-relaxed whitespace-pre-wrap">{post.text}</p>
        </div>
      )}

      {/* Post Image — click to zoom */}
      {post.imageUrl && (
        <>
          <div
            className="w-full bg-black/20 cursor-zoom-in relative group"
            onClick={() => setViewerOpen(true)}
          >
            <img
              src={post.imageUrl}
              alt="Post"
              className="w-full h-auto object-contain"
              style={{ maxHeight: '70vh' }}
            />
            {/* Zoom hint overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/10">
              <div className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                </svg>
                Tap to zoom
              </div>
            </div>
          </div>
          {viewerOpen && (
            <ImageViewer src={post.imageUrl} onClose={() => setViewerOpen(false)} />
          )}
        </>
      )}

      {/* Stats Row */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-white/10">
        <span className="text-blue-300 text-sm flex items-center gap-1">
          {likeCount > 0 && (
            <>
              <span>👍</span>
              <span>{likeCount}</span>
            </>
          )}
        </span>
        <button
          onClick={() => setShowComments(!showComments)}
          className="text-blue-300 text-sm hover:text-white transition-colors"
        >
          {comments.length || post.commentCount || 0} Comments
        </button>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2 flex items-center gap-1 border-t border-white/10">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleLike}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-semibold text-sm transition-all ${
            liked
              ? 'bg-blue-500/30 text-blue-200'
              : 'hover:bg-white/10 text-blue-300 hover:text-white'
          }`}
        >
          <span>{liked ? '👍' : '👍'}</span>
          <span>{liked ? 'Liked' : 'Like'}</span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl font-semibold text-sm hover:bg-white/10 text-blue-300 hover:text-white transition-all"
        >
          <span>💬</span>
          <span>Comment</span>
        </motion.button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 pb-4 border-t border-white/10 overflow-hidden"
          >
            <div className="pt-3 space-y-1 max-h-64 overflow-y-auto">
              {comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  postId={post.id}
                  currentUser={currentUser}
                  currentProfile={currentProfile}
                />
              ))}
              {comments.length === 0 && (
                <p className="text-blue-300 text-sm text-center py-2">No comments yet. Be the first!</p>
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleComment} className="flex gap-2 mt-3">
              <Avatar user={currentProfile} size={8} />
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm transition-all"
              />
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="submit"
                className="px-4 py-2 bg-yellow-400 text-blue-900 rounded-full font-semibold text-sm hover:bg-yellow-300 transition-colors"
              >
                Post
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        visible={confirmDelete}
        title="Delete Post"
        message="Are you sure you want to delete this post? This cannot be undone."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDeletePost}
        onCancel={() => setConfirmDelete(false)}
      />
    </motion.div>
  );
};

// ─── Friend Suggestion Card ─────────────────────────────────────────────────
const FriendCard = ({ member, currentUser, currentProfile, onUpdate }) => {
  const isFriend = currentProfile?.friends?.includes(member.uid);
  const requestSent = currentProfile?.sentRequests?.includes(member.uid);
  const hasRequest = currentProfile?.friendRequests?.includes(member.uid);

  const handleAddFriend = async () => {
    if (!currentUser) return;
    const myRef = doc(db, 'users', currentUser.uid);
    const theirRef = doc(db, 'users', member.uid);
    await updateDoc(myRef, { sentRequests: arrayUnion(member.uid) });
    await updateDoc(theirRef, { friendRequests: arrayUnion(currentUser.uid) });
    onUpdate();
  };

  const handleAccept = async () => {
    const myRef = doc(db, 'users', currentUser.uid);
    const theirRef = doc(db, 'users', member.uid);
    await updateDoc(myRef, {
      friends: arrayUnion(member.uid),
      friendRequests: arrayRemove(member.uid),
    });
    await updateDoc(theirRef, {
      friends: arrayUnion(currentUser.uid),
      sentRequests: arrayRemove(currentUser.uid),
    });
    onUpdate();
  };

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all">
      <Link href={`/profile/${member.uid}`}>
        <Avatar user={member} size={10} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/profile/${member.uid}`} className="text-white text-sm font-semibold hover:text-yellow-300 transition-colors truncate block">
          {member.fullName}
        </Link>
        <p className="text-blue-300 text-xs truncate">{member.school || member.position || 'TSOK Member'}</p>
      </div>
      {!isFriend && !requestSent && !hasRequest && (
        <button
          onClick={handleAddFriend}
          className="px-3 py-1 bg-yellow-400 text-blue-900 text-xs font-semibold rounded-full hover:bg-yellow-300 transition-colors whitespace-nowrap"
        >
          + Add
        </button>
      )}
      {requestSent && (
        <span className="text-blue-300 text-xs">Sent</span>
      )}
      {hasRequest && (
        <button
          onClick={handleAccept}
          className="px-3 py-1 bg-green-400 text-blue-900 text-xs font-semibold rounded-full hover:bg-green-300 transition-colors whitespace-nowrap"
        >
          Accept
        </button>
      )}
      {isFriend && (
        <span className="text-green-400 text-xs">✓ Friends</span>
      )}
    </div>
  );
};

// ─── Main Feed Page ──────────────────────────────────────────────────────────
export default function FeedPage() {
  const { user, userProfile, loading, logout, refreshProfile } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [posting, setPosting] = useState(false);
  const [members, setMembers] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('feed');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '', type: 'info' });
  const fileRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const showAlert = (title, message, type = 'warning') => {
    setAlertModal({ visible: true, title, message, type });
  };

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Real-time posts
  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Fetch members
  useEffect(() => {
    if (!user) return;
    getDocs(collection(db, 'users')).then(snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => m.uid !== user.uid);
      setMembers(all);
    });
  }, [user, userProfile]);

  // Friend requests incoming
  useEffect(() => {
    if (!userProfile) return;
    const incoming = userProfile.friendRequests || [];
    if (incoming.length === 0) { setFriendRequests([]); return; }
    Promise.all(incoming.map(uid => getDoc(doc(db, 'users', uid)))).then(docs => {
      setFriendRequests(docs.filter(d => d.exists()).map(d => ({ id: d.id, ...d.data() })));
    });
  }, [userProfile]);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNewPostImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newPostText.trim() && !newPostImage) return;
    if (!userProfile?.canPost && !userProfile?.isAdmin) {
      showAlert('Posting Disabled', 'Your posting permission has been disabled by the admin.', 'warning');
      return;
    }
    setPosting(true);
    try {
      let imageUrl = '';
      if (newPostImage) {
        imageUrl = await uploadToCloudinary(newPostImage, 'tsok-posts');
      }
      await addDoc(collection(db, 'posts'), {
        text: newPostText.trim(),
        imageUrl,
        authorId: user.uid,
        likes: [],
        commentCount: 0,
        createdAt: serverTimestamp(),
      });
      setNewPostText('');
      setNewPostImage(null);
      setImagePreview('');
    } catch (err) {
      showAlert('Post Failed', 'Error creating post. Please check your connection and try again.', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const pendingRequests = (userProfile?.friendRequests || []).length;
  const suggestions = members.filter(m =>
    !(userProfile?.friends || []).includes(m.uid) &&
    !(userProfile?.sentRequests || []).includes(m.uid) &&
    m.uid !== user.uid
  ).slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950">
      {/* Global Toast */}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />

      {/* Global Alert Modal */}
      <AlertModal
        visible={alertModal.visible}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal(m => ({ ...m, visible: false }))}
      />

      {/* Animated BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Top Navbar */}
      <nav className="sticky top-0 z-50 bg-blue-900/80 backdrop-blur-lg border-b border-white/10 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <Image src="/tsok-logo.png" alt="TSOK" width={40} height={40} />
            <div className="hidden sm:block">
              <p className="text-white font-bold text-lg leading-none">TSOK</p>
              <p className="text-yellow-400 text-xs">Community</p>
            </div>
          </Link>

          {/* Nav Tabs */}
          <div className="flex items-center gap-1">
            {['feed', 'people', 'requests'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-2 rounded-xl font-semibold text-sm transition-all capitalize ${
                  activeTab === tab
                    ? 'bg-yellow-400 text-blue-900'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab === 'requests' ? '🔔' : tab === 'people' ? '👥' : '🏠'}{' '}
                <span className="hidden sm:inline">{tab}</span>
                {tab === 'requests' && pendingRequests > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {pendingRequests}
                  </span>
                )}
              </button>
            ))}
            {/* Chat Button */}
            <Link
              href="/chat"
              className="relative px-4 py-2 rounded-xl font-semibold text-sm transition-all text-blue-200 hover:bg-white/10 hover:text-white flex items-center gap-1"
            >
              💬 <span className="hidden sm:inline">Chat</span>
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <Link href={`/profile/${user.uid}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Avatar user={userProfile} size={9} />
              <span className="hidden sm:block text-white text-sm font-semibold truncate max-w-[100px]">
                {userProfile?.firstName || 'Profile'}
              </span>
            </Link>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-all font-medium"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">↪</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* Left Sidebar */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-20 space-y-4">
            {/* Profile Card */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl overflow-hidden shadow-xl">
              <div className="h-16 bg-gradient-to-r from-yellow-400 to-orange-500" />
              <div className="px-4 pb-4">
                <div className="-mt-8 mb-3">
                  <Link href={`/profile/${user.uid}`}>
                    <Avatar user={userProfile} size={16} />
                  </Link>
                </div>
                <Link href={`/profile/${user.uid}`} className="text-white font-bold hover:text-yellow-300 transition-colors">
                  {userProfile?.fullName || 'TSOK Member'}
                </Link>
                <p className="text-blue-300 text-xs mt-1">{userProfile?.school || userProfile?.position || 'Member'}</p>
                <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <p className="text-white font-bold">{(userProfile?.friends || []).length}</p>
                    <p className="text-blue-300 text-xs">Friends</p>
                  </div>
                  <div>
                    <p className="text-white font-bold">{posts.filter(p => p.authorId === user.uid).length}</p>
                    <p className="text-blue-300 text-xs">Posts</p>
                  </div>
                </div>
              </div>
            </div>

            {/* TSOK Links */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-xl">
              <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wide">TSOK Apps</h3>
              <Link href="/" className="flex items-center gap-2 py-2 text-blue-200 hover:text-yellow-300 transition-colors text-sm">
                🏠 <span>TSOK Portal</span>
              </Link>
              {userProfile?.isAdmin && (
                <Link href="/admin" className="flex items-center gap-2 py-2 text-blue-200 hover:text-yellow-300 transition-colors text-sm">
                  ⚙️ <span>Admin Panel</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Center Feed */}
        <div className="lg:col-span-6 space-y-4">
          {/* ── Feed Tab ── */}
          {activeTab === 'feed' && (
            <>
              {/* Create Post */}
              {(userProfile?.canPost || userProfile?.isAdmin) ? (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-xl">
                  <div className="flex gap-3">
                    <Avatar user={userProfile} size={10} />
                    <div className="flex-1">
                      <textarea
                        value={newPostText}
                        onChange={(e) => setNewPostText(e.target.value)}
                        placeholder={`What's on your mind, ${userProfile?.firstName || 'Teacher'}?`}
                        rows={3}
                        className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all resize-none text-sm"
                      />
                      {imagePreview && (
                        <div className="relative mt-2 inline-block">
                          <img src={imagePreview} alt="Preview" className="max-h-48 rounded-xl object-contain w-full bg-black/20" />
                          <button
                            onClick={() => { setNewPostImage(null); setImagePreview(''); }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-400 transition-colors"
                          >✕</button>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="flex items-center gap-2 text-blue-300 hover:text-yellow-400 transition-colors text-sm font-medium"
                        >
                          📷 <span>Add Photo</span>
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={handlePost}
                          disabled={posting || (!newPostText.trim() && !newPostImage)}
                          className="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-lg"
                        >
                          {posting ? 'Posting...' : 'Post'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-orange-500/20 border border-orange-400/30 rounded-2xl p-4 text-center text-orange-200 text-sm">
                  ⚠️ Your posting permission has been disabled by admin.
                </div>
              )}

              {/* Posts */}
              {posts.length === 0 ? (
                <div className="text-center py-16 text-blue-300">
                  <div className="text-5xl mb-4">📝</div>
                  <p className="text-lg font-semibold text-white">No posts yet</p>
                  <p className="text-sm mt-1">Be the first to share something with TSOK!</p>
                </div>
              ) : (
                <AnimatePresence>
                  {posts.map(post => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={user}
                      currentProfile={userProfile}
                    />
                  ))}
                </AnimatePresence>
              )}
            </>
          )}

          {/* ── People Tab ── */}
          {activeTab === 'people' && (
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-xl">
              <h2 className="text-white font-bold text-lg mb-4">👥 All Members</h2>
              {members.length === 0 ? (
                <p className="text-blue-300 text-center py-8">No other members yet.</p>
              ) : (
                <div className="space-y-1">
                  {members.map(m => (
                    <FriendCard
                      key={m.uid || m.id}
                      member={m}
                      currentUser={user}
                      currentProfile={userProfile}
                      onUpdate={refreshProfile}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Requests Tab ── */}
          {activeTab === 'requests' && (
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-xl">
              <h2 className="text-white font-bold text-lg mb-4">🔔 Friend Requests</h2>
              {friendRequests.length === 0 ? (
                <div className="text-center py-8 text-blue-300">
                  <div className="text-4xl mb-3">🎉</div>
                  <p>No pending friend requests.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {friendRequests.map(m => (
                    <FriendCard
                      key={m.uid || m.id}
                      member={m}
                      currentUser={user}
                      currentProfile={userProfile}
                      onUpdate={refreshProfile}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:block lg:col-span-3">
          <div className="sticky top-20 space-y-4">
            {/* People You May Know */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 shadow-xl">
              <h3 className="text-white font-bold mb-3 text-sm uppercase tracking-wide">People You May Know</h3>
              {suggestions.length === 0 ? (
                <p className="text-blue-300 text-xs text-center py-2">You know everyone! 🎉</p>
              ) : (
                <div className="space-y-1">
                  {suggestions.map(m => (
                    <FriendCard
                      key={m.uid || m.id}
                      member={m}
                      currentUser={user}
                      currentProfile={userProfile}
                      onUpdate={refreshProfile}
                    />
                  ))}
                </div>
              )}
              {suggestions.length > 0 && (
                <button
                  onClick={() => setActiveTab('people')}
                  className="w-full mt-3 text-yellow-400 text-sm font-semibold hover:text-yellow-300 transition-colors"
                >
                  See All Members →
                </button>
              )}
            </div>

            {/* Pending Requests */}
            {pendingRequests > 0 && (
              <div className="bg-yellow-400/20 border border-yellow-400/30 rounded-2xl p-4 shadow-xl">
                <h3 className="text-yellow-300 font-bold mb-2 text-sm">🔔 Friend Requests</h3>
                <p className="text-white text-sm">You have <strong>{pendingRequests}</strong> pending request{pendingRequests > 1 ? 's' : ''}.</p>
                <button
                  onClick={() => setActiveTab('requests')}
                  className="mt-2 w-full py-2 bg-yellow-400 text-blue-900 font-bold rounded-xl text-sm hover:bg-yellow-300 transition-colors"
                >
                  View Requests
                </button>
              </div>
            )}

            {/* Footer */}
            <div className="text-blue-400 text-xs space-y-1 px-2">
              <p>© 2026 TSOK - Teachers-Specialists Organization Kuwait</p>
              <p>Developed by <span className="text-yellow-400">Godmisoft</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
