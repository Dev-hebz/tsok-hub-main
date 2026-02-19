'use client';

import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { uploadToCloudinary } from '../../../lib/cloudinary';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

const formatTime = (ts) => {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const Avatar = ({ user, size = 10, className = '' }) => {
  const initials = user?.fullName
    ? user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';
  if (user?.profilePic) {
    return (
      <img
        src={user.profilePic}
        alt={user.fullName}
        className={`w-${size} h-${size} rounded-full object-cover border-4 border-yellow-400 ${className}`}
      />
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-blue-900 font-bold border-4 border-yellow-400 ${className}`}
      style={{ fontSize: `${size * 0.35}rem` }}>
      {initials}
    </div>
  );
};

export default function ProfilePage() {
  const { uid } = useParams();
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [toast, setToast] = useState('');

  const picRef = useRef(null);
  const coverRef = useRef(null);

  const isOwnProfile = user?.uid === uid;

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!uid) return;
    fetchProfile();
    fetchPosts();
  }, [uid]);

  const fetchProfile = async () => {
    try {
      const profileDoc = await getDoc(doc(db, 'users', uid));
      if (profileDoc.exists()) {
        const data = { id: profileDoc.id, ...profileDoc.data() };
        setProfile(data);
        setEditData({
          bio: data.bio || '',
          school: data.school || '',
          position: data.position || '',
        });
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchPosts = async () => {
    try {
      const q = query(
        collection(db, 'posts'),
        where('authorId', '==', uid),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching posts:', err);
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleSaveEdit = async () => {
    if (!isOwnProfile) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), {
        bio: editData.bio,
        school: editData.school,
        position: editData.position,
        fullName: `${profile.firstName} ${profile.lastName}`,
      });
      await fetchProfile();
      if (isOwnProfile) refreshProfile();
      setEditMode(false);
      showToast('Profile updated!');
    } catch (err) {
      showToast('Error saving profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPic(true);
    try {
      const url = await uploadToCloudinary(file, 'tsok-profiles');
      await updateDoc(doc(db, 'users', uid), { profilePic: url });
      await fetchProfile();
      if (isOwnProfile) refreshProfile();
      showToast('Profile picture updated!');
    } catch (err) {
      showToast('Error uploading picture.');
    } finally {
      setUploadingPic(false);
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadToCloudinary(file, 'tsok-covers');
      await updateDoc(doc(db, 'users', uid), { coverPhoto: url });
      await fetchProfile();
      if (isOwnProfile) refreshProfile();
      showToast('Cover photo updated!');
    } catch (err) {
      showToast('Error uploading cover.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleAddFriend = async () => {
    const myRef = doc(db, 'users', user.uid);
    const theirRef = doc(db, 'users', uid);
    await updateDoc(myRef, { sentRequests: arrayUnion(uid) });
    await updateDoc(theirRef, { friendRequests: arrayUnion(user.uid) });
    await fetchProfile();
    refreshProfile();
    showToast('Friend request sent!');
  };

  const handleAcceptFriend = async () => {
    const myRef = doc(db, 'users', user.uid);
    const theirRef = doc(db, 'users', uid);
    await updateDoc(myRef, {
      friends: arrayUnion(uid),
      friendRequests: arrayRemove(uid),
    });
    await updateDoc(theirRef, {
      friends: arrayUnion(user.uid),
      sentRequests: arrayRemove(user.uid),
    });
    await fetchProfile();
    refreshProfile();
    showToast('You are now friends! 🎉');
  };

  const handleUnfriend = async () => {
    if (!window.confirm('Remove this friend?')) return;
    const myRef = doc(db, 'users', user.uid);
    const theirRef = doc(db, 'users', uid);
    await updateDoc(myRef, { friends: arrayRemove(uid) });
    await updateDoc(theirRef, { friends: arrayRemove(user.uid) });
    await fetchProfile();
    refreshProfile();
    showToast('Friend removed.');
  };

  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center text-white">
        <div className="text-center">
          <p className="text-2xl font-bold">Member not found</p>
          <Link href="/feed" className="mt-4 text-yellow-400 hover:underline block">← Back to Feed</Link>
        </div>
      </div>
    );
  }

  const isFriend = userProfile?.friends?.includes(uid);
  const requestSent = userProfile?.sentRequests?.includes(uid);
  const hasRequest = userProfile?.friendRequests?.includes(uid);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950">
      {/* BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 right-4 z-[100] bg-green-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-semibold"
          >
            ✅ {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-blue-900/80 backdrop-blur-lg border-b border-white/10 shadow-2xl">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/feed" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Back to Feed</span>
          </Link>
          <div className="flex items-center gap-2">
            <Image src="/tsok-logo.png" alt="TSOK" width={32} height={32} />
            <span className="text-white font-bold">TSOK Community</span>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 relative z-10">
        {/* Profile Card */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl overflow-hidden shadow-2xl mb-6">
          {/* Cover Photo */}
          <div className="relative h-48 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500">
            {profile.coverPhoto && (
              <img src={profile.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
            )}
            {isOwnProfile && (
              <button
                onClick={() => coverRef.current?.click()}
                disabled={uploadingCover}
                className="absolute bottom-3 right-3 bg-black/50 hover:bg-black/70 text-white text-xs px-3 py-2 rounded-xl transition-all font-medium backdrop-blur-sm"
              >
                {uploadingCover ? '⏳ Uploading...' : '📷 Change Cover'}
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
          </div>

          {/* Profile Info */}
          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="flex items-end justify-between -mt-16 mb-4">
              <div className="relative">
                <Avatar user={profile} size={32} />
                {isOwnProfile && (
                  <button
                    onClick={() => picRef.current?.click()}
                    disabled={uploadingPic}
                    className="absolute bottom-1 right-1 bg-yellow-400 hover:bg-yellow-300 text-blue-900 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shadow-lg transition-all"
                    title="Change profile picture"
                  >
                    {uploadingPic ? '⏳' : '📷'}
                  </button>
                )}
                <input ref={picRef} type="file" accept="image/*" onChange={handleProfilePicUpload} className="hidden" />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mb-2">
                {isOwnProfile ? (
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="px-5 py-2 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-all text-sm"
                  >
                    {editMode ? '✕ Cancel' : '✏️ Edit Profile'}
                  </button>
                ) : (
                  <>
                    {isFriend && (
                      <button onClick={handleUnfriend} className="px-5 py-2 bg-white/20 hover:bg-red-500/30 text-white font-semibold rounded-xl transition-all text-sm">
                        ✓ Friends
                      </button>
                    )}
                    {!isFriend && !requestSent && !hasRequest && (
                      <button onClick={handleAddFriend} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all text-sm">
                        + Add Friend
                      </button>
                    )}
                    {requestSent && (
                      <span className="px-5 py-2 bg-white/10 text-blue-300 font-semibold rounded-xl text-sm">
                        Request Sent
                      </span>
                    )}
                    {hasRequest && (
                      <button onClick={handleAcceptFriend} className="px-5 py-2 bg-green-400 hover:bg-green-300 text-blue-900 font-bold rounded-xl transition-all text-sm">
                        ✓ Accept Request
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Name & Info */}
            {!editMode ? (
              <div>
                <h1 className="text-white text-2xl font-bold">{profile.fullName}</h1>
                {profile.bio && <p className="text-blue-200 mt-1 text-sm">{profile.bio}</p>}
                <div className="mt-3 flex flex-wrap gap-4 text-blue-300 text-sm">
                  {profile.position && (
                    <span>💼 {profile.position}</span>
                  )}
                  {profile.school && (
                    <span>🏫 {profile.school}</span>
                  )}
                  <span>👥 {(profile.friends || []).length} Friends</span>
                  <span>📝 {posts.length} Posts</span>
                </div>
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <h1 className="text-white text-2xl font-bold">{profile.fullName}</h1>
                <div>
                  <label className="text-blue-300 text-xs font-medium block mb-1">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={e => setEditData({ ...editData, bio: e.target.value })}
                    placeholder="Tell something about yourself..."
                    rows={3}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-blue-300 text-xs font-medium block mb-1">Position / Subject</label>
                    <input
                      value={editData.position}
                      onChange={e => setEditData({ ...editData, position: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-blue-300 text-xs font-medium block mb-1">School</label>
                    <input
                      value={editData.school}
                      onChange={e => setEditData({ ...editData, school: e.target.value })}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSaveEdit}
                    disabled={saving}
                    className="px-6 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl text-sm transition-all disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : '💾 Save Changes'}
                  </motion.button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Posts Section */}
        <div>
          <h2 className="text-white font-bold text-lg mb-4">📝 Posts by {profile.firstName}</h2>
          {posts.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-10 text-center text-blue-300 shadow-xl">
              <div className="text-4xl mb-3">📭</div>
              <p>No posts yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl overflow-hidden shadow-xl">
                  <div className="flex items-center gap-3 p-4">
                    <Avatar user={profile} size={10} />
                    <div>
                      <p className="text-white font-semibold">{profile.fullName}</p>
                      <p className="text-blue-400 text-xs">{formatTime(post.createdAt)}</p>
                    </div>
                  </div>
                  {post.text && (
                    <div className="px-4 pb-3">
                      <p className="text-white whitespace-pre-wrap">{post.text}</p>
                    </div>
                  )}
                  {post.imageUrl && (
                    <img src={post.imageUrl} alt="Post" className="w-full object-cover max-h-[400px]" />
                  )}
                  <div className="px-4 py-3 border-t border-white/10 flex gap-4 text-sm text-blue-300">
                    <span>👍 {(post.likes || []).length} Likes</span>
                    <Link href="/feed" className="hover:text-yellow-300 transition-colors">View on Feed →</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-blue-400 text-xs mt-8">© 2026 TSOK | Developed by Godmisoft</p>
      </div>
    </div>
  );
}
