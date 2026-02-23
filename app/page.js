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

  useEffect(() => {
    const wq = query(collection(db, 'websites'), orderBy('order', 'asc'));
    getDocs(wq).then(s => { setWebsites(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }).catch(() => setLoading(false));
    const pq = query(collection(db, 'landingPosts'), orderBy('createdAt', 'desc'));
    const unsubP = onSnapshot(pq, s => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    const sq = query(collection(db, 'sponsors'), orderBy('order', 'asc'));
    const unsubS = onSnapshot(sq, s => setSponsors(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    const aq = query(collection(db, 'activities'), orderBy('date', 'asc'));
    const unsubA = onSnapshot(aq, s => setActivities(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => { unsubP(); unsubS(); unsubA(); };
  }, []);

  const filteredWebsites = websites.filter(site => {
    const matchesSearch = (site.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (site.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || site.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(websites.map(s => s.category).filter(Boolean))];
  const isUpcoming = (d) => d && new Date(d) >= new Date();
  const fmtDate = (ts) => ts ? new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950">
      {/* Animated BG */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* ── HEADER ── */}
      <motion.header initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, type: 'spring' }}
        className="relative z-20 bg-white/10 backdrop-blur-lg border-b border-white/20 sticky top-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-3">
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 7 }}>
                <Image src="/tsok-logo.png" alt="TSOK" width={44} height={44} className="drop-shadow-xl" />
              </motion.div>
              <div>
                <h1 className="text-lg font-bold text-white leading-none">TSOK Portal</h1>
                <p className="text-blue-200 text-xs">Teachers-Specialists Organization Kuwait</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link href="/feed" className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-lg transition-all text-xs shadow-lg">
                    👥 <span className="hidden sm:inline">Community</span>
                  </Link>
                  <button onClick={logout} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-xs">Logout</button>
                </>
              ) : (
                <>
                  <Link href="/login" className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all text-xs">Login</Link>
                  <Link href="/register" className="px-3 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-lg transition-all text-xs shadow-lg">Join TSOK</Link>
                </>
              )}
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input type="text" placeholder="Search TSOK websites..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all text-sm" />
          </div>
        </div>
      </motion.header>

      <main className="relative z-10 container mx-auto px-4 py-6 space-y-10">

        {/* ── CATEGORY FILTERS ── */}
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full font-semibold text-xs transition-all ${
                selectedCategory === cat ? 'bg-yellow-400 text-blue-900' : 'bg-white/10 text-white hover:bg-white/20'
              }`}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* ── WEBSITES GRID — compact cards ── */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {filteredWebsites.map((site, i) => (
              <motion.a key={site.id} href={site.url} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.07, y: -2 }}
                className={`relative flex flex-col items-center text-center rounded-2xl border border-white/20 shadow-md group p-3 w-[90px] ${site.style || 'bg-white/10'}`}>
                {site.isNew && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full z-10 animate-pulse">NEW</span>
                )}
                <div className="w-11 h-11 mb-1.5 flex items-center justify-center">
                  <Image src={site.icon || '/icon-192.png'} alt={site.title} width={44} height={44} className="object-contain drop-shadow" />
                </div>
                <h3 className="text-white text-[11px] font-semibold leading-tight line-clamp-2">{site.title}</h3>
              </motion.a>
            ))}
            {filteredWebsites.length === 0 && (
              <div className="col-span-full text-center py-12">
                <div className="text-4xl mb-2">🔍</div>
                <p className="text-white font-bold">No websites found</p>
              </div>
            )}
          </div>
        )}

        {/* ── NEWS & UPDATES — Al Jazeera style ── */}
        {posts.length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2 border-b border-white/20 pb-2">
              📣 News & Updates
            </h2>
            {/* Featured post — big on top */}
            {posts[0] && (
              <div className="mb-4 cursor-pointer group" onClick={() => setActivePost(posts[0])}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-0 rounded-2xl overflow-hidden border border-white/20 bg-white/10 backdrop-blur-lg shadow-xl">
                  {/* Media */}
                  <div className="md:col-span-3 relative">
                    {posts[0].videoUrl ? (
                      <div className="relative aspect-video md:aspect-auto md:h-full bg-black/30">
                        <video src={posts[0].videoUrl}
                          poster={posts[0].videoUrl.replace('/upload/', '/upload/so_0,q_60,w_800/').replace(/\.[^.]+$/, '.jpg')}
                          className="w-full h-full object-cover" muted playsInline preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      </div>
                    ) : posts[0].imageUrl ? (
                      <div className="aspect-video md:aspect-auto md:h-full min-h-[200px] overflow-hidden">
                        <img src={posts[0].imageUrl} alt={posts[0].caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className="aspect-video md:h-full bg-gradient-to-br from-blue-700 to-blue-900 min-h-[200px]" />
                    )}
                  </div>
                  {/* Text */}
                  <div className="md:col-span-2 p-5 flex flex-col justify-center">
                    <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">Featured</span>
                    {posts[0].caption && <h3 className="text-white font-bold text-lg leading-tight mb-2">{posts[0].caption}</h3>}
                    {posts[0].description && <p className="text-blue-200 text-sm leading-relaxed line-clamp-4">{posts[0].description}</p>}
                    {posts[0].createdAt && <p className="text-blue-400 text-xs mt-3">{fmtDate(posts[0].createdAt)}</p>}
                  </div>
                </div>
              </div>
            )}
            {/* Rest of posts — horizontal list */}
            {posts.length > 1 && (
              <div className="space-y-3">
                {posts.slice(1).map((post, i) => (
                  <motion.div key={post.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex gap-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl overflow-hidden cursor-pointer group hover:bg-white/15 transition-all"
                    onClick={() => setActivePost(post)}>
                    {/* Thumbnail */}
                    <div className="flex-shrink-0 w-28 h-20 sm:w-36 sm:h-24 overflow-hidden relative">
                      {post.videoUrl ? (
                        <>
                          <video src={post.videoUrl}
                            poster={post.videoUrl.replace('/upload/', '/upload/so_0,q_60,w_800/').replace(/\.[^.]+$/, '.jpg')}
                            className="w-full h-full object-cover" muted playsInline preload="metadata" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </>
                      ) : post.imageUrl ? (
                        <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center text-2xl">📣</div>
                      )}
                    </div>
                    {/* Text */}
                    <div className="flex-1 min-w-0 py-2 pr-3 flex flex-col justify-center">
                      {post.caption && <h3 className="text-white font-semibold text-sm leading-tight mb-1 line-clamp-2">{post.caption}</h3>}
                      {post.description && <p className="text-blue-200 text-xs line-clamp-2 leading-relaxed">{post.description}</p>}
                      {post.createdAt && <p className="text-blue-400 text-xs mt-1">{fmtDate(post.createdAt)}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── UPCOMING ACTIVITIES ── */}
        {activities.filter(a => isUpcoming(a.date)).length > 0 && (
          <section>
            <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2 border-b border-white/20 pb-2">
              📅 Upcoming Activities
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {activities.filter(a => isUpcoming(a.date)).map((act, i) => (
                <motion.div key={act.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-3 flex gap-3 items-start shadow-lg">
                  <div className="flex-shrink-0 text-center bg-yellow-400 text-blue-900 rounded-lg px-2.5 py-1.5 min-w-[46px]">
                    <p className="text-xs font-bold uppercase leading-none">{new Date(act.date).toLocaleDateString('en-US', { month: 'short' })}</p>
                    <p className="text-xl font-black leading-none">{new Date(act.date).getDate()}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-bold text-sm leading-tight mb-0.5">{act.title}</h3>
                    {act.location && <p className="text-blue-300 text-xs">📍 {act.location}</p>}
                    {act.description && <p className="text-blue-200 text-xs line-clamp-2 mt-0.5">{act.description}</p>}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── SPONSORS ── */}
        {sponsors.length > 0 && (
          <section className="pb-4">
            <h2 className="text-white font-bold text-xl mb-4 text-center border-b border-white/20 pb-2">🤝 Our Sponsors & Partners</h2>
            <div className="flex flex-wrap justify-center items-center gap-4">
              {sponsors.map((sp, i) => (
                <motion.div key={sp.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }} whileHover={{ scale: 1.06 }}>
                  {sp.link ? (
                    <a href={sp.link} target="_blank" rel="noopener noreferrer">
                      <div className="bg-white/10 border border-white/20 rounded-xl p-3 flex flex-col items-center gap-1.5 w-28 h-24 justify-center hover:bg-white/20 transition-all">
                        {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-10 max-w-[64px] object-contain" />}
                        {sp.name && <p className="text-white text-xs font-semibold text-center leading-tight">{sp.name}</p>}
                      </div>
                    </a>
                  ) : (
                    <div className="bg-white/10 border border-white/20 rounded-xl p-3 flex flex-col items-center gap-1.5 w-28 h-24 justify-center">
                      {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-10 max-w-[64px] object-contain" />}
                      {sp.name && <p className="text-white text-xs font-semibold text-center leading-tight">{sp.name}</p>}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ── POST MODAL ── */}
      <AnimatePresence>
        {activePost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setActivePost(null)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-blue-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
              onClick={e => e.stopPropagation()}>
              {activePost.videoUrl ? (
                <video src={activePost.videoUrl} controls playsInline autoPlay className="w-full" />
              ) : activePost.imageUrl ? (
                <img src={activePost.imageUrl} alt={activePost.caption} className="w-full object-contain" />
              ) : null}
              <div className="p-5">
                {activePost.caption && <h2 className="text-white font-bold text-xl mb-2">{activePost.caption}</h2>}
                {activePost.description && <p className="text-blue-200 text-sm leading-relaxed">{activePost.description}</p>}
                {activePost.createdAt && <p className="text-blue-400 text-xs mt-3">{fmtDate(activePost.createdAt)}</p>}
              </div>
              <button onClick={() => setActivePost(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-all text-sm">✕</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 mt-12 bg-white/5 backdrop-blur-lg border-t border-white/10">
        <div className="container mx-auto px-4 py-6 text-center text-blue-200">
          <p className="mb-1 text-sm">© 2026 TSOK - Teachers-Specialists Organization Kuwait</p>
          <p className="text-xs">Developed by <span className="text-yellow-400 font-semibold">Godmisoft</span></p>
        </div>
      </footer>
    </div>
  );
}
