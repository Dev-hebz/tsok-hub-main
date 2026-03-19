'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

// ── HELPERS ──────────────────────────────────────────────────────
const fmtDate = (ts) => ts
  ? new Date(ts.seconds ? ts.seconds * 1000 : ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : '';
const isUpcoming = (d) => d && new Date(d) >= new Date();

// ── ANIMATED COUNTER ─────────────────────────────────────────────
function Counter({ to, suffix = '' }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(to / 40);
    const t = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(t); }
      else setCount(start);
    }, 30);
    return () => clearInterval(t);
  }, [to]);
  return <span>{count}{suffix}</span>;
}

// ── FLOATING PARTICLES ────────────────────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i, x: (i * 17 + 11) % 97, y: (i * 23 + 7) % 93,
  size: (i % 3) + 1.5, duration: (i % 5) + 7, delay: (i % 4) * 1.2,
}));

function Particles() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {PARTICLES.map(p => (
        <motion.div key={p.id}
          className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: 'rgba(240,180,41,0.25)' }}
          animate={{ y: [-18, 18, -18], opacity: [0.1, 0.6, 0.1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ── GALLERY VIEWER ────────────────────────────────────────────────
function GalleryViewer({ images }) {
  const [idx, setIdx] = useState(0);
  const prev = (e) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); };
  const next = (e) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); };
  return (
    <div className="relative w-full bg-black flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.img key={idx} src={images[idx]} alt={`photo-${idx + 1}`}
          initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }} className="w-full object-contain max-h-[60vh]" />
      </AnimatePresence>
      {images.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-xl z-10 transition-all backdrop-blur"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,180,41,0.8)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}>‹</button>
          <button onClick={next} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center text-xl z-10 transition-all backdrop-blur"
            style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(240,180,41,0.8)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}>›</button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, i) => (
              <button key={i} onClick={e => { e.stopPropagation(); setIdx(i); }}
                className="rounded-full transition-all duration-300"
                style={{ width: i === idx ? 18 : 8, height: 8, background: i === idx ? '#f0b429' : 'rgba(255,255,255,0.4)' }} />
            ))}
          </div>
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold z-10 backdrop-blur"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#f0b429' }}>{idx + 1} / {images.length}</span>
        </>
      )}
    </div>
  );
}

