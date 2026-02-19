'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

export default function Admin() {
  const [websites, setWebsites] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeTab, setActiveTab] = useState('websites');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [memberSearch, setMemberSearch] = useState('');

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

  useEffect(() => {
    if (isAuthenticated) {
      fetchWebsites();
      fetchMembers();
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

  const toggleMemberCanPost = async (memberId, currentValue) => {
    await updateDoc(doc(db, 'users', memberId), { canPost: !currentValue });
    fetchMembers();
  };

  const toggleMemberAdmin = async (memberId, currentValue) => {
    await updateDoc(doc(db, 'users', memberId), { isAdmin: !currentValue });
    fetchMembers();
  };

  const deleteMember = async (memberId) => {
    if (!confirm('Delete this member? This cannot be undone.')) return;
    await deleteDoc(doc(db, 'users', memberId));
    fetchMembers();
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect password!');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'websites', editingId), formData);
        alert('Website updated!');
      } else {
        await addDoc(collection(db, 'websites'), formData);
        alert('Website added!');
      }
      resetForm();
      fetchWebsites();
    } catch (error) {
      console.error('Error saving website:', error);
      alert('Error saving website');
    }
  };

  const handleEdit = (site) => {
    setFormData(site);
    setEditingId(site.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this website?')) {
      try {
        await deleteDoc(doc(db, 'websites', id));
        alert('Website deleted!');
        fetchWebsites();
      } catch (error) {
        console.error('Error deleting website:', error);
        alert('Error deleting website');
      }
    }
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

  // ── Login Screen ──────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 w-full max-w-md shadow-2xl"
        >
          <div className="text-center mb-8">
            <Image src="/tsok-logo.png" alt="TSOK" width={80} height={80} className="mx-auto mb-4 drop-shadow-xl" />
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <p className="text-blue-200 mt-1">TSOK Portal Management</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <button
              type="submit"
              className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all text-lg"
            >
              Login
            </button>
          </form>
          <div className="mt-4 text-center">
            <Link href="/" className="text-blue-300 text-sm hover:text-white transition-colors">
              Back to Portal
            </Link>
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

  // ── Main Admin UI ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950">
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
                onClick={() => setIsAuthenticated(false)}
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
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setActiveTab('websites')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'websites'
                ? 'bg-yellow-400 text-blue-900'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            🌐 Websites ({websites.length})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-6 py-3 rounded-xl font-bold transition-all ${
              activeTab === 'members'
                ? 'bg-yellow-400 text-blue-900'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            👥 Members ({members.length})
          </button>
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
                          onClick={() => handleDelete(site.id)}
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
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm"
              />
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
                      onClick={() => toggleMemberCanPost(member.id, member.canPost)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                        member.canPost !== false
                          ? 'bg-green-500/20 border-green-400/30 text-green-300 hover:bg-red-500/20 hover:border-red-400/30 hover:text-red-300'
                          : 'bg-red-500/20 border-red-400/30 text-red-300 hover:bg-green-500/20 hover:border-green-400/30 hover:text-green-300'
                      }`}
                    >
                      {member.canPost !== false ? '✓ Can Post' : '✗ Blocked'}
                    </button>
                    <button
                      onClick={() => toggleMemberAdmin(member.id, member.isAdmin)}
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
                      onClick={() => deleteMember(member.id)}
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
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-blue-400 text-xs">
        © 2026 TSOK | Developed by Godmisoft
      </div>
    </div>
  );
}
