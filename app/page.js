'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function Home() {
  const { user, userProfile, logout } = useAuth();
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchWebsites();
  }, []);

  const fetchWebsites = async () => {
    try {
      const q = query(collection(db, 'websites'), orderBy('order', 'asc'));
      const querySnapshot = await getDocs(q);
      const sitesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setWebsites(sitesData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching websites:', error);
      setLoading(false);
    }
  };

  const filteredWebsites = websites.filter(site => {
    const matchesSearch = site.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         site.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || site.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', ...new Set(websites.map(site => site.category))];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    },
    hover: {
      scale: 1.05,
      y: -10,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: "spring" }}
        className="relative z-10 bg-white/10 backdrop-blur-lg border-b border-white/20"
      >
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  repeatDelay: 5
                }}
              >
                <Image 
                  src="/tsok-logo.png" 
                  alt="TSOK Logo" 
                  width={80} 
                  height={80}
                  className="drop-shadow-2xl"
                />
              </motion.div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">
                  TSOK Portal
                </h1>
                <p className="text-blue-200 text-sm md:text-base">Teachers-Specialists Organization Kuwait</p>
              </div>
            </div>
            {/* Community / Auth buttons */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link href="/feed"
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all text-sm shadow-lg"
                  >
                    👥 Community
                  </Link>
                  <button
                    onClick={logout}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-sm font-medium"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link href="/register"
                    className="px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-bold rounded-xl transition-all text-sm shadow-lg"
                  >
                    Join TSOK
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-4 py-12">
        {/* Search and Filter */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <div className="max-w-2xl mx-auto mb-6">
            <input
              type="text"
              placeholder="Search websites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-white/10 backdrop-blur-lg border border-white/20 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((category) => (
              <motion.button
                key={category}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-2 rounded-full font-semibold transition-all ${
                  selectedCategory === category
                    ? 'bg-yellow-400 text-blue-900'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center min-h-[400px]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full"
            />
          </div>
        )}

        {/* Websites Grid */}
        {!loading && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AnimatePresence>
              {filteredWebsites.map((site) => (
                <motion.div
                  key={site.id}
                  variants={cardVariants}
                  whileHover="hover"
                  layout
                  className="relative group"
                >
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className={`relative overflow-hidden rounded-2xl backdrop-blur-lg border border-white/20 shadow-2xl ${
                      site.style || 'bg-gradient-to-br from-white/10 to-white/5'
                    }`}>
                      {/* Icon/Image */}
                      <div className="p-8 flex justify-center">
                        <motion.div
                          whileHover={{ rotate: 360 }}
                          transition={{ duration: 0.6 }}
                          className="w-24 h-24 flex items-center justify-center"
                        >
                          <Image 
                            src={site.icon || '/icon-192.png'} 
                            alt={site.title}
                            width={96}
                            height={96}
                            className="object-contain drop-shadow-lg"
                          />
                        </motion.div>
                      </div>

                      {/* Content */}
                      <div className="p-6 pt-0">
                        <h3 className="text-2xl font-bold text-white mb-2">{site.title}</h3>
                        <p className="text-blue-200 mb-4">{site.description}</p>
                        
                        {/* Category Badge */}
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-yellow-400 text-blue-900 text-xs font-semibold rounded-full">
                            {site.category}
                          </span>
                          {site.isNew && (
                            <motion.span
                              animate={{ scale: [1, 1.1, 1] }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded-full"
                            >
                              NEW
                            </motion.span>
                          )}
                        </div>
                      </div>

                      {/* Hover Effect Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                  </a>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && filteredWebsites.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-2xl font-bold text-white mb-2">No websites found</h3>
            <p className="text-blue-200">Try adjusting your search or filters</p>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="relative z-10 mt-20 bg-white/5 backdrop-blur-lg border-t border-white/10"
      >
        <div className="container mx-auto px-4 py-8 text-center text-blue-200">
          <p className="mb-2">© 2026 TSOK - Teachers-Specialists Organization Kuwait</p>
          <p className="text-sm">Developed by <span className="text-yellow-400 font-semibold">2026 TSOK Officers</span></p>
        </div>
      </motion.footer>
    </div>
  );
}