// ── SECTION HEADING ───────────────────────────────────────────────
function SectionHeading({ icon, title, subtitle }) {
  return (
    <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }} transition={{ duration: 0.5 }} className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl">{icon}</span>
        <h2 style={{ fontFamily: '\'Playfair Display\', serif' }}
          className="text-2xl md:text-3xl font-black text-white">{title}</h2>
      </div>
      {subtitle && <p className="text-sm ml-10" style={{ color: 'rgba(240,180,41,0.6)' }}>{subtitle}</p>}
      <div className="mt-3 ml-10 h-px" style={{ background: 'linear-gradient(90deg, rgba(240,180,41,0.5), rgba(240,180,41,0.15), transparent)' }} />
    </motion.div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    getDocs(query(collection(db, 'websites'), orderBy('order', 'asc')))
      .then(s => { setWebsites(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); })
      .catch(() => setLoading(false));
    const unsubP = onSnapshot(query(collection(db, 'landingPosts'), orderBy('createdAt', 'desc')), s => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    const unsubS = onSnapshot(query(collection(db, 'sponsors'), orderBy('order', 'asc')), s => setSponsors(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    const unsubA = onSnapshot(query(collection(db, 'activities'), orderBy('date', 'asc')), s => setActivities(s.docs.map(d => ({ id: d.id, ...d.data() }))), () => {});
    return () => { unsubP(); unsubS(); unsubA(); };
  }, []);

  const filteredWebsites = websites.filter(s => {
    const q = searchQuery.toLowerCase();
    return (selectedCategory === 'all' || s.category === selectedCategory) &&
      ((s.title || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q));
  });
  const categories = ['all', ...new Set(websites.map(s => s.category).filter(Boolean))];
  const upcomingActivities = activities.filter(a => isUpcoming(a.date));

  const tickerItems = [
    '🌟 Welcome to TSOK Hub', '📚 Empowering Filipino Teachers in Kuwait',
    '🤝 Building Community Together', '📅 Check our Upcoming Activities',
    '🏆 TSOK — Excellence in Education', '💼 Professional Development & Growth',
  ];

  return (
    <div className="min-h-screen relative" style={{ background: '#050d1f' }}>
      <Particles />

      {/* Grid mesh background */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.025, backgroundImage: 'linear-gradient(rgba(240,180,41,1) 1px, transparent 1px), linear-gradient(90deg, rgba(240,180,41,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Ambient glow orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div animate={{ x: [0, 60, 0], y: [0, -40, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(240,180,41,0.18) 0%, transparent 70%)' }} />
        <motion.div animate={{ x: [0, -50, 0], y: [0, 50, 0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(30,64,174,0.2) 0%, transparent 70%)' }} />
      </div>

      {/* ── TICKER ── */}
      <div className="relative z-30 overflow-hidden py-1.5" style={{ background: 'rgba(10,22,40,0.95)', borderBottom: '1px solid rgba(240,180,41,0.18)' }}>
        <div className="flex items-center">
          <div className="flex-shrink-0 px-4 py-1 text-xs font-black tracking-widest uppercase mr-4 z-10"
            style={{ background: '#f59e0b', color: '#050d1f' }}>TSOK</div>
          <div className="overflow-hidden flex-1">
            <div className="animate-marquee inline-block whitespace-nowrap">
              {[...tickerItems, ...tickerItems].map((item, i) => (
                <span key={i} className="inline-block mx-12 text-sm font-medium" style={{ color: 'rgba(253,230,138,0.75)' }}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── HEADER ── */}
      <motion.header initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, type: 'spring', stiffness: 90 }}
        className="sticky top-0 z-20 transition-all duration-500"
        style={{ background: scrolled ? 'rgba(5,13,31,0.98)' : 'rgba(5,13,31,0.82)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(240,180,41,0.12)', boxShadow: scrolled ? '0 4px 40px rgba(0,0,0,0.5)' : 'none' }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="relative">
                <div className="absolute inset-0 rounded-full" style={{ boxShadow: '0 0 20px rgba(240,180,41,0.35)' }} />
                <Image src="/tsok-logo.png" alt="TSOK" width={46} height={46} className="relative drop-shadow-xl" />
              </motion.div>
              <div>
                <h1 className="font-black text-xl leading-none" style={{ fontFamily: '\'Playfair Display\', serif', background: 'linear-gradient(135deg, #f59e0b, #fcd34d, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TSOK Hub</h1>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(240,180,41,0.45)' }}>Teachers-Specialists Org. Kuwait</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link href="/feed"
                    className="flex items-center gap-1.5 px-4 py-2 font-bold rounded-xl text-xs transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#050d1f', boxShadow: '0 4px 15px rgba(240,180,41,0.25)' }}>
                    👥 <span className="hidden sm:inline">Community</span>
                  </Link>
                  <button onClick={logout} className="px-3 py-2 text-xs rounded-xl transition-all"
                    style={{ color: 'rgba(240,180,41,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.3)'; e.currentTarget.style.color = '#fcd34d'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(240,180,41,0.6)'; }}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="px-4 py-2 text-xs font-semibold rounded-xl transition-all"
                    style={{ color: '#fcd34d', border: '1px solid rgba(240,180,41,0.25)', background: 'rgba(240,180,41,0.05)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.5)'; e.currentTarget.style.background = 'rgba(240,180,41,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.25)'; e.currentTarget.style.background = 'rgba(240,180,41,0.05)'; }}>
                    Login
                  </Link>
                  <Link href="/register" className="px-4 py-2 font-black text-xs rounded-xl transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#050d1f', boxShadow: '0 4px 15px rgba(240,180,41,0.25)' }}>
                    Join TSOK ✦
                  </Link>
                </>
              )}
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(240,180,41,0.5)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search TSOK websites & apps..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(240,180,41,0.12)', color: '#fff', '::placeholder': { color: 'rgba(240,180,41,0.4)' } }}
              onFocus={e => e.target.style.borderColor = 'rgba(240,180,41,0.45)'}
              onBlur={e => e.target.style.borderColor = 'rgba(240,180,41,0.12)'} />
          </div>
        </div>
      </motion.header>

      {/* ── HERO ── */}
      <section className="relative z-10 py-16 md:py-24 px-4 text-center overflow-hidden">
        <div className="container mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}>
            <span className="inline-block px-5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-7"
              style={{ background: 'rgba(240,180,41,0.1)', border: '1px solid rgba(240,180,41,0.28)', color: '#f59e0b' }}>
              ✦ Your Gateway to TSOK Resources ✦
            </span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9 }}
            className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight"
            style={{ fontFamily: '\'Playfair Display\', serif' }}>
            <span className="text-white">Empowering</span>{' '}
            <span className="animate-shimmer">Filipino Teachers</span>
            <br />
            <span className="text-white">Across </span>
            <span style={{ background: 'linear-gradient(135deg, #f59e0b, #fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Kuwait</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'rgba(226,238,255,0.65)' }}>
            Access all TSOK tools, resources, and community features in one powerful hub.
            Built for Filipino educators making a difference in Kuwait.
          </motion.p>
          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7 }}
            className="flex flex-wrap justify-center gap-10 mb-10">
            {[{ label: 'Member Websites', value: Math.max(websites.length, 12), suffix: '+' },
              { label: 'Active Members', value: 200, suffix: '+' },
              { label: 'Years of Service', value: 10, suffix: '+' }].map(({ label, value, suffix }) => (
              <div key={label} className="text-center">
                <p className="text-3xl md:text-4xl font-black"
                  style={{ fontFamily: '\'Playfair Display\', serif', background: 'linear-gradient(135deg, #f59e0b, #fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  <Counter to={value} suffix={suffix} />
                </p>
                <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: 'rgba(240,180,41,0.45)' }}>{label}</p>
              </div>
            ))}
          </motion.div>
          {!user && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.75 }} className="flex flex-wrap gap-4 justify-center">
              <Link href="/register" className="px-10 py-4 font-black rounded-2xl text-sm transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#050d1f', boxShadow: '0 8px 32px rgba(240,180,41,0.3)' }}>
                Become a Member →
              </Link>
              <Link href="/login" className="px-10 py-4 font-bold rounded-2xl text-sm text-white transition-all hover:scale-105"
                style={{ border: '1px solid rgba(240,180,41,0.28)', background: 'rgba(240,180,41,0.06)' }}>
                Already a member? Sign In
              </Link>
            </motion.div>
          )}
        </div>
      </section>

      {/* Divider */}
      <div className="relative z-10 container mx-auto px-4">
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.4), transparent)' }} />
      </div>

      <main className="relative z-10 container mx-auto px-4 py-14 space-y-20">

        {/* ── WEBSITES ── */}
        <section>
          <SectionHeading icon="🌐" title="TSOK Websites & Apps" subtitle="Click any tile to open the resource" />
          <div className="flex flex-wrap gap-2 mb-7">
            {categories.map(cat => (
              <motion.button key={cat} whileTap={{ scale: 0.95 }} onClick={() => setSelectedCategory(cat)}
                className="px-4 py-1.5 rounded-full text-xs font-bold transition-all"
                style={selectedCategory === cat
                  ? { background: '#f59e0b', color: '#050d1f' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </motion.button>
            ))}
          </div>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(240,180,41,0.2)' }} />
                <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#f59e0b' }} />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {filteredWebsites.map((site, i) => (
                <motion.a key={site.id} href={site.url} target="_blank" rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0.85, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
                  whileHover={{ scale: 1.1, y: -6 }} whileTap={{ scale: 0.96 }}
                  className="relative flex flex-col items-center text-center group cursor-pointer rounded-2xl p-4 w-[90px] sm:w-[110px] md:w-[120px] transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(240,180,41,0.4)'; el.style.background = 'rgba(240,180,41,0.07)'; el.style.boxShadow = '0 20px 40px rgba(0,0,0,0.35), 0 0 24px rgba(240,180,41,0.1)'; }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(255,255,255,0.08)'; el.style.background = 'rgba(255,255,255,0.04)'; el.style.boxShadow = 'none'; }}>
                  {site.isNew && (
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[9px] font-black rounded-full z-10 animate-pulse"
                      style={{ background: '#dc2626', color: '#fff' }}>NEW</span>
                  )}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 mb-2 flex items-center justify-center rounded-xl overflow-hidden"
                    style={{ background: 'rgba(240,180,41,0.08)' }}>
                    <Image src={site.icon || '/icon-192.png'} alt={site.title} width={56} height={56} className="object-contain drop-shadow" />
                  </div>
                  <h3 className="text-white text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2">{site.title}</h3>
                  <span className="mt-1.5 px-2 py-0.5 text-[9px] font-bold rounded-full hidden sm:block"
                    style={{ background: 'rgba(240,180,41,0.13)', color: '#f59e0b' }}>{site.category}</span>
                </motion.a>
              ))}
              {filteredWebsites.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full text-center py-16">
                  <p className="text-5xl mb-3">🔍</p>
                  <p className="font-semibold" style={{ color: 'rgba(240,180,41,0.55)' }}>No results for "{searchQuery}"</p>
                </motion.div>
              )}
            </div>
          )}
        </section>

        {/* ── NEWS ── */}
        {posts.length > 0 && (
          <section>
            <SectionHeading icon="📣" title="News & Updates" subtitle="Latest announcements from TSOK leadership" />
            {posts[0] && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
                className="mb-5 cursor-pointer group" onClick={() => setActivePost(posts[0])}>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-0 rounded-3xl overflow-hidden shadow-2xl"
                  style={{ border: '1px solid rgba(240,180,41,0.18)', background: 'rgba(255,255,255,0.03)' }}>
                  <div className="md:col-span-3 relative bg-black/30 flex items-center justify-center overflow-hidden">
                    {posts[0].videoUrl ? (
                      <div className="relative w-full">
                        <video src={posts[0].videoUrl}
                          poster={posts[0].videoUrl.replace('/upload/', '/upload/so_0,q_60,w_800/').replace(/\.[^.]+$/, '.jpg')}
                          className="w-full object-contain" muted playsInline preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.div whileHover={{ scale: 1.1 }} className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
                            style={{ background: 'rgba(240,180,41,0.9)' }}>
                            <svg className="w-7 h-7 ml-1" style={{ color: '#050d1f' }} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                          </motion.div>
                        </div>
                      </div>
                    ) : (posts[0].imageUrls?.[0] || posts[0].imageUrl) ? (
                      <div className="relative w-full overflow-hidden">
                        <motion.img src={posts[0].imageUrls?.[0] || posts[0].imageUrl} alt={posts[0].caption}
                          whileHover={{ scale: 1.04 }} transition={{ duration: 0.5 }} className="w-full object-contain" />
                        {posts[0].imageUrls?.length > 1 && (
                          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur"
                            style={{ background: 'rgba(0,0,0,0.72)', color: '#f59e0b' }}>
                            📷 {posts[0].imageUrls.length} photos
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-56 flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #0f2040 0%, #1e3a6e 100%)' }}>
                        <span className="text-6xl opacity-25">📣</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
                      style={{ background: '#f59e0b', color: '#050d1f' }}>⭐ Featured</div>
                  </div>
                  <div className="md:col-span-2 p-6 md:p-8 flex flex-col justify-center" style={{ background: 'rgba(5,13,31,0.65)' }}>
                    {posts[0].caption && (
                      <h3 className="font-black text-xl md:text-2xl leading-tight mb-3 text-white group-hover:text-yellow-300 transition-colors"
                        style={{ fontFamily: '\'Playfair Display\', serif' }}>{posts[0].caption}</h3>
                    )}
                    {posts[0].description && <p className="text-sm leading-relaxed line-clamp-5" style={{ color: 'rgba(226,238,255,0.6)' }}>{posts[0].description}</p>}
                    {posts[0].createdAt && <p className="text-xs mt-4 font-semibold" style={{ color: 'rgba(240,180,41,0.65)' }}>📅 {fmtDate(posts[0].createdAt)}</p>}
                    <div className="mt-4 flex items-center gap-2 text-sm font-bold transition-all group-hover:gap-3" style={{ color: '#f59e0b' }}>
                      Read more <span>→</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            {posts.length > 1 && (
              <div className="space-y-3">
                {posts.slice(1).map((post, i) => {
                  const thumb = post.imageUrls?.[0] || post.imageUrl || '';
                  const photoCount = post.imageUrls?.length || (post.imageUrl ? 1 : 0);
                  return (
                    <motion.div key={post.id}
                      initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                      whileHover={{ x: 5 }}
                      className="flex gap-4 rounded-2xl overflow-hidden cursor-pointer group transition-all"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                      onClick={() => setActivePost(post)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.22)'; e.currentTarget.style.background = 'rgba(240,180,41,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                      <div className="flex-shrink-0 w-28 h-20 sm:w-36 sm:h-24 bg-black/30 overflow-hidden relative flex items-center justify-center">
                        {post.videoUrl ? (
                          <>
                            <video src={post.videoUrl} className="w-full h-full object-contain" muted playsInline preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                              <svg className="w-6 h-6" style={{ color: '#f59e0b' }} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                          </>
                        ) : thumb ? (
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            <motion.img src={thumb} alt={post.caption} whileHover={{ scale: 1.1 }} className="w-full h-full object-contain" />
                            {photoCount > 1 && <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(0,0,0,0.82)', color: '#f59e0b' }}>+{photoCount - 1}</span>}
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl opacity-25"
                            style={{ background: 'linear-gradient(135deg, #0f2040, #1e3a6e)' }}>📣</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-3 pr-4 flex flex-col justify-center">
                        {post.caption && <h3 className="text-white font-bold text-sm leading-tight mb-1 line-clamp-2 group-hover:text-yellow-300 transition-colors">{post.caption}</h3>}
                        {post.description && <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'rgba(226,238,255,0.5)' }}>{post.description}</p>}
                        {post.createdAt && <p className="text-xs mt-1.5 font-semibold" style={{ color: 'rgba(240,180,41,0.55)' }}>{fmtDate(post.createdAt)}</p>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ── ACTIVITIES ── */}
        {upcomingActivities.length > 0 && (
          <section>
            <SectionHeading icon="📅" title="Upcoming Activities" subtitle="Don't miss these TSOK events" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingActivities.map((act, i) => {
                const d = new Date(act.date);
                return (
                  <motion.div key={act.id}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                    whileHover={{ y: -6 }}
                    className="relative rounded-2xl p-5 overflow-hidden group transition-all"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.32)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-3xl opacity-8"
                      style={{ background: '#f59e0b', opacity: 0.08 }} />
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-14 text-center rounded-xl py-2 shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#050d1f' }}>
                        <p className="text-[10px] font-black uppercase leading-none">{d.toLocaleDateString('en-US', { month: 'short' })}</p>
                        <p className="text-2xl font-black leading-tight">{d.getDate()}</p>
                        <p className="text-[10px] font-bold leading-none">{d.getFullYear()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-black text-sm leading-tight mb-1.5 group-hover:text-yellow-300 transition-colors">{act.title}</h3>
                        {act.location && <p className="text-xs mb-1" style={{ color: 'rgba(240,180,41,0.7)' }}>📍 {act.location}</p>}
                        {act.description && <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'rgba(226,238,255,0.5)' }}>{act.description}</p>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── SPONSORS ── */}
        {sponsors.length > 0 && (
          <section>
            <SectionHeading icon="🤝" title="Sponsors & Partners" subtitle="Organizations supporting TSOK's mission" />
            <div className="flex flex-wrap justify-center items-center gap-4">
              {sponsors.map((sp, i) => (
                <motion.div key={sp.id}
                  initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }}
                  whileHover={{ scale: 1.08, y: -4 }}>
                  {sp.link ? (
                    <a href={sp.link} target="_blank" rel="noopener noreferrer"
                      className="rounded-2xl p-4 flex flex-col items-center gap-2 w-32 h-28 justify-center block transition-all"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(240,180,41,0.3)'; e.currentTarget.style.background = 'rgba(240,180,41,0.06)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}>
                      {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-10 max-w-[72px] object-contain" />}
                      {sp.name && <p className="text-white text-xs font-semibold text-center leading-tight">{sp.name}</p>}
                    </a>
                  ) : (
                    <div className="rounded-2xl p-4 flex flex-col items-center gap-2 w-32 h-28 justify-center"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-10 max-w-[72px] object-contain" />}
                      {sp.name && <p className="text-white text-xs font-semibold text-center leading-tight">{sp.name}</p>}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── JOIN CTA ── */}
        {!user && (
          <motion.section initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(15,32,64,0.9) 0%, rgba(10,22,40,0.95) 100%)', border: '1px solid rgba(240,180,41,0.2)' }}>
            <div className="absolute inset-0" style={{ opacity: 0.05, background: 'radial-gradient(circle at 20% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 80% 50%, #3b82f6 0%, transparent 50%)' }} />
            <div className="relative z-10">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="text-6xl mb-5">🏆</motion.div>
              <h2 className="font-black text-3xl md:text-4xl text-white mb-3" style={{ fontFamily: '\'Playfair Display\', serif' }}>
                Join the{' '}
                <span style={{ background: 'linear-gradient(135deg, #f59e0b, #fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TSOK Community</span>
              </h2>
              <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: 'rgba(226,238,255,0.6)' }}>
                Connect with fellow Filipino educators, access exclusive resources, and grow professionally in Kuwait.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/register" className="px-10 py-4 font-black rounded-2xl text-sm transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#050d1f', boxShadow: '0 8px 32px rgba(240,180,41,0.3)' }}>
                  Register Now — It's Free ✦
                </Link>
                <Link href="/login" className="px-10 py-4 font-bold rounded-2xl text-sm text-white transition-all hover:scale-105"
                  style={{ border: '1px solid rgba(240,180,41,0.28)', background: 'rgba(240,180,41,0.06)' }}>
                  Already a member? Login
                </Link>
              </div>
            </div>
          </motion.section>
        )}
      </main>

      {/* ── POST MODAL ── */}
      <AnimatePresence>
        {activePost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}
            onClick={() => setActivePost(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className="rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
              style={{ background: '#0a1628', border: '1px solid rgba(240,180,41,0.2)' }}
              onClick={e => e.stopPropagation()}>
              {activePost.videoUrl && <video src={activePost.videoUrl} controls playsInline autoPlay className="w-full" />}
              {!activePost.videoUrl && (() => {
                const imgs = activePost.imageUrls?.length ? activePost.imageUrls : activePost.imageUrl ? [activePost.imageUrl] : [];
                return imgs.length ? <GalleryViewer images={imgs} /> : null;
              })()}
              <div className="p-6">
                {activePost.caption && <h2 className="font-black text-white text-2xl mb-3" style={{ fontFamily: '\'Playfair Display\', serif' }}>{activePost.caption}</h2>}
                {activePost.description && <p className="text-sm leading-relaxed" style={{ color: 'rgba(226,238,255,0.68)' }}>{activePost.description}</p>}
                {activePost.createdAt && <p className="text-xs mt-4 font-bold" style={{ color: 'rgba(240,180,41,0.6)' }}>📅 {fmtDate(activePost.createdAt)}</p>}
              </div>
              <motion.button onClick={() => setActivePost(null)} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-sm z-10 transition-all"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>✕</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 mt-6" style={{ borderTop: '1px solid rgba(240,180,41,0.1)', background: 'rgba(5,13,31,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/tsok-logo.png" alt="TSOK" width={34} height={34} style={{ opacity: 0.7 }} />
            <div>
              <p className="font-black text-sm" style={{ fontFamily: '\'Playfair Display\', serif', background: 'linear-gradient(135deg, #f59e0b, #fcd34d)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TSOK Hub</p>
              <p className="text-[10px]" style={{ color: 'rgba(240,180,41,0.38)' }}>Teachers-Specialists Organization Kuwait</p>
            </div>
          </div>
          <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
            © 2026 TSOK · Developed by{' '}
            <span className="font-bold" style={{ color: '#f59e0b' }}>Godmisoft</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
