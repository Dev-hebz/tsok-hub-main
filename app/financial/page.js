'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

// ── HELPERS ─────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (ts) => ts ? new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const fmtDateShort = (ts) => ts ? new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

const CATEGORIES_IN  = ['Membership Fee', 'Donation', 'Event Income', 'Sponsorship', 'Fundraising', 'Other Income'];
const CATEGORIES_OUT = ['Venue', 'Food & Drinks', 'Supplies', 'Transportation', 'Printing', 'Awards', 'Utilities', 'Other Expense'];
const FINANCIAL_PASSWORD = 'TSOK2026Finance';

// ── TOAST ────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast.visible) return null;
  return (
    <div className={`fixed top-5 right-5 z-[999] px-5 py-3 rounded-2xl shadow-2xl text-white font-semibold text-sm flex items-center gap-2 transition-all ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`}>
      {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'} {toast.message}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────
export default function FinancialPage() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Password gate
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Data
  const [transactions, setTransactions] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('IN'); // 'IN' | 'OUT'
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQ, setSearchQ] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

  const [form, setForm] = useState({ description: '', amount: '', category: '', date: '', notes: '' });

  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  // ── Auth check ────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) setUserProfile(snap.data());
        } catch {}
      }
      setAuthChecking(false);
    });
    return () => unsub();
  }, []);

  // ── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    if (!passwordVerified) return;
    const unsubTx = onSnapshot(
      query(collection(db, 'financialTransactions'), orderBy('date', 'desc')),
      (snap) => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubLog = onSnapshot(
      query(collection(db, 'financialLogs'), orderBy('createdAt', 'desc')),
      (snap) => setActivityLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubTx(); unsubLog(); };
  }, [passwordVerified]);

  // ── Log helper ────────────────────────────────────────────────
  const logActivity = async (action, details) => {
    try {
      await addDoc(collection(db, 'financialLogs'), {
        action,
        details,
        userId: user?.uid || 'unknown',
        userEmail: user?.email || 'unknown',
        userName: userProfile?.fullName || user?.email || 'Unknown',
        createdAt: serverTimestamp(),
      });
    } catch {}
  };

  // ── Password verify ───────────────────────────────────────────
  const handlePasswordSubmit = () => {
    if (passwordInput === FINANCIAL_PASSWORD) {
      setPasswordVerified(true);
      setPasswordError('');
      logActivity('ACCESS', 'Accessed Financial Module');
    } else {
      setPasswordError('Incorrect password. Please try again.');
      setPasswordInput('');
    }
  };

  // ── Form helpers ──────────────────────────────────────────────
  const openAdd = (type) => {
    setFormType(type);
    setEditingId(null);
    setForm({ description: '', amount: '', category: type === 'IN' ? CATEGORIES_IN[0] : CATEGORIES_OUT[0], date: new Date().toISOString().split('T')[0], notes: '' });
    setShowForm(true);
  };

  const openEdit = (tx) => {
    setFormType(tx.type);
    setEditingId(tx.id);
    setForm({ description: tx.description || '', amount: tx.amount || '', category: tx.category || '', date: tx.date || '', notes: tx.notes || '' });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) return showToast('Fill in all required fields', 'error');
    if (isNaN(Number(form.amount)) || Number(form.amount) <= 0) return showToast('Enter a valid amount', 'error');
    setSaving(true);
    try {
      const data = {
        type: formType,
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        date: form.date,
        notes: form.notes,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email || 'unknown',
        updatedByName: userProfile?.fullName || user?.email || 'Unknown',
      };
      if (editingId) {
        await updateDoc(doc(db, 'financialTransactions', editingId), data);
        await logActivity('EDIT', `Edited ${formType} — ${form.description} — ₱${fmt(form.amount)}`);
        showToast('Transaction updated!', 'success');
      } else {
        data.createdAt = serverTimestamp();
        data.createdBy = user?.email || 'unknown';
        data.createdByName = userProfile?.fullName || user?.email || 'Unknown';
        await addDoc(collection(db, 'financialTransactions'), data);
        await logActivity('ADD', `Added ${formType} — ${form.description} — ₱${fmt(form.amount)}`);
        showToast(`${formType === 'IN' ? 'Income' : 'Expense'} added!`, 'success');
      }
      closeForm();
    } catch { showToast('Error saving transaction', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (tx) => {
    if (!confirm(`Delete "${tx.description}"?`)) return;
    try {
      await deleteDoc(doc(db, 'financialTransactions', tx.id));
      await logActivity('DELETE', `Deleted ${tx.type} — ${tx.description} — ₱${fmt(tx.amount)}`);
      showToast('Transaction deleted', 'success');
    } catch { showToast('Error deleting', 'error'); }
  };

  // ── Computed ──────────────────────────────────────────────────
  const totalIn  = transactions.filter(t => t.type === 'IN').reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalOut = transactions.filter(t => t.type === 'OUT').reduce((s, t) => s + Number(t.amount || 0), 0);
  const balance  = totalIn - totalOut;

  const filtered = transactions.filter(tx => {
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    if (filterCategory !== 'ALL' && tx.category !== filterCategory) return false;
    if (searchQ && !tx.description?.toLowerCase().includes(searchQ.toLowerCase()) && !tx.category?.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  // ── Loading / Auth guards ─────────────────────────────────────
  if (authChecking) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-lg animate-pulse">Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white/10 border border-white/20 rounded-2xl p-8 text-center max-w-sm w-full">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-white font-bold text-xl mb-2">Access Restricted</h2>
        <p className="text-blue-300 text-sm mb-6">You must be logged in as an admin to access the financial module.</p>
        <Link href="/login" className="px-6 py-2.5 bg-yellow-400 text-blue-900 font-bold rounded-xl hover:bg-yellow-300 transition-all">
          Go to Login
        </Link>
      </div>
    </div>
  );

  // ── Password Gate ─────────────────────────────────────────────
  if (!passwordVerified) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <Toast toast={toast} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">💰</div>
          <h1 className="text-white font-black text-2xl">Financial Module</h1>
          <p className="text-blue-300 text-sm mt-1">TSOK Financial Management</p>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-blue-300 text-xs font-semibold mb-1 block">FINANCIAL PASSWORD</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                placeholder="Enter financial password"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm pr-12"
              />
              <button type="button" onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white text-lg">
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {passwordError && <p className="text-red-400 text-xs mt-1.5">{passwordError}</p>}
          </div>
          <button onClick={handlePasswordSubmit}
            className="w-full py-3 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all">
            🔓 Access Financial Records
          </button>
          <Link href="/admin" className="block text-center text-blue-400 text-sm hover:text-blue-200 transition-colors">
            ← Back to Admin Panel
          </Link>
        </div>
      </motion.div>
    </div>
  );

  // ── Main Financial UI ─────────────────────────────────────────
  const categories = [...CATEGORIES_IN, ...CATEGORIES_OUT];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900">
      <Toast toast={toast} />

      {/* Header */}
      <div className="bg-blue-950/80 backdrop-blur border-b border-white/10 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h1 className="text-white font-black text-lg leading-none">TSOK Financial</h1>
              <p className="text-blue-400 text-xs">Management System</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-300 text-xs hidden sm:block">{userProfile?.fullName || user.email}</span>
            <Link href="/admin" className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all">
              ← Admin
            </Link>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
            className="bg-green-500/20 border border-green-400/30 rounded-2xl p-4 text-center">
            <p className="text-green-300 text-xs font-semibold uppercase tracking-wide mb-1">Total IN</p>
            <p className="text-green-300 font-black text-xl leading-none">₱{fmt(totalIn)}</p>
            <p className="text-green-400/70 text-xs mt-1">{transactions.filter(t=>t.type==='IN').length} entries</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-red-500/20 border border-red-400/30 rounded-2xl p-4 text-center">
            <p className="text-red-300 text-xs font-semibold uppercase tracking-wide mb-1">Total OUT</p>
            <p className="text-red-300 font-black text-xl leading-none">₱{fmt(totalOut)}</p>
            <p className="text-red-400/70 text-xs mt-1">{transactions.filter(t=>t.type==='OUT').length} entries</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`${balance >= 0 ? 'bg-yellow-400/20 border-yellow-400/30' : 'bg-red-600/20 border-red-500/30'} border rounded-2xl p-4 text-center`}>
            <p className={`${balance >= 0 ? 'text-yellow-300' : 'text-red-300'} text-xs font-semibold uppercase tracking-wide mb-1`}>Balance</p>
            <p className={`${balance >= 0 ? 'text-yellow-300' : 'text-red-300'} font-black text-xl leading-none`}>₱{fmt(balance)}</p>
            <p className={`${balance >= 0 ? 'text-yellow-400/70' : 'text-red-400/70'} text-xs mt-1`}>{balance >= 0 ? '✅ Positive' : '⚠️ Negative'}</p>
          </motion.div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button onClick={() => openAdd('IN')}
            className="flex-1 py-3 bg-green-500 hover:bg-green-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg">
            <span className="text-xl">➕</span> Add Income
          </button>
          <button onClick={() => openAdd('OUT')}
            className="flex-1 py-3 bg-red-500 hover:bg-red-400 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg">
            <span className="text-xl">➖</span> Add Expense
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[['dashboard','📊 Overview'], ['transactions','📋 Transactions'], ['logs','📜 Activity Log']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${activeTab === id ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD TAB ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Category breakdown IN */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">📥 Income by Category</h3>
              <div className="space-y-2">
                {CATEGORIES_IN.map(cat => {
                  const total = transactions.filter(t => t.type === 'IN' && t.category === cat).reduce((s, t) => s + Number(t.amount || 0), 0);
                  if (!total) return null;
                  const pct = totalIn > 0 ? (total / totalIn * 100).toFixed(1) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-blue-200">{cat}</span>
                        <span className="text-green-300 font-semibold">₱{fmt(total)} <span className="text-blue-400 text-xs">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {transactions.filter(t => t.type === 'IN').length === 0 && <p className="text-blue-400 text-sm text-center py-2">No income records yet</p>}
              </div>
            </div>
            {/* Category breakdown OUT */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">📤 Expenses by Category</h3>
              <div className="space-y-2">
                {CATEGORIES_OUT.map(cat => {
                  const total = transactions.filter(t => t.type === 'OUT' && t.category === cat).reduce((s, t) => s + Number(t.amount || 0), 0);
                  if (!total) return null;
                  const pct = totalOut > 0 ? (total / totalOut * 100).toFixed(1) : 0;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-blue-200">{cat}</span>
                        <span className="text-red-300 font-semibold">₱{fmt(total)} <span className="text-blue-400 text-xs">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {transactions.filter(t => t.type === 'OUT').length === 0 && <p className="text-blue-400 text-sm text-center py-2">No expense records yet</p>}
              </div>
            </div>
            {/* Recent */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-5">
              <h3 className="text-white font-bold mb-4">🕐 Recent Transactions</h3>
              <div className="space-y-2">
                {transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${tx.type === 'IN' ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
                        {tx.type === 'IN' ? '↑' : '↓'}
                      </span>
                      <div>
                        <p className="text-white text-sm font-semibold">{tx.description}</p>
                        <p className="text-blue-400 text-xs">{tx.category} · {fmtDateShort(tx.date && {seconds: new Date(tx.date).getTime()/1000})}</p>
                      </div>
                    </div>
                    <span className={`font-bold text-sm ${tx.type === 'IN' ? 'text-green-300' : 'text-red-300'}`}>
                      {tx.type === 'IN' ? '+' : '-'}₱{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
                {transactions.length === 0 && <p className="text-blue-400 text-sm text-center py-4">No transactions yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── TRANSACTIONS TAB ── */}
        {activeTab === 'transactions' && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="🔍 Search..."
                className="flex-1 min-w-[150px] px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none">
                <option value="ALL">All Types</option>
                <option value="IN">Income Only</option>
                <option value="OUT">Expense Only</option>
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none">
                <option value="ALL">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <p className="text-blue-400 text-xs mb-3">{filtered.length} of {transactions.length} records</p>
            <div className="space-y-2">
              {filtered.map((tx, i) => (
                <motion.div key={tx.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  className={`bg-white/10 border rounded-2xl p-4 ${tx.type === 'IN' ? 'border-green-400/20' : 'border-red-400/20'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${tx.type === 'IN' ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'}`}>
                        {tx.type === 'IN' ? '↑' : '↓'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{tx.description}</p>
                        <p className="text-blue-400 text-xs">{tx.category}</p>
                        {tx.notes && <p className="text-blue-300 text-xs mt-0.5 italic">{tx.notes}</p>}
                        <p className="text-blue-500 text-xs mt-1">
                          {tx.date} · by {tx.createdByName || tx.createdBy || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <span className={`font-black text-lg ${tx.type === 'IN' ? 'text-green-300' : 'text-red-300'}`}>
                        {tx.type === 'IN' ? '+' : '-'}₱{fmt(tx.amount)}
                      </span>
                      <div className="flex gap-1.5">
                        <button onClick={() => openEdit(tx)}
                          className="px-2.5 py-1 bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-300 rounded-lg text-xs font-semibold">✏️</button>
                        <button onClick={() => handleDelete(tx)}
                          className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-300 rounded-lg text-xs font-semibold">🗑️</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-blue-400">
                  <p className="text-4xl mb-2">📋</p>
                  <p>No transactions found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ACTIVITY LOG TAB ── */}
        {activeTab === 'logs' && (
          <div>
            <p className="text-blue-400 text-xs mb-3">{activityLogs.length} log entries</p>
            <div className="space-y-2">
              {activityLogs.map((log, i) => {
                const actionColor = log.action === 'ADD' ? 'text-green-300 bg-green-500/20' : log.action === 'DELETE' ? 'text-red-300 bg-red-500/20' : log.action === 'EDIT' ? 'text-yellow-300 bg-yellow-500/20' : 'text-blue-300 bg-blue-500/20';
                return (
                  <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                    className="bg-white/10 border border-white/10 rounded-xl p-3 flex items-start gap-3">
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-lg text-xs font-bold ${actionColor}`}>{log.action}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{log.details}</p>
                      <p className="text-blue-400 text-xs mt-0.5">
                        👤 {log.userName || log.userEmail} · {fmtDate(log.createdAt)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
              {activityLogs.length === 0 && (
                <div className="text-center py-12 text-blue-400">
                  <p className="text-4xl mb-2">📜</p>
                  <p>No activity logs yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── ADD / EDIT FORM MODAL ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeForm}>
            <motion.div initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              className="bg-blue-950 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <h2 className={`text-xl font-black mb-5 flex items-center gap-2 ${formType === 'IN' ? 'text-green-300' : 'text-red-300'}`}>
                {editingId ? '✏️ Edit' : '➕ New'} {formType === 'IN' ? '📥 Income' : '📤 Expense'}
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-blue-300 text-xs font-semibold mb-1 block">DESCRIPTION *</label>
                  <input value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                    placeholder="e.g. Monthly dues collection"
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-blue-300 text-xs font-semibold mb-1 block">AMOUNT (₱) *</label>
                    <input type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))}
                      placeholder="0.00" min="0" step="0.01"
                      className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
                  </div>
                  <div>
                    <label className="text-blue-300 text-xs font-semibold mb-1 block">DATE *</label>
                    <input type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))}
                      className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-blue-300 text-xs font-semibold mb-1 block">CATEGORY</label>
                  <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                    className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm">
                    {(formType === 'IN' ? CATEGORIES_IN : CATEGORIES_OUT).map(c => (
                      <option key={c} value={c} className="bg-blue-900">{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-blue-300 text-xs font-semibold mb-1 block">NOTES (optional)</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                    placeholder="Additional details..."
                    rows={2} className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 text-sm resize-none" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={handleSave} disabled={saving}
                  className={`flex-1 py-2.5 font-bold rounded-xl text-sm transition-all disabled:opacity-60 ${formType === 'IN' ? 'bg-green-500 hover:bg-green-400 text-white' : 'bg-red-500 hover:bg-red-400 text-white'}`}>
                  {saving ? 'Saving...' : editingId ? '💾 Update' : '💾 Save'}
                </button>
                <button onClick={closeForm}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm transition-all">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
