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
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: 'rgba(10,24,80,0.12)' }}
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
          className="text-2xl md:text-3xl font-black" style={{color:'#0a1850'}}>{title}</h2>
      </div>
      {subtitle && <p className="text-sm ml-10" style={{ color: 'rgba(30,58,138,0.6)' }}>{subtitle}</p>}
      <div className="mt-3 ml-10 h-px" style={{ background: 'linear-gradient(90deg, rgba(10,24,80,0.4), rgba(10,24,80,0.1), transparent)' }} />
    </motion.div>
  );
}

// ── CURRENCY CONVERTER ────────────────────────────────────────────
const PAIRS = [
  { from: 'PHP', to: 'KWD', label: 'PHP → KWD', flag: '🇵🇭→🇰🇼', color: '#92600a' },
  { from: 'KWD', to: 'PHP', label: 'KWD → PHP', flag: '🇰🇼→🇵🇭', color: '#1a4a92' },
  { from: 'PHP', to: 'USD', label: 'PHP → USD', flag: '🇵🇭→🇺🇸', color: '#1a6e3a' },
  { from: 'USD', to: 'PHP', label: 'USD → PHP', flag: '🇺🇸→🇵🇭', color: '#1a6e3a' },
  { from: 'KWD', to: 'USD', label: 'KWD → USD', flag: '🇰🇼→🇺🇸', color: '#5a1a92' },
  { from: 'USD', to: 'KWD', label: 'USD → KWD', flag: '🇺🇸→🇰🇼', color: '#5a1a92' },
];

const CURRENCY_SYMBOLS = { PHP: '₱', KWD: 'KD', USD: '$' };

