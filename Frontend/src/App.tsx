import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LogOut, Plane, Shield, Zap, ArrowRight, Users, Briefcase,
  ChevronLeft, Activity, LayoutDashboard, Ticket, Search
} from 'lucide-react';
import { BACKEND_URL } from './config';
import { useWallet } from './hooks/useWallet';
import OperatorDashboardTab from './components/OperatorDashboardTab';
import BookTripTab from './components/BookTripTab';
import MyTripsTab from './components/MyTripsTab';

// ─── App state types ──────────────────────────────────────────────────────────
type AppScreen = 'landing' | 'role-select' | 'traveler' | 'operator';
type TravelerTab = 'book' | 'trips';
type OperatorTab = 'dashboard';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [travelerTab, setTravelerTab] = useState<TravelerTab>('book');
  const [operatorTab, setOperatorTab] = useState<OperatorTab>('dashboard');
  const { address, connect, disconnect } = useWallet();

  const handleDisconnect = () => {
    disconnect();
    setScreen('landing');
  };

  const handleRoleSelect = (role: 'traveler' | 'operator') => {
    setScreen(role);
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)' }}>

      {/* ── LANDING PAGE ── */}
      <AnimatePresence mode="wait">
        {screen === 'landing' && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4 }}
          >
            <LandingPage
              address={address}
              connect={connect}
              onEnter={() => setScreen(address ? 'role-select' : 'landing')}
            />
          </motion.div>
        )}

        {/* ── ROLE SELECTOR ── */}
        {screen === 'role-select' && (
          <motion.div
            key="role-select"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
          >
            <RoleSelector
              address={address}
              onSelect={handleRoleSelect}
              disconnect={handleDisconnect}
            />
          </motion.div>
        )}

        {/* ── TRAVELER PORTAL ── */}
        {screen === 'traveler' && (
          <motion.div
            key="traveler"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="min-h-screen flex flex-col"
          >
            {/* Navbar */}
            <PortalNav
              role="traveler"
              address={address}
              disconnect={handleDisconnect}
              onBack={() => setScreen('role-select')}
              tabs={[
                { id: 'book', label: 'Book a Flight', icon: <Ticket className="h-4 w-4" /> },
                { id: 'trips', label: 'My Trips', icon: <Search className="h-4 w-4" /> },
              ]}
              activeTab={travelerTab}
              onTabChange={(t) => setTravelerTab(t as TravelerTab)}
            />
            {/* Content */}
            <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={travelerTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {travelerTab === 'book' && <BookTripTab accountAddress={address} />}
                  {travelerTab === 'trips' && <MyTripsTab accountAddress={address} />}
                </motion.div>
              </AnimatePresence>
            </main>
          </motion.div>
        )}

        {/* ── OPERATOR PORTAL ── */}
        {screen === 'operator' && (
          <motion.div
            key="operator"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.35 }}
            className="min-h-screen flex flex-col"
          >
            {/* Navbar */}
            <PortalNav
              role="operator"
              address={address}
              disconnect={handleDisconnect}
              onBack={() => setScreen('role-select')}
              tabs={[
                { id: 'dashboard', label: 'Operator Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
              ]}
              activeTab={operatorTab}
              onTabChange={(t) => setOperatorTab(t as OperatorTab)}
            />
            {/* Content */}
            <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={operatorTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {operatorTab === 'dashboard' && <OperatorDashboardTab accountAddress={address} />}
                </motion.div>
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ───────────────────────────────────────────────────────────────────────────────
function LandingPage({ address, connect, onEnter }: {
  address: string | null;
  connect: () => Promise<void>;
  onEnter: () => void;
}) {
  const [stats, setStats] = useState<{ totalTrips: number; platformBalance: number } | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/contract-info`)
      .then(r => r.json())
      .then(d => {
        const s = d.data || d;
        setStats({ totalTrips: s.totalTrips || 0, platformBalance: s.platformBalance || 0 });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 -right-60 h-[500px] w-[500px] rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 left-1/3 h-[400px] w-[400px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }} />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #14b8a6)' }}>
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">TravelGuard</span>
        </div>
        <div>
          {address ? (
            <div className="flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-sm text-white border border-white/10">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="font-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
            </div>
          ) : (
            <button
              onClick={() => connect()}
              className="rounded-full px-5 py-2 text-sm font-semibold text-white border border-white/20 backdrop-blur hover:bg-white/10 transition-all"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-16 text-center"
      >
        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-sm text-indigo-300 backdrop-blur">
          <Activity className="h-3.5 w-3.5" />
          <span>Live on Algorand TestNet</span>
        </div>

        <h1 className="text-6xl sm:text-8xl md:text-9xl font-extrabold leading-none tracking-tight text-white">
          Travel
          <span style={{ WebkitBackgroundClip: 'text'}}>
            Guard
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed">
          Decentralized flight insurance powered by Algorand smart contracts.
          Automatic refunds when your flight is delayed — no middlemen, no paperwork.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center">
          {address ? (
            <motion.button
              onClick={onEnter}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #14b8a6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}
            >
              Enter App
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          ) : (
            <motion.button
              onClick={() => connect()}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              className="group flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-xl transition-all"
              style={{ background: 'linear-gradient(135deg, #6366f1, #14b8a6)', boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}
            >
              Connect Wallet to Start
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          )}
        </div>

        {/* Live stats strip */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-16 flex flex-wrap justify-center gap-6"
          >
            {[
              { label: 'Trips Protected', value: stats.totalTrips.toString() },
              { label: 'Platform Balance', value: `${(stats.platformBalance / 1_000_000).toFixed(4)} ALGO` },
              { label: 'Network', value: 'Algorand TestNet' },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-6 py-4 text-center min-w-[140px]">
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </motion.div>
        )}

        {/* Feature pills */}
        <div className="mt-16 flex flex-wrap justify-center gap-3">
          {[
            { icon: <Zap className="h-4 w-4 text-yellow-400" />, text: 'Instant on-chain refunds' },
            { icon: <Shield className="h-4 w-4 text-indigo-400" />, text: 'Smart contract secured' },
            { icon: <Plane className="h-4 w-4 text-teal-400" />, text: 'Flight delay protection' },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 backdrop-blur">
              {f.icon}
              {f.text}
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// ROLE SELECTOR
// ───────────────────────────────────────────────────────────────────────────────
function RoleSelector({ address, onSelect, disconnect }: {
  address: string | null;
  onSelect: (role: 'traveler' | 'operator') => void;
  disconnect: () => void;
}) {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Ambient */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #14b8a6 0%, transparent 70%)' }} />
      </div>

      {/* Header */}
      <div className="relative z-10 w-full max-w-xl text-center mb-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #6366f1, #14b8a6)' }}>
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white">TravelGuard</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Who are you?</h2>
        <p className="mt-3 text-slate-400 text-base">Choose your role to access your dashboard</p>
        {address && (
          <p className="mt-3 text-xs text-slate-500 font-mono">
            Connected: {address.slice(0, 10)}…{address.slice(-6)}
          </p>
        )}
      </div>

      {/* Role cards */}
      <div className="relative z-10 flex flex-col sm:flex-row gap-5 w-full max-w-2xl">
        {/* Traveler */}
        <motion.button
          whileHover={{ y: -6, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect('traveler')}
          className="flex-1 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8 text-left hover:border-indigo-500/50 transition-all duration-300"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05)' }}
        >
          {/* Glow on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" style={{ background: 'radial-gradient(ellipse at top left, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />

          <div className="relative">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.1))', border: '1px solid rgba(99,102,241,0.3)' }}>
              <Users className="h-7 w-7 text-indigo-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Traveler</h3>
            <p className="text-sm text-slate-400 leading-relaxed">Book flight insurance policies and claim automatic refunds when your flight is delayed.</p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />Book trip insurance</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />Track flight status</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />Claim refunds on-chain</li>
            </ul>
            <div className="mt-6 flex items-center gap-1 text-sm font-semibold text-indigo-400 group-hover:gap-2 transition-all">
              Enter Traveler Portal <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </motion.button>

        {/* Operator */}
        <motion.button
          whileHover={{ y: -6, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect('operator')}
          className="flex-1 group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur p-8 text-left hover:border-teal-500/50 transition-all duration-300"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.05)' }}
        >
          {/* Glow on hover */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-3xl" style={{ background: 'radial-gradient(ellipse at top left, rgba(20,184,166,0.15) 0%, transparent 70%)' }} />

          <div className="relative">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, rgba(20,184,166,0.3), rgba(20,184,166,0.1))', border: '1px solid rgba(20,184,166,0.3)' }}>
              <Briefcase className="h-7 w-7 text-teal-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Operator</h3>
            <p className="text-sm text-slate-400 leading-relaxed">Register as an airline operator, manage flight statuses, and process delay notifications.</p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" />Register & manage deposit</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" />Update flight delay status</li>
              <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-teal-400" />Complete or cancel trips</li>
            </ul>
            <div className="mt-6 flex items-center gap-1 text-sm font-semibold text-teal-400 group-hover:gap-2 transition-all">
              Enter Operator Portal <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </motion.button>
      </div>

      {/* Disconnect */}
      <button
        onClick={disconnect}
        className="relative z-10 mt-8 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        <LogOut className="h-4 w-4" /> Disconnect wallet
      </button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// PORTAL NAVBAR (reused for both Traveler and Operator)
// ───────────────────────────────────────────────────────────────────────────────
function PortalNav({ role, address, disconnect, onBack, tabs, activeTab, onTabChange }: {
  role: 'traveler' | 'operator';
  address: string | null;
  disconnect: () => void;
  onBack: () => void;
  tabs: { id: string; label: string; icon: React.ReactNode }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const accentColor = role === 'traveler' ? '#818cf8' : '#34d399';
  const accentBg = role === 'traveler' ? 'rgba(99,102,241,0.15)' : 'rgba(20,184,166,0.15)';

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(15,23,42,0.8)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-6">
          {/* Back + Logo */}
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group shrink-0">
            <ChevronLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #6366f1, #14b8a6)' }}>
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold text-white hidden sm:block">TravelGuard</span>
            </div>
          </button>

          {/* Role badge */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: accentBg, color: accentColor, border: `1px solid ${accentColor}30` }}>
            {role === 'traveler' ? <Users className="h-3 w-3" /> : <Briefcase className="h-3 w-3" />}
            {role === 'traveler' ? 'Traveler Portal' : 'Operator Portal'}
          </div>

          {/* Tabs */}
          <div className="flex flex-1 items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Wallet */}
          <div className="flex items-center gap-2 shrink-0">
            {address && (
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-mono text-slate-300 border border-white/10">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                <span className="hidden sm:block">{address.slice(0, 6)}…{address.slice(-4)}</span>
              </div>
            )}
            <button onClick={disconnect} className="rounded-lg p-2 text-slate-500 hover:text-white hover:bg-white/10 transition-colors" title="Disconnect">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
