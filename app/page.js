'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
  const { user, logout } = useAuth();
  const [websites, setWebsites] = useState([]);
  const [posts, setPosts] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activePost, setActivePost] = useState(null);
  const videoRefs = useRef({});

  useEffect(() => {
    // Websites
    const wq = query(collection(db, 'websites'), orderBy('order', 'asc'));
    getDocs(wq).then(s => setWebsites(s.docs.map(d => ({ id: d.id, ...d.data() })))).catch(() => {});

    // Landing posts
    const pq = query(collection(db, 'landingPosts'), orderBy('createdAt', 'desc'));
    const unsubP = onSnapshot(pq, s => { setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });

    // Sponsors
    const sq = query(collection(db, 'sponsors'), orderBy('order', 'asc'));
    const unsubS = onSnapshot(sq, s => setSponsors(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Activities
    const aq = query(collection(db, 'activities'), orderBy('date', 'asc'));
    const unsubA = onSnapshot(aq, s => setActivities(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    setLoading(false);
    return () => { unsubP(); unsubS(); unsubA(); };
  }, []);

  const filteredWebsites = websites.filter(site => {
    const matchesSearch = (site.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (site.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || site.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(websites.map(s => s.category).filter(Boolean))];

  // Format activity date
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isUpcoming = (dateStr) => dateStr && new Date(dateStr) >= new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950">
      {/* Animated BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* ── HEADER ── */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: 'spring' }}
        className="relative z-20 bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0"
      >
        <div className="container mx-auto px-4 py-4">
          {/* Top row: logo + auth */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 }}>
                <Image src="/tsok-logo.png" alt="TSOK" width={52} height={52} className="drop-shadow-2xl" />
              </motion.div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white leading-none">TSOK Portal</h1>
                <p className="text-blue-200 text-xs">Teachers-Specialists Organization Kuwait</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link href="/feed" className="flex items-center gap-1.5 px-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all text-sm shadow-lg">
                    👥 <span className="hidden sm:inline">Community</span>
                  </Link>
                  <button onClick={logout} className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-sm">
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-sm">Login</Link>
                  <Link href="/register" className="px-3 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all text-sm shadow-lg">Join TSOK</Link>
                </>
              )}
            </div>
          </div>

          {/* Search bar — always visible on top */}
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Search TSOK websites..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm"
            />
          </div>
        </div>
      </motion.header>

      <main className="relative z-10 container mx-auto px-4 py-8 space-y-12">

        {/* ── CATEGORY FILTERS ── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full font-semibold text-sm transition-all ${
                selectedCategory === cat ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </motion.div>

        {/* ── WEBSITES GRID ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWebsites.map((site, i) => (
              <motion.a key={site.id} href={site.url} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                whileHover={{ scale: 1.03, y: -4 }}
                className={`block relative overflow-hidden rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl group ${site.style || 'bg-gradient-to-br from-white/10 to-white/5'}`}>
                <div className="p-6 flex flex-col items-center text-center">
                  <div className="w-20 h-20 mb-4 flex items-center justify-center">
                    <Image src={site.icon || '/icon-192.png'} alt={site.title} width={80} height={80} className="object-contain drop-shadow-lg" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{site.title}</h3>
                  <p className="text-blue-200 text-sm mb-3">{site.description}</p>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <span className="px-2.5 py-0.5 bg-yellow-400 text-blue-900 text-xs font-semibold rounded-full">{site.category}</span>
                    {site.isNew && <span className="px-2.5 py-0.5 bg-red-500 text-white text-xs font-semibold rounded-full animate-pulse">NEW</span>}
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </motion.a>
            ))}
            {filteredWebsites.length === 0 && !loading && (
              <div className="col-span-full text-center py-16">
                <div className="text-5xl mb-3">🔍</div>
                <p className="text-white font-bold text-xl mb-1">No websites found</p>
                <p className="text-blue-200 text-sm">Try adjusting your search or filter</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── ADMIN POSTS (News & Updates) ── */}
        {posts.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-2xl mb-6 flex items-center gap-2">
              📣 <span>News & Updates</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <motion.div key={post.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl overflow-hidden shadow-xl group cursor-pointer"
                  onClick={() => setActivePost(post)}>
                  {/* Image or Video thumbnail */}
                  {post.videoUrl ? (
                    <div className="relative w-full aspect-video bg-black/30">
                      <video
                        src={post.videoUrl}
                        poster={post.videoUrl.replace('/upload/', '/upload/so_0,q_60,w_800/').replace(/\.[^.]+$/, '.jpg')}
                        className="w-full h-full object-cover"
                        muted playsInline preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      </div>
                    </div>
                  ) : post.imageUrl ? (
                    <div className="w-full aspect-video bg-black/20 overflow-hidden">
                      <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : null}
                  <div className="p-4">
                    {post.caption && <h3 className="text-white font-bold text-base mb-1 line-clamp-2">{post.caption}</h3>}
                    {post.description && <p className="text-blue-200 text-sm line-clamp-3">{post.description}</p>}
                    {post.createdAt && (
                      <p className="text-blue-400 text-xs mt-2">
                        {new Date(post.createdAt.seconds ? post.createdAt.seconds * 1000 : post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── UPCOMING ACTIVITIES ── */}
        {activities.filter(a => isUpcoming(a.date)).length > 0 && (
          <section>
            <h2 className="text-white font-bold text-2xl mb-6 flex items-center gap-2">
              📅 <span>Upcoming Activities</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.filter(a => isUpcoming(a.date)).map((act, i) => (
                <motion.div key={act.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                  className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 flex gap-4 items-start shadow-lg">
                  {/* Date badge */}
                  <div className="flex-shrink-0 text-center bg-yellow-400 text-blue-900 rounded-xl px-3 py-2 min-w-[52px]">
                    <p className="text-xs font-bold uppercase leading-none">{new Date(act.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                    <p className="text-2xl font-black leading-none">{new Date(act.date).getDate()}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm leading-tight mb-0.5">{act.title}</h3>
                    {act.location && <p className="text-blue-300 text-xs mb-0.5">📍 {act.location}</p>}
                    {act.description && <p className="text-blue-200 text-xs line-clamp-2">{act.description}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── SPONSORS ── */}
        {sponsors.length > 0 && (
          <section className="pb-4">
            <h2 className="text-white font-bold text-xl mb-5 text-center">🤝 Our Sponsors & Partners</h2>
            <div className="flex flex-wrap justify-center items-center gap-6">
              {sponsors.map((sp, i) => (
                <motion.div key={sp.id}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}
                  whileHover={{ scale: 1.08 }}>
                  {sp.link ? (
                    <a href={sp.link} target="_blank" rel="noopener noreferrer">
                      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 w-36 h-28 justify-center hover:bg-white/20 transition-all">
                        {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-12 max-w-[80px] object-contain" />}
                        {sp.name && <p className="text-white text-xs font-semibold text-center">{sp.name}</p>}
                      </div>
                    </a>
                  ) : (
                    <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 flex flex-col items-center gap-2 w-36 h-28 justify-center">
                      {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-12 max-w-[80px] object-contain" />}
                      {sp.name && <p className="text-white text-xs font-semibold text-center">{sp.name}</p>}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── POST MODAL (full view) ── */}
      <AnimatePresence>
        {activePost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setActivePost(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-blue-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              {activePost.videoUrl ? (
                <video src={activePost.videoUrl} controls playsInline className="w-full" />
              ) : activePost.imageUrl ? (
                <img src={activePost.imageUrl} alt={activePost.caption} className="w-full object-contain" />
              ) : null}
              <div className="p-5">
                {activePost.caption && <h2 className="text-white font-bold text-xl mb-2">{activePost.caption}</h2>}
                {activePost.description && <p className="text-blue-200 text-sm leading-relaxed">{activePost.description}</p>}
              </div>
              <button onClick={() => setActivePost(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-all">✕</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 mt-16 bg-white/5 backdrop-blur-lg border-t border-white/10">
        <div className="container mx-auto px-4 py-8 text-center text-blue-200">
          <p className="mb-1">© 2026 TSOK - Teachers-Specialists Organization Kuwait</p>
          <p className="text-xs">Developed by <span className="text-yellow-400 font-semibold">Godmisoft</span></p>
        </div>
      </footer>
    </div>
  );
}
