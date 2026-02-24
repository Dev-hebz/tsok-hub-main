'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, getDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Toast, ConfirmModal, AlertModal } from '../../components/Modals';

export default function Admin() {
  const [websites, setWebsites] = useState([]);
  const [members, setMembers] = useState([]);
  const [landingPosts, setLandingPosts] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('websites');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const [confirmModal, setConfirmModal] = useState({ visible: false, title: '', message: '', onConfirm: null, type: 'danger' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const showConfirm = (title, message, onConfirm, type = 'danger') => {
    setConfirmModal({ visible: true, title, message, onConfirm, type });
  };

  const closeConfirm = () => setConfirmModal(m => ({ ...m, visible: false }));

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    icon: '',
    category: 'education',
    order: 0,
    isNew: false,
    style: 'bg-gradient-to-br from-white/10 to-white/5',
  });

  const ADMIN_PASSWORD = 'admin1414';

  // Check Firebase Auth state on load
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Check if user has isAdmin: true in Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists() && userDoc.data().isAdmin === true) {
            setIsAuthenticated(true);
            setIsAdmin(true);
          } else {
            setIsAuthenticated(false);
            setIsAdmin(false);
            setLoginError('Your account does not have admin access.');
            await signOut(auth);
          }
        } catch (err) {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
      setAuthChecking(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWebsites();
      fetchMembers();
      fetchLandingData();
    }
  }, [isAuthenticated]);

  const fetchWebsites = async () => {
    try {
      const q = query(collection(db, 'websites'), orderBy('order', 'asc'));
      const snap = await getDocs(q);
      setWebsites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching websites:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchLandingData = async () => {
    try {
      const [postsSnap, sponsorsSnap, activitiesSnap] = await Promise.all([
        getDocs(query(collection(db, 'landingPosts'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'sponsors'), orderBy('order', 'asc'))),
        getDocs(query(collection(db, 'activities'), orderBy('date', 'asc'))),
      ]);
      setLandingPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSponsors(sponsorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setActivities(activitiesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error fetching landing data:', err);
    }
  };

  const toggleMemberCanPost = async (memberId, currentValue, memberName) => {
    await updateDoc(doc(db, 'users', memberId), { canPost: !currentValue });
    fetchMembers();
    showToast(!currentValue ? `${memberName} can now post.` : `${memberName}'s posting blocked.`, !currentValue ? 'success' : 'warning');
  };

  const toggleMemberAdmin = async (memberId, currentValue, memberName) => {
    await updateDoc(doc(db, 'users', memberId), { isAdmin: !currentValue });
    fetchMembers();
    showToast(!currentValue ? `${memberName} is now admin.` : `${memberName} removed as admin.`, 'info');
  };

  const deleteMember = (memberId, memberName) => {
    showConfirm(
      'Delete Member',
      `Are you sure you want to delete ${memberName || 'this member'}? This cannot be undone.`,
      async () => {
        closeConfirm();
        await deleteDoc(doc(db, 'users', memberId));
        fetchMembers();
        showToast('Member deleted.', 'warning');
      },
      'danger'
    );
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Check isAdmin in Firestore
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      if (userDoc.exists() && userDoc.data().isAdmin === true) {
        setIsAuthenticated(true);
        setIsAdmin(true);
      } else {
        await signOut(auth);
        setLoginError('You do not have admin access. Contact the super admin.');
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setLoginError('Invalid email or password.');
      } else {
        setLoginError('Login failed. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setEmail('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'websites', editingId), formData);
        showToast('Website updated successfully!', 'success');
      } else {
        await addDoc(collection(db, 'websites'), formData);
        showToast('Website added successfully!', 'success');
      }
      resetForm();
      fetchWebsites();
    } catch (error) {
      console.error('Error saving website:', error);
      showToast('Error saving website. Try again.', 'error');
    }
  };

  const handleEdit = (site) => {
    setFormData(site);
    setEditingId(site.id);
    setShowForm(true);
  };

  const handleDelete = (id, title) => {
    showConfirm(
      'Delete Website',
      `Are you sure you want to delete "${title}"?`,
      async () => {
        closeConfirm();
        try {
          await deleteDoc(doc(db, 'websites', id));
          showToast('Website deleted!', 'warning');
          fetchWebsites();
        } catch (error) {
          showToast('Error deleting website.', 'error');
        }
      },
      'danger'
    );
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      url: '',
      icon: '',
      category: 'education',
      order: 0,
      isNew: false,
      style: 'bg-gradient-to-br from-white/10 to-white/5',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const categoryOptions = [
    { value: 'education', label: 'Education' },
    { value: 'finance', label: 'Finance' },
    { value: 'communication', label: 'Communication' },
    { value: 'tools', label: 'Tools' },
    { value: 'other', label: 'Other' },
  ];

  const styleOptions = [
    { value: 'bg-gradient-to-br from-white/10 to-white/5', label: 'Default Glass' },
    { value: 'bg-gradient-to-br from-blue-600/30 to-blue-900/30', label: 'Blue' },
    { value: 'bg-gradient-to-br from-yellow-500/30 to-orange-600/30', label: 'Yellow/Orange' },
    { value: 'bg-gradient-to-br from-green-500/30 to-emerald-700/30', label: 'Green' },
    { value: 'bg-gradient-to-br from-purple-500/30 to-purple-900/30', label: 'Purple' },
    { value: 'bg-gradient-to-br from-red-500/30 to-red-900/30', label: 'Red' },
  ];

  // ── Auth Checking ─────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ── Login Screen ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse"></div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md border border-white/20 shadow-2xl"
        >
          <div className="text-center mb-8">
            <Image src="/tsok-logo.png" alt="TSOK" width={80} height={80} className="mx-auto mb-4 drop-shadow-2xl" />
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-blue-200 text-sm mt-1">Sign in with your admin account</p>
          </div>

          {loginError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm text-center"
            >
              {loginError}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-blue-200 text-sm font-medium block mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@email.com"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              />
            </div>
            <div>
              <label className="text-blue-200 text-sm font-medium block mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-yellow-400 text-blue-900 font-bold rounded-xl hover:bg-yellow-300 transition-colors text-lg disabled:opacity-60"
            >
              {loginLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : '🔐 Sign In as Admin'}
            </motion.button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 space-y-2 text-center">
            <Link href="/feed" className="text-blue-300 text-sm hover:text-white transition-colors block">
              👥 Go to Community Feed
            </Link>
            <Link href="/" className="text-blue-300 text-sm hover:text-white transition-colors block">
              ← Back to TSOK Portal
            </Link>
          </div>

          <div className="mt-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
            <p className="text-yellow-300 text-xs text-center">
              ⚠️ Admin access requires <strong>isAdmin: true</strong> in your Firestore user document.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Filtered members ──────────────────────────────────────────
  const filteredMembers = members.filter(
    (m) =>
      m.fullName?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.email?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // ── Export Members Excel ──────────────────────────────────────
  const exportMembersExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const now = new Date();
      const headers = [
        'Full Name', 'Email', 'School / Position', 'Contact Number',
        'Membership Type', 'Role', 'Can Post', 'Is Admin',
        'Joined Date',
      ];
      const rows = members.map(m => [
        m.fullName || '',
        m.email || '',
        m.school || m.position || '',
        m.contactNumber || m.phone || '',
        m.membershipType || m.membership || '',
        m.role || 'member',
        m.canPost ? 'Yes' : 'No',
        m.isAdmin ? 'Yes' : 'No',
        m.createdAt ? new Date(m.createdAt.seconds * 1000).toLocaleDateString() : '',
      ]);
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 28 }, { wch: 30 }, { wch: 28 }, { wch: 18 },
        { wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 16 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Members');
      XLSX.writeFile(wb, `TSOK_Members_${now.getFullYear()}.xlsx`);
      showToast('Members Excel downloaded!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Export failed. Try again.', 'error');
    }
  };

  // ── Main Admin UI ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950">
      {/* Global Toast */}
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />

      {/* Global Confirm Modal */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />

      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Image src="/tsok-logo.png" alt="TSOK" width={50} height={50} />
              <div>
                <h1 className="text-xl font-bold text-white">TSOK Admin Panel</h1>
                <p className="text-blue-200 text-xs">Manage websites and members</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm">
                Portal
              </Link>
              <Link href="/feed" className="px-4 py-2 bg-yellow-400 text-blue-900 rounded-xl font-bold hover:bg-yellow-300 transition-colors text-sm">
                Community
              </Link>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => setActiveTab('websites')}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'websites' ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            🌐 Websites ({websites.length})
          </button>
          <button onClick={() => setActiveTab('members')}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'members' ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            👥 Members ({members.length})
          </button>
          <button onClick={() => setActiveTab('posts')}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'posts' ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            📣 News Posts ({landingPosts.length})
          </button>
          <button onClick={() => setActiveTab('sponsors')}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'sponsors' ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            🤝 Sponsors ({sponsors.length})
          </button>
          <button onClick={() => setActiveTab('activities')}
            className={`px-4 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'activities' ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
            📅 Activities ({activities.length})
          </button>
          <Link href="/financial"
            className="px-4 py-2.5 rounded-xl font-bold transition-all text-sm bg-green-500/20 text-green-300 hover:bg-green-500/30 border border-green-400/30 flex items-center gap-1.5">
            💰 Financial Records
          </Link>
        </div>

        {/* ── WEBSITES TAB ── */}
        {activeTab === 'websites' && (
          <div>
            {/* Add Button */}
            <div className="mb-6">
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-yellow-400 text-blue-900 px-6 py-3 rounded-xl font-bold hover:bg-yellow-300 transition-colors"
              >
                {showForm ? '✕ Cancel' : '+ Add New Website'}
              </button>
            </div>

            {/* Add/Edit Form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6"
                >
                  <h2 className="text-xl font-bold text-white mb-6">
                    {editingId ? 'Edit Website' : 'Add New Website'}
                  </h2>
                  <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-blue-200 text-sm font-medium block mb-2">Title</label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="text-blue-200 text-sm font-medium block mb-2">URL</label>
                      <input
                        type="url"
                        required
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-blue-200 text-sm font-medium block mb-2">Description</label>
                      <textarea
                        required
                        rows={2}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-blue-200 text-sm font-medium block mb-2">Icon URL</label>
                      <input
                        type="text"
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        placeholder="/tsok-logo.png or https://..."
                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="text-blue-200 text-sm font-medium block mb-2">Order</label>
                      <input
                        type="number"
                        value={formData.order}
                        onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      />
                    </div>
                    <div>
                      <label className="text-blue-200 text-sm font-medium block mb-2">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-blue-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      >
                        {categoryOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-blue-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-blue-200 text-sm font-medium block mb-2">Card Style</label>
                      <select
                        value={formData.style}
                        onChange={(e) => setFormData({ ...formData, style: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-blue-900 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                      >
                        {styleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-blue-900">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center">
                      <label className="flex items-center text-white cursor-pointer gap-2">
                        <input
                          type="checkbox"
                          checked={formData.isNew}
                          onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })}
                          className="w-5 h-5"
                        />
                        <span className="font-semibold">Mark as NEW</span>
                      </label>
                    </div>
                    <div className="md:col-span-2 flex gap-3">
                      <button
                        type="submit"
                        className="bg-yellow-400 text-blue-900 px-6 py-2 rounded-xl font-bold hover:bg-yellow-300 transition-colors"
                      >
                        {editingId ? 'Update Website' : 'Add Website'}
                      </button>
                      {editingId && (
                        <button
                          type="button"
                          onClick={resetForm}
                          className="bg-white/10 text-white px-6 py-2 rounded-xl hover:bg-white/20 transition-colors"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Websites List */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-white mb-6">Current Websites ({websites.length})</h2>
              <div className="space-y-4">
                {websites.map((site) => (
                  <motion.div
                    key={site.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Image
                            src={site.icon || '/tsok-logo.png'}
                            alt={site.title}
                            width={40}
                            height={40}
                            className="rounded object-contain bg-white/10 p-1"
                          />
                          <div>
                            <h3 className="text-lg font-bold text-white">{site.title}</h3>
                            <p className="text-xs text-blue-300">{site.category}</p>
                          </div>
                          {site.isNew && (
                            <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded-full">NEW</span>
                          )}
                        </div>
                        <p className="text-blue-200 text-sm mb-2">{site.description}</p>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-yellow-400 text-xs hover:underline"
                        >
                          {site.url}
                        </a>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(site)}
                          className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(site.id, site.title)}
                          className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {websites.length === 0 && (
                  <div className="text-center py-10 text-blue-300">
                    <div className="text-4xl mb-3">🌐</div>
                    <p>No websites added yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {activeTab === 'members' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-white">Member Management ({members.length})</h2>
              <div className="flex gap-2 flex-wrap">
                <button onClick={exportMembersExcel}
                  className="px-4 py-2 bg-green-500/20 hover:bg-green-500/40 border border-green-400/40 text-green-300 font-bold rounded-xl text-sm transition-all flex items-center gap-1.5">
                  📊 Export Excel
                </button>
                <input
                  type="text"
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3"
                >
                  {/* Avatar + Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-blue-900 font-bold text-sm overflow-hidden border-2 border-yellow-400 flex-shrink-0">
                      {member.profilePic ? (
                        <img src={member.profilePic} alt={member.fullName} className="w-full h-full object-cover" />
                      ) : (
                        member.fullName?.split(' ').map((n) => n[0]).slice(0, 2).join('') || '?'
                      )}
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm">{member.fullName || 'Unknown'}</p>
                      <p className="text-blue-300 text-xs">{member.email}</p>
                      <p className="text-blue-400 text-xs">{member.school || member.position || 'TSOK Member'}</p>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center flex-wrap gap-2">
                    {member.isAdmin && (
                      <span className="px-2 py-1 bg-purple-500/30 border border-purple-400/30 text-purple-300 text-xs rounded-full font-semibold">
                        Admin
                      </span>
                    )}
                    <button
                      onClick={() => toggleMemberCanPost(member.id, member.canPost, member.firstName || member.fullName)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                        member.canPost !== false
                          ? 'bg-green-500/20 border-green-400/30 text-green-300 hover:bg-red-500/20 hover:border-red-400/30 hover:text-red-300'
                          : 'bg-red-500/20 border-red-400/30 text-red-300 hover:bg-green-500/20 hover:border-green-400/30 hover:text-green-300'
                      }`}
                    >
                      {member.canPost !== false ? '✓ Can Post' : '✗ Blocked'}
                    </button>
                    <button
                      onClick={() => toggleMemberAdmin(member.id, member.isAdmin, member.firstName || member.fullName)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                        member.isAdmin
                          ? 'bg-purple-500/20 border-purple-400/30 text-purple-300'
                          : 'bg-white/10 border-white/20 text-blue-300 hover:bg-purple-500/20 hover:text-purple-300'
                      }`}
                    >
                      {member.isAdmin ? '★ Admin' : 'Make Admin'}
                    </button>
                    <Link
                      href={'/profile/' + member.uid}
                      target="_blank"
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 border border-blue-400/30 text-blue-300 hover:bg-blue-500/30 transition-all"
                    >
                      View Profile
                    </Link>
                    <button
                      onClick={() => deleteMember(member.id, member.fullName)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 border border-red-400/30 text-red-300 hover:bg-red-500/40 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {filteredMembers.length === 0 && (
                <div className="text-center py-10 text-blue-300">
                  <div className="text-4xl mb-3">👥</div>
                  <p>{memberSearch ? 'No members match your search.' : 'No members registered yet.'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LANDING POSTS TAB ── */}
        {activeTab === 'posts' && (
          <LandingPostsTab posts={landingPosts} onRefresh={fetchLandingData} showToast={showToast} />
        )}

        {/* ── SPONSORS TAB ── */}
        {activeTab === 'sponsors' && (
          <SponsorsTab sponsors={sponsors} onRefresh={fetchLandingData} showToast={showToast} />
        )}

        {/* ── ACTIVITIES TAB ── */}
        {activeTab === 'activities' && (
          <ActivitiesTab activities={activities} onRefresh={fetchLandingData} showToast={showToast} />
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-blue-400 text-xs relative z-10">
        © 2026 TSOK Hub
      </div>
    </div>
  );
}

// ── LANDING POSTS TAB ────────────────────────────────────────────
function LandingPostsTab({ posts, onRefresh, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ caption: '', description: '', imageUrls: [], videoUrl: '' });
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  const openAdd = () => { setEditingId(null); setForm({ caption: '', description: '', imageUrls: [], videoUrl: '' }); setShowForm(true); };
  const openEdit = (post) => {
    setEditingId(post.id);
    setForm({
      caption: post.caption || '',
      description: post.description || '',
      imageUrls: post.imageUrls || (post.imageUrl ? [post.imageUrl] : []),
      videoUrl: post.videoUrl || ''
    });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm({ caption: '', description: '', imageUrls: [], videoUrl: '' }); };

  const uploadImages = async (files) => {
    setUploading(true);
    try {
      const { uploadToCloudinary } = await import('../../lib/cloudinary');
      const urls = await Promise.all(Array.from(files).map(f => uploadToCloudinary(f, 'tsok-landing')));
      setForm(f => ({ ...f, imageUrls: [...f.imageUrls, ...urls] }));
    } catch { showToast('Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const uploadVideo = async (file) => {
    setUploading(true);
    try {
      const { uploadVideoToCloudinary } = await import('../../lib/cloudinary');
      const url = await uploadVideoToCloudinary(file, 'tsok-landing');
      setForm(f => ({ ...f, videoUrl: url }));
    } catch { showToast('Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const removeImage = (idx) => setForm(f => ({ ...f, imageUrls: f.imageUrls.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.caption && form.imageUrls.length === 0 && !form.videoUrl) return showToast('Add caption or media', 'error');
    setSaving(true);
    try {
      const data = { caption: form.caption, description: form.description, imageUrls: form.imageUrls, imageUrl: form.imageUrls[0] || '', videoUrl: form.videoUrl };
      if (editingId) {
        await updateDoc(doc(db, 'landingPosts', editingId), data);
        showToast('Post updated!', 'success');
      } else {
        await addDoc(collection(db, 'landingPosts'), { ...data, createdAt: serverTimestamp() });
        showToast('Post added!', 'success');
      }
      closeForm(); onRefresh();
    } catch { showToast('Error saving post', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'landingPosts', id));
    showToast('Post deleted', 'success');
    onRefresh();
  };

  // Get first image for display
  const getThumb = (post) => post.imageUrls?.[0] || post.imageUrl || '';
  const getCount = (post) => (post.imageUrls?.length || (post.imageUrl ? 1 : 0));

  return (
    <div>
      <div className="mb-6">
        <button onClick={showForm ? closeForm : openAdd}
          className="bg-yellow-400 text-blue-900 px-5 py-2.5 rounded-xl font-bold hover:bg-yellow-300 transition-colors">
          {showForm ? '✕ Cancel' : '+ Add News Post'}
        </button>
      </div>
      {showForm && (
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">{editingId ? '✏️ Edit Post' : 'New News/Update Post'}</h3>
          <div className="space-y-3">
            <input value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              placeholder="Caption / Title" className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)" rows={3}
              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm resize-none" />
            <div className="flex gap-3 flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-all">
                📷 Add Photos {form.imageUrls.length > 0 ? `(${form.imageUrls.length})` : ''}
              </button>
              <button type="button" onClick={() => videoRef.current?.click()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-all">
                🎬 {form.videoUrl ? '✅ Video Added' : 'Add Video'}
              </button>
              {form.videoUrl && <button type="button" onClick={() => setForm(f => ({ ...f, videoUrl: '' }))} className="px-3 py-2 bg-red-500/20 text-red-300 rounded-xl text-sm transition-all">✕ Remove Video</button>}
              {uploading && <span className="text-yellow-400 text-sm self-center animate-pulse">⏳ Uploading...</span>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              onChange={e => e.target.files?.length && uploadImages(e.target.files)} />
            <input ref={videoRef} type="file" accept="video/*" className="hidden"
              onChange={e => e.target.files[0] && uploadVideo(e.target.files[0])} />
            {/* Image previews grid */}
            {form.imageUrls.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {form.imageUrls.map((url, idx) => (
                  <div key={idx} className="relative group">
                    <img src={url} alt={`img-${idx}`} className="w-full aspect-square object-contain bg-black/20 rounded-lg" />
                    <button onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">✕</button>
                    {idx === 0 && <span className="absolute bottom-1 left-1 text-[9px] bg-yellow-400 text-blue-900 px-1 rounded font-bold">Cover</span>}
                  </div>
                ))}
              </div>
            )}
            {form.videoUrl && <video src={form.videoUrl} controls className="w-full max-h-48 rounded-xl" />}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving || uploading}
              className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl text-sm disabled:opacity-60 transition-all">
              {saving ? 'Saving...' : editingId ? '💾 Update Post' : '💾 Save Post'}
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map(post => (
          <div key={post.id} className="bg-white/10 border border-white/20 rounded-2xl overflow-hidden">
            {post.videoUrl
              ? <video src={post.videoUrl} className="w-full aspect-video object-contain bg-black/20" muted preload="metadata" />
              : getThumb(post)
              ? <div className="relative">
                  <img src={getThumb(post)} alt={post.caption} className="w-full object-contain bg-black/20" />
                  {getCount(post) > 1 && <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">+{getCount(post) - 1} more</span>}
                </div>
              : null}
            <div className="p-3">
              {post.caption && <p className="text-white font-semibold text-sm mb-1">{post.caption}</p>}
              {post.description && <p className="text-blue-300 text-xs line-clamp-2">{post.description}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => openEdit(post)}
                  className="px-3 py-1.5 bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-300 rounded-lg text-xs font-semibold transition-all">
                  ✏️ Edit
                </button>
                <button onClick={() => handleDelete(post.id)}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg text-xs font-semibold transition-all">
                  🗑️ Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p className="text-blue-300 col-span-full text-center py-10">No posts yet. Add one above!</p>}
      </div>
    </div>
  );
}

// ── SPONSORS TAB ─────────────────────────────────────────────────
function SponsorsTab({ sponsors, onRefresh, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', logoUrl: '', link: '', order: '' });
  const fileRef = useRef(null);

  const openAdd = () => { setEditingId(null); setForm({ name: '', logoUrl: '', link: '', order: sponsors.length + 1 }); setShowForm(true); };
  const openEdit = (sp) => { setEditingId(sp.id); setForm({ name: sp.name || '', logoUrl: sp.logoUrl || '', link: sp.link || '', order: sp.order || '' }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const uploadLogo = async (file) => {
    setUploading(true);
    try {
      const { uploadToCloudinary } = await import('../../lib/cloudinary');
      const url = await uploadToCloudinary(file, 'tsok-sponsors');
      setForm(f => ({ ...f, logoUrl: url }));
    } catch { showToast('Upload failed', 'error'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.name && !form.logoUrl) return showToast('Add name or logo', 'error');
    setSaving(true);
    try {
      const data = { name: form.name, logoUrl: form.logoUrl, link: form.link, order: Number(form.order) || 0 };
      if (editingId) {
        await updateDoc(doc(db, 'sponsors', editingId), data);
        showToast('Sponsor updated!', 'success');
      } else {
        await addDoc(collection(db, 'sponsors'), data);
        showToast('Sponsor added!', 'success');
      }
      closeForm();
      onRefresh();
    } catch { showToast('Error saving', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'sponsors', id));
    showToast('Sponsor removed', 'success');
    onRefresh();
  };

  return (
    <div>
      <div className="mb-6">
        <button onClick={showForm ? closeForm : openAdd}
          className="bg-yellow-400 text-blue-900 px-5 py-2.5 rounded-xl font-bold hover:bg-yellow-300 transition-colors">
          {showForm ? '✕ Cancel' : '+ Add Sponsor'}
        </button>
      </div>
      {showForm && (
        <div className="bg-white/10 border border-white/20 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">{editingId ? '✏️ Edit Sponsor' : 'New Sponsor / Partner'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Sponsor name" className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
            <input value={form.link} onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
              placeholder="Website URL (optional)" className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
            <input value={form.order} type="number" onChange={e => setForm(f => ({ ...f, order: e.target.value }))}
              placeholder="Display order" className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
            <div className="flex gap-2 items-center flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-all">
                🖼️ {form.logoUrl ? '✅ Logo Added' : 'Upload Logo'}
              </button>
              {form.logoUrl && <button type="button" onClick={() => setForm(f => ({ ...f, logoUrl: '' }))} className="px-3 py-2 bg-red-500/20 text-red-300 rounded-xl text-sm">✕ Remove</button>}
              {uploading && <span className="text-yellow-400 text-xs animate-pulse">Uploading...</span>}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files[0] && uploadLogo(e.target.files[0])} />
          {form.logoUrl && <img src={form.logoUrl} alt="Preview" className="mt-3 h-16 object-contain rounded-lg" />}
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving || uploading}
              className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl text-sm disabled:opacity-60">
              {saving ? 'Saving...' : editingId ? '💾 Update Sponsor' : '💾 Save Sponsor'}
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {sponsors.map(sp => (
          <div key={sp.id} className="bg-white/10 border border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
            {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-12 max-w-[80px] object-contain" />}
            <p className="text-white text-xs font-semibold">{sp.name}</p>
            {sp.link && <a href={sp.link} target="_blank" rel="noopener noreferrer" className="text-blue-300 text-xs underline truncate w-full">{sp.link}</a>}
            <div className="flex gap-1.5 mt-1">
              <button onClick={() => openEdit(sp)}
                className="px-2.5 py-1 bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-300 rounded-lg text-xs font-semibold transition-all">
                ✏️ Edit
              </button>
              <button onClick={() => handleDelete(sp.id)}
                className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg text-xs font-semibold transition-all">
                🗑️
              </button>
            </div>
          </div>
        ))}
        {sponsors.length === 0 && <p className="text-blue-300 col-span-full text-center py-10">No sponsors yet.</p>}
      </div>
    </div>
  );
}

// ── ACTIVITIES TAB ───────────────────────────────────────────────
function ActivitiesTab({ activities, onRefresh, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', date: '', location: '', description: '' });

  const openAdd = () => { setEditingId(null); setForm({ title: '', date: '', location: '', description: '' }); setShowForm(true); };
  const openEdit = (act) => { setEditingId(act.id); setForm({ title: act.title || '', date: act.date || '', location: act.location || '', description: act.description || '' }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.title || !form.date) return showToast('Title and date required', 'error');
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'activities', editingId), form);
        showToast('Activity updated!', 'success');
      } else {
        await addDoc(collection(db, 'activities'), form);
        showToast('Activity added!', 'success');
      }
      closeForm();
      onRefresh();
    } catch { showToast('Error saving', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'activities', id));
    showToast('Activity removed', 'success');
    onRefresh();
  };

  const isUpcoming = (d) => d && new Date(d) >= new Date();

  return (
    <div>
      <div className="mb-6">
        <button onClick={showForm ? closeForm : openAdd}
          className="bg-yellow-400 text-blue-900 px-5 py-2.5 rounded-xl font-bold hover:bg-yellow-300 transition-colors">
          {showForm ? '✕ Cancel' : '+ Add Activity'}
        </button>
      </div>
      {showForm && (
        <div className="bg-white/10 border border-white/20 rounded-2xl p-6 mb-6">
          <h3 className="text-white font-bold text-lg mb-4">{editingId ? '✏️ Edit Activity' : 'New Activity / Event'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Activity title *" className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
            <input value={form.date} type="date" onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Location (optional)" className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)" className="px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl text-sm disabled:opacity-60">
              {saving ? 'Saving...' : editingId ? '💾 Update Activity' : '💾 Save Activity'}
            </button>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {activities.map(act => (
          <div key={act.id} className={`bg-white/10 border rounded-2xl p-4 flex items-center gap-4 ${isUpcoming(act.date) ? 'border-yellow-400/40' : 'border-white/10 opacity-60'}`}>
            <div className="flex-shrink-0 text-center bg-yellow-400/20 border border-yellow-400/40 rounded-xl px-3 py-2 min-w-[52px]">
              <p className="text-yellow-400 text-xs font-bold uppercase">{new Date(act.date).toLocaleDateString('en-US', { month: 'short' })}</p>
              <p className="text-yellow-300 text-xl font-black">{new Date(act.date).getDate()}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{act.title}</p>
              {act.location && <p className="text-blue-300 text-xs">📍 {act.location}</p>}
              {act.description && <p className="text-blue-200 text-xs">{act.description}</p>}
              {!isUpcoming(act.date) && <span className="text-xs text-blue-400">Past event</span>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => openEdit(act)}
                className="px-3 py-1.5 bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-300 rounded-lg text-xs font-semibold transition-all">
                ✏️ Edit
              </button>
              <button onClick={() => handleDelete(act.id)}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg text-xs font-semibold transition-all">
                🗑️
              </button>
            </div>
          </div>
        ))}
        {activities.length === 0 && <p className="text-blue-300 text-center py-10">No activities yet.</p>}
      </div>
    </div>
  );
}