function CurrencyConverter() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [amount, setAmount] = useState('1');
  const [activePair, setActivePair] = useState(PAIRS[0]);
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    // Use exchangerate-api free endpoint
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(r => r.json())
      .then(data => {
        setRates(data.rates);
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        setLoading(false);
      })
      .catch(() => {
        // Fallback approximate rates if API fails
        setRates({ PHP: 56.5, KWD: 0.307, USD: 1 });
        setLastUpdated('approx.');
        setLoading(false);
        setError(true);
      });
  }, []);

  const convert = (amt, from, to) => {
    if (!rates || !amt || isNaN(amt)) return '—';
    const inUSD = Number(amt) / (rates[from] || 1);
    const result = inUSD * (rates[to] || 1);
    return result < 0.01 ? result.toFixed(6) : result >= 1000 ? result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : result.toFixed(4);
  };

  const sym = (c) => CURRENCY_SYMBOLS[c] || c;

  return (
    <section className="relative z-10 container mx-auto px-4 pb-14">
      <SectionHeading icon="💱" title="Currency Converter" subtitle="Live exchange rates — PHP, KWD, USD" />

      <div className="rounded-3xl overflow-hidden shadow-xl" style={{ background: '#ffffff', border: '1px solid rgba(10,24,80,0.1)' }}>
        {/* Rate cards row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0">
          {PAIRS.map((pair, i) => {
            const rate = loading ? null : convert('1', pair.from, pair.to);
            return (
              <motion.button key={pair.label}
                initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                onClick={() => setActivePair(pair)}
                className="relative p-4 text-center transition-all border-r border-b"
                style={{
                  borderColor: 'rgba(180,140,30,0.12)',
                  background: activePair.label === pair.label ? 'rgba(240,180,41,0.12)' : 'transparent',
                  borderBottom: activePair.label === pair.label ? `2px solid ${pair.color}` : '1px solid rgba(180,140,30,0.12)',
                }}>
                <p className="text-lg mb-0.5">{pair.flag}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: pair.color }}>{pair.label}</p>
                {loading ? (
                  <div className="h-5 w-16 mx-auto rounded animate-pulse" style={{ background: 'rgba(180,140,30,0.15)' }} />
                ) : (
                  <p className="font-black text-sm" style={{ color: '#1a1a2e' }}>
                    {sym(pair.to)}{rate}
                  </p>
                )}
                <p className="text-[9px] mt-0.5" style={{ color: 'rgba(30,58,138,0.45)' }}>per 1 {sym(pair.from)}</p>
              </motion.button>
            );
          })}
        </div>

        {/* Active converter */}
        <div className="p-5 md:p-6" style={{ borderTop: '1px solid rgba(180,140,30,0.15)', background: '#f8faff' }}>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Input */}
            <div className="flex-1 w-full">
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(10,24,80,0.65)' }}>
                Amount ({activePair.from})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-lg" style={{ color: activePair.color }}>
                  {sym(activePair.from)}
                </span>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl text-xl font-black focus:outline-none transition-all"
                  style={{ background: '#fff', border: `2px solid rgba(180,130,20,0.2)`, color: '#1a1a2e' }}
                  onFocus={e => e.target.style.borderColor = activePair.color}
                  onBlur={e => e.target.style.borderColor = 'rgba(180,130,20,0.2)'} />
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-1 sm:mt-5">
              <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-md"
                style={{ background: activePair.color, color: '#fff' }}>→</motion.div>
            </div>

            {/* Result */}
            <div className="flex-1 w-full">
              <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: 'rgba(10,24,80,0.65)' }}>
                Result ({activePair.to})
              </label>
              <div className="w-full px-4 py-3.5 rounded-2xl text-xl font-black"
                style={{ background: `${activePair.color}12`, border: `2px solid ${activePair.color}30`, color: activePair.color }}>
                {loading ? (
                  <span className="animate-pulse">Converting...</span>
                ) : (
                  <span>{sym(activePair.to)}{convert(amount, activePair.from, activePair.to)}</span>
                )}
              </div>
            </div>
          </div>

          {/* All conversions for entered amount */}
          {amount && !isNaN(amount) && Number(amount) > 0 && !loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAIRS.filter(p => p.from === activePair.from && p.to !== activePair.to).map(p => (
                <div key={p.label} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(180,140,30,0.12)' }}>
                  <span className="font-semibold" style={{ color: 'rgba(30,58,138,0.6)' }}>{p.flag} {p.to}</span>
                  <span className="font-black" style={{ color: p.color }}>{sym(p.to)}{convert(amount, p.from, p.to)}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between text-xs" style={{ color: 'rgba(10,24,80,0.45)' }}>
            <span>{error ? '⚠️ Approximate rates' : `🔄 Live rates · Updated ${lastUpdated}`}</span>
            <span>Source: exchangerate-api.com</span>
          </div>
        </div>
      </div>
    </section>
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
    <div className="min-h-screen relative" style={{ background: '#ffffff' }}>
      <Particles />

      {/* Diagonal navy stripes */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 28px, rgba(10,24,80,0.04) 28px, rgba(10,24,80,0.04) 30px)' }} />

      {/* Subtle corner navy accent blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(10,24,80,0.07) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(10,24,80,0.06) 0%, transparent 70%)' }} />
        <div className="absolute top-1/3 right-0 w-64 h-64 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(180,130,20,0.06) 0%, transparent 70%)' }} />
      </div>

      {/* ── TICKER ── */}
      <div className="relative z-30 overflow-hidden py-1.5" style={{ background: '#1a1a2e', borderBottom: '1px solid rgba(240,180,41,0.3)' }}>
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
        style={{ background: scrolled ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(10,24,80,0.1)', boxShadow: scrolled ? '0 4px 30px rgba(10,24,80,0.1)' : 'none' }}>
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.6 }} className="relative">
                <Image src="/tsok-logo.png" alt="TSOK" width={46} height={46} className="drop-shadow-lg" style={{ filter: 'drop-shadow(0 2px 8px rgba(10,24,80,0.25))' }} />
              </motion.div>
              <div>
                <h1 className="font-black text-xl leading-none" style={{ fontFamily: '\'Playfair Display\', serif', background: 'linear-gradient(135deg, #0a1850, #1e3a8a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TSOK Hub</h1>
                <p className="text-[10px] tracking-widest uppercase" style={{ color: 'rgba(30,58,138,0.6)' }}>Teachers-Specialists Org. Kuwait</p>
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
                    style={{ color: 'rgba(120,85,10,0.75)', border: '1px solid rgba(255,255,255,0.1)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(10,24,80,0.3)'; e.currentTarget.style.color = '#0a1850'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,24,80,0.15)'; e.currentTarget.style.color = 'rgba(30,58,138,0.8)'; }}>
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="px-4 py-2 text-xs font-semibold rounded-xl transition-all"
                    style={{ color: '#92600a', border: '1px solid rgba(180,130,20,0.35)', background: '#f0f4ff' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,130,20,0.5)'; e.currentTarget.style.background = 'rgba(240,180,41,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,130,20,0.35)'; e.currentTarget.style.background = 'rgba(240,180,41,0.08)'; }}>
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
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none transition-all"
              style={{ background: '#ffffff', border: '1px solid rgba(10,24,80,0.1)', color: '#0a1850', '::placeholder': { color: 'rgba(240,180,41,0.4)' } }}
              onFocus={e => e.target.style.borderColor = 'rgba(10,24,80,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(10,24,80,0.12)'} />
          </div>
        </div>
      </motion.header>

      {/* ── HERO ── */}
      <section className="relative z-10 py-16 md:py-24 px-4 text-center overflow-hidden">
        <div className="container mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.7 }}>
            <span className="inline-block px-5 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-7"
              style={{ background: 'rgba(10,24,80,0.06)', border: '1px solid rgba(10,24,80,0.2)', color: '#1e3a8a' }}>
              ✦ Your Gateway to TSOK Resources ✦
            </span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.9 }}
            className="text-4xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight"
            style={{ fontFamily: '\'Playfair Display\', serif' }}>
            <span style={{color:'#0a1850'}}>Empowering</span>{' '}
            <span style={{background:"linear-gradient(135deg,#0a1850,#1e3a8a,#3b82f6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Filipino Teachers</span>
            <br />
            <span style={{color:'#0a1850'}}>Across </span>
            <span style={{ background: 'linear-gradient(135deg, #0a1850, #1e3a8a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Kuwait</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'rgba(30,58,138,0.65)' }}>
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
                  style={{ fontFamily: '\'Playfair Display\', serif', background: 'linear-gradient(135deg, #0a1850, #1e3a8a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  <Counter to={value} suffix={suffix} />
                </p>
                <p className="text-xs mt-1 uppercase tracking-wider" style={{ color: 'rgba(30,58,138,0.6)' }}>{label}</p>
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
        <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(10,24,80,0.15), transparent)' }} />
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
                  : { background: '#f0f4ff', color: '#1e3a8a', border: '1px solid rgba(10,24,80,0.12)' }}>
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
                  style={{ background: '#ffffff', border: '1px solid rgba(10,24,80,0.1)' }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(10,24,80,0.3)'; el.style.background = 'rgba(240,245,255,1)'; el.style.boxShadow = '0 20px 40px rgba(0,0,0,0.35), 0 0 24px rgba(240,180,41,0.1)'; }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = 'rgba(10,24,80,0.1)'; el.style.background = '#ffffff'; el.style.boxShadow = 'none'; }}>
                  {site.isNew && (
                    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[9px] font-black rounded-full z-10 animate-pulse"
                      style={{ background: '#dc2626', color: '#fff' }}>NEW</span>
                  )}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 mb-2 flex items-center justify-center rounded-xl overflow-hidden"
                    style={{ background: '#f0f4ff' }}>
                    <Image src={site.icon || '/icon-192.png'} alt={site.title} width={56} height={56} className="object-contain drop-shadow" />
                  </div>
                  <h3 className="text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2" style={{color:'#0a1850'}}>{site.title}</h3>
                  <span className="mt-1.5 px-2 py-0.5 text-[9px] font-bold rounded-full hidden sm:block"
                    style={{ background: '#e8eeff', color: '#1e3a8a' }}>{site.category}</span>
                </motion.a>
              ))}
              {filteredWebsites.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full text-center py-16">
                  <p className="text-5xl mb-3">🔍</p>
                  <p className="font-semibold" style={{ color: 'rgba(120,85,10,0.7)' }}>No results for "{searchQuery}"</p>
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
                  style={{ border: '1px solid rgba(10,24,80,0.1)', background: '#ffffff' }}>
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
                            style={{ background: 'rgba(0,0,0,0.72)', color: '#92600a' }}>
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
                  <div className="md:col-span-2 p-6 md:p-8 flex flex-col justify-center" style={{ background: '#f8faff' }}>
                    {posts[0].caption && (
                      <h3 className="font-black text-xl md:text-2xl leading-tight mb-3 transition-colors" style={{color:'#0a1850'}}
                        style={{ fontFamily: '\'Playfair Display\', serif' }}>{posts[0].caption}</h3>
                    )}
                    {posts[0].description && <p className="text-sm leading-relaxed line-clamp-5" style={{ color: 'rgba(30,58,138,0.65)' }}>{posts[0].description}</p>}
                    {posts[0].createdAt && <p className="text-xs mt-4 font-semibold" style={{ color: 'rgba(120,85,10,0.75)' }}>📅 {fmtDate(posts[0].createdAt)}</p>}
                    <div className="mt-4 flex items-center gap-2 text-sm font-bold transition-all group-hover:gap-3" style={{ color: '#1e3a8a' }}>
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
                      style={{ background: '#ffffff', border: '1px solid rgba(10,24,80,0.08)' }}
                      onClick={() => setActivePost(post)}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(10,24,80,0.25)'; e.currentTarget.style.background = '#f0f4ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,24,80,0.08)'; e.currentTarget.style.background = '#ffffff'; }}>
                      <div className="flex-shrink-0 w-28 h-20 sm:w-36 sm:h-24 bg-black/30 overflow-hidden relative flex items-center justify-center">
                        {post.videoUrl ? (
                          <>
                            <video src={post.videoUrl} className="w-full h-full object-contain" muted playsInline preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                              <svg className="w-6 h-6" style={{ color: '#1e3a8a' }} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                          </>
                        ) : thumb ? (
                          <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                            <motion.img src={thumb} alt={post.caption} whileHover={{ scale: 1.1 }} className="w-full h-full object-contain" />
                            {photoCount > 1 && <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: 'rgba(0,0,0,0.82)', color: '#1e3a8a' }}>+{photoCount - 1}</span>}
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl opacity-25"
                            style={{ background: 'linear-gradient(135deg, #0f2040, #1e3a6e)' }}>📣</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-3 pr-4 flex flex-col justify-center">
                        {post.caption && <h3 className="font-bold text-sm leading-tight mb-1 transition-colors" style={{color:'#0a1850'}}>{post.caption}</h3>}
                        {post.description && <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'rgba(30,58,138,0.6)' }}>{post.description}</p>}
                        {post.createdAt && <p className="text-xs mt-1.5 font-semibold" style={{ color: 'rgba(30,58,138,0.55)' }}>{fmtDate(post.createdAt)}</p>}
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
                    style={{ background: '#ffffff', border: '1px solid rgba(10,24,80,0.08)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(10,24,80,0.3)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-bl-3xl opacity-8"
                      style={{ background: '#1e3a8a', opacity: 0.06 }} />
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-14 text-center rounded-xl py-2 shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#050d1f' }}>
                        <p className="text-[10px] font-black uppercase leading-none">{d.toLocaleDateString('en-US', { month: 'short' })}</p>
                        <p className="text-2xl font-black leading-tight">{d.getDate()}</p>
                        <p className="text-[10px] font-bold leading-none">{d.getFullYear()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-sm leading-tight mb-1.5 transition-colors" style={{color:'#0a1850'}}>{act.title}</h3>
                        {act.location && <p className="text-xs mb-1" style={{ color: 'rgba(10,24,80,0.65)' }}>📍 {act.location}</p>}
                        {act.description && <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'rgba(30,58,138,0.6)' }}>{act.description}</p>}
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
                      style={{ background: '#ffffff', border: '1px solid rgba(10,24,80,0.1)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(10,24,80,0.25)'; e.currentTarget.style.background = '#f0f4ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(10,24,80,0.1)'; e.currentTarget.style.background = '#ffffff'; }}>
                      {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-10 max-w-[72px] object-contain" />}
                      {sp.name && <p className="text-xs font-semibold text-center leading-tight" style={{color:'#0a1850'}}>{sp.name}</p>}
                    </a>
                  ) : (
                    <div className="rounded-2xl p-4 flex flex-col items-center gap-2 w-32 h-28 justify-center"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {sp.logoUrl && <img src={sp.logoUrl} alt={sp.name} className="max-h-10 max-w-[72px] object-contain" />}
                      {sp.name && <p className="text-xs font-semibold text-center leading-tight" style={{color:'#0a1850'}}>{sp.name}</p>}
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
            style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #0f1a35 100%)', border: '1px solid rgba(240,180,41,0.3)' }}>
            <div className="absolute inset-0" style={{ opacity: 0.05, background: 'radial-gradient(circle at 20% 50%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 80% 50%, #3b82f6 0%, transparent 50%)' }} />
            <div className="relative z-10">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 4, repeat: Infinity }} className="text-6xl mb-5">🏆</motion.div>
              <h2 className="font-black text-3xl md:text-4xl mb-3" style={{color:'#fff'}} style={{ fontFamily: '\'Playfair Display\', serif' }}>
                Join the{' '}
                <span style={{ background: 'linear-gradient(135deg, #0a1850, #1e3a8a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TSOK Community</span>
              </h2>
              <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: 'rgba(220,210,190,0.8)' }}>
                Connect with fellow Filipino educators, access exclusive resources, and grow professionally in Kuwait.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/register" className="px-10 py-4 font-black rounded-2xl text-sm transition-all hover:scale-105"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#050d1f', boxShadow: '0 8px 32px rgba(240,180,41,0.3)' }}>
                  Register Now — It's Free ✦
                </Link>
                <Link href="/login" className="px-10 py-4 font-bold rounded-2xl text-sm transition-all hover:scale-105"
                  style={{ color:'#fff', border: '1px solid rgba(240,180,41,0.28)', background: 'rgba(240,180,41,0.06)' }}>
                  Already a member? Login
                </Link>
              </div>
            </div>
          </motion.section>
        )}
      </main>

      {/* ── CURRENCY CONVERTER ── */}
      <CurrencyConverter />

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
              style={{ background: '#ffffff', border: '1px solid rgba(10,24,80,0.12)' }}
              onClick={e => e.stopPropagation()}>
              {activePost.videoUrl && <video src={activePost.videoUrl} controls playsInline autoPlay className="w-full" />}
              {!activePost.videoUrl && (() => {
                const imgs = activePost.imageUrls?.length ? activePost.imageUrls : activePost.imageUrl ? [activePost.imageUrl] : [];
                return imgs.length ? <GalleryViewer images={imgs} /> : null;
              })()}
              <div className="p-6">
                {activePost.caption && <h2 className="font-black text-2xl mb-3" style={{color:'#0a1850'}} style={{ fontFamily: '\'Playfair Display\', serif' }}>{activePost.caption}</h2>}
                {activePost.description && <p className="text-sm leading-relaxed" style={{ color: 'rgba(30,58,138,0.65)' }}>{activePost.description}</p>}
                {activePost.createdAt && <p className="text-xs mt-4 font-bold" style={{ color: 'rgba(30,58,138,0.6)' }}>📅 {fmtDate(activePost.createdAt)}</p>}
              </div>
              <motion.button onClick={() => setActivePost(null)} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}
                className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-sm z-10 transition-all"
                style={{ background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>✕</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 mt-6" style={{ borderTop: '1px solid rgba(10,24,80,0.08)', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)' }}>
        <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center" style={{ background: '#1a1a2e', padding: 4 }}><Image src="/tsok-logo.png" alt="TSOK" width={30} height={30} /></div>
            <div>
              <p className="font-black text-sm" style={{ fontFamily: '\'Playfair Display\', serif', background: 'linear-gradient(135deg, #0a1850, #1e3a8a)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TSOK Hub</p>
              <p className="text-[10px]" style={{ color: 'rgba(10,24,80,0.45)' }}>Teachers-Specialists Organization Kuwait</p>
            </div>
          </div>
          <p className="text-xs text-center" style={{ color: 'rgba(30,58,138,0.45)' }}>
            © 2026 TSOK · Developed by{' '}
            <span className="font-bold" style={{ color: '#1e3a8a' }}>Godmisoft</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
