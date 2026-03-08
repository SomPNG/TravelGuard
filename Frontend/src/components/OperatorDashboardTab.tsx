import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  LayoutDashboard,
  AlertCircle,
  ShieldCheck,
  Coins,
  Activity,
  Plane,
  Loader2,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  Settings,
} from 'lucide-react';
import { BACKEND_URL } from '../config';
import { peraWallet, algoToMicroAlgo } from '../lib/algorand';
import { registerOperatorOnChain, updateTripStatusOnChain } from '../services/algorand';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface OperatorData {
  premiumPercent: number;
  compensationPercent: number;
  depositBalance: number; // micro ALGO
  activeTrips: number;
}

interface TripData {
  tripId: number;
  travelerAddress: string;
  tripStatus: number; // 0 Active, 1 Delayed, 2 Cancelled, 3 Completed
  fareAmountAlgo?: number;
  premiumAmountAlgo?: number;
  delayHours?: number;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Toast                                                               */
/* ------------------------------------------------------------------ */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-sky-500/30 bg-slate-800 px-5 py-4 shadow-2xl shadow-black/40 text-sm text-sky-300 animate-fade-in">
      <Clock className="h-4 w-4 shrink-0 text-sky-400" />
      {message}
      <button onClick={onClose} className="ml-2 text-slate-500 hover:text-slate-300">✕</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trip Status Badge                                                   */
/* ------------------------------------------------------------------ */
function TripStatusBadge({ status }: { status: number }) {
  const map: Record<number, { label: string; color: string; dot: string }> = {
    0: { label: 'Active',    color: 'bg-blue-500/10 border-blue-500/20 text-blue-400',   dot: 'bg-blue-500' },
    1: { label: 'Delayed',   color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400', dot: 'bg-yellow-500' },
    2: { label: 'Cancelled', color: 'bg-red-500/10 border-red-500/20 text-red-400',      dot: 'bg-red-500' },
    3: { label: 'Completed', color: 'bg-green-500/10 border-green-500/20 text-green-400', dot: 'bg-green-500' },
  };
  const s = map[status] ?? { label: 'Unknown', color: 'bg-slate-500/10 border-slate-500/20 text-slate-400', dot: 'bg-slate-500' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${s.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                           */
/* ------------------------------------------------------------------ */
function StatCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-900 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <div className="text-slate-600">{icon}</div>
      </div>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */
export default function OperatorDashboardTab({ accountAddress }: { accountAddress: string | null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorData, setOperatorData] = useState<OperatorData | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);

  // Register form
  const [premiumPercent, setPremiumPercent] = useState('10');
  const [compensationPercent, setCompensationPercent] = useState('20');
  const [depositAlgo, setDepositAlgo] = useState('0.1');

  // Trip lookup
  const [tripId, setTripId] = useState('');
  const [tripLoading, setTripLoading] = useState(false);
  const [tripError, setTripError] = useState<string | null>(null);
  const [tripData, setTripData] = useState<TripData | null>(null);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  /* ---- manage trip ---- */
  const [manageTripId, setManageTripId] = useState('');
  const [delayHours, setDelayHours] = useState(0);
  const [isCancelled, setIsCancelled] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  const handleUpdateTrip = async () => {
    if (!accountAddress) return;
    setManageLoading(true);
    setManageError(null);
    try {
      const tripIdNum = parseInt(manageTripId, 10);
      if (isNaN(tripIdNum) || tripIdNum <= 0) throw new Error('Invalid Trip ID');

      await updateTripStatusOnChain(
        peraWallet,
        accountAddress,
        tripIdNum,
        delayHours,
        isCancelled
      );
      
      setToast(`Successfully updated Trip #${tripIdNum} status!`);
      setManageTripId('');
      setDelayHours(0);
      setIsCancelled(false);
    } catch (err: unknown) {
      setManageError(err instanceof Error ? err.message : 'Failed to update trip');
    } finally {
      setManageLoading(false);
    }
  };

  /* ---- fetch operator ---- */
  const fetchOperator = useCallback(async () => {
    if (!accountAddress) return;
    setLoading(true);
    setError(null);
    setNotRegistered(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/operator/${accountAddress}`);
      if (res.status === 404) {
        setNotRegistered(true);
        setOperatorData(null);
      } else if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      } else {
        const json = await res.json();
        setOperatorData(json.data ?? json);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch operator details');
    } finally {
      setLoading(false);
    }
  }, [accountAddress]);

  useEffect(() => {
    if (accountAddress) fetchOperator();
  }, [accountAddress, fetchOperator]);

  /* ---- register operator ---- */
  const handleRegister = async () => {
    if (!accountAddress) return;
    setLoading(true);
    setError(null);
    try {
      const depositNum = parseFloat(depositAlgo);
      if (isNaN(depositNum) || depositNum < 0.1) throw new Error('Minimum deposit is 0.1 ALGO');
      
      const premium = parseInt(premiumPercent, 10);
      const comp = parseInt(compensationPercent, 10);

      await registerOperatorOnChain(
        peraWallet,
        accountAddress,
        premium,
        comp,
        depositNum  // pass ALGO — service converts to microALGO internally
      );

      setToast('Operator registered successfully on chain!');
      // Refresh the UI by fetching from API
      await fetchOperator();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register operator');
    } finally {
      setLoading(false);
    }
  };

  /* ---- trip lookup ---- */
  const handleLookupTrip = async () => {
    if (!accountAddress || !tripId.trim()) return;
    setTripLoading(true);
    setTripError(null);
    setTripData(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/trip/${tripId.trim()}/${accountAddress}`);
      if (res.status === 404) throw new Error('Trip not found for this operator');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      setTripData(json.data ?? json);
    } catch (err: unknown) {
      setTripError(err instanceof Error ? err.message : 'Failed to fetch trip');
    } finally {
      setTripLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Not connected                                                     */
  /* ---------------------------------------------------------------- */
  if (!accountAddress) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/5 bg-slate-800 shadow-inner">
          <Wallet className="h-9 w-9 text-slate-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-200">Wallet Not Connected</h2>
          <p className="mt-1 text-sm text-slate-400">Please connect your Pera Wallet to access the Operator Dashboard.</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Loading                                                           */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-teal-400" />
        <p className="text-sm text-slate-400">Loading operator data…</p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 shadow-lg shadow-teal-500/20">
          <LayoutDashboard className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Operator Dashboard</h1>
          <p className="text-sm text-slate-400">Manage your insurance pool on TravelGuard</p>
        </div>
      </div>

      {/* Global error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* ---- NOT REGISTERED ---- */}
      {notRegistered && (
        <div className="rounded-2xl border border-white/10 bg-slate-800 p-8 max-w-2xl mx-auto shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 shadow-lg shadow-teal-500/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-100">Register as Operator</h2>
              <p className="text-xs text-slate-400">Set up your insurance pool on TravelGuard</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Premium % */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-400">
                  Premium % <span className="text-slate-600">(1–100)</span>
                </label>
                <input
                  id="premiumPercent"
                  type="number"
                  min={1}
                  max={100}
                  value={premiumPercent}
                  onChange={(e) => setPremiumPercent(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>
              {/* Compensation % */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-400">
                  Compensation % <span className="text-slate-600">(1–100)</span>
                </label>
                <input
                  id="compensationPercent"
                  type="number"
                  min={1}
                  max={100}
                  value={compensationPercent}
                  onChange={(e) => setCompensationPercent(e.target.value)}
                  placeholder="e.g. 20"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                />
              </div>
            </div>

            {/* Deposit */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-400">
                Deposit Amount <span className="text-slate-600">(ALGO, min 0.1)</span>
              </label>
              <div className="relative">
                <input
                  id="depositAlgo"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={depositAlgo}
                  onChange={(e) => setDepositAlgo(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 pr-16 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">ALGO</span>
              </div>
            </div>

            <button
              id="registerBtn"
              onClick={handleRegister}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:scale-[1.02] transition-all"
            >
              <ShieldCheck className="h-4 w-4" />
              Register Operator
            </button>
          </div>
        </div>
      )}

      {/* ---- REGISTERED ---- */}
      {operatorData && (
        <div className="space-y-8">
          {/* Operator Info Card */}
          <div className="rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-lg">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-100">
              <LayoutDashboard className="h-5 w-5 text-sky-400" />
              Your Operator Policy
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Premium Rate"
                value={`${operatorData.premiumPercent}%`}
                icon={<Coins className="h-4 w-4" />}
              />
              <StatCard
                label="Compensation Rate"
                value={`${operatorData.compensationPercent}%`}
                icon={<ShieldCheck className="h-4 w-4" />}
              />
              <StatCard
                label="Deposit Balance"
                value={`${(operatorData.depositBalance / 1_000_000).toFixed(4)} ALGO`}
                icon={<Coins className="h-4 w-4" />}
              />
              <StatCard
                label="Active Trips"
                value={String(operatorData.activeTrips)}
                icon={<Activity className="h-4 w-4" />}
              />
            </div>
          </div>

          {/* Trip Lookup */}
          <div className="rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-lg">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Plane className="h-5 w-5 text-teal-400" />
              Trip Lookup
            </h2>

            <div className="flex gap-3">
              <input
                id="tripIdInput"
                type="text"
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookupTrip()}
                placeholder="Enter Trip ID"
                className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
              />
              <button
                id="lookupTripBtn"
                onClick={handleLookupTrip}
                disabled={tripLoading || !tripId.trim()}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50 transition-colors"
              >
                {tripLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Look Up
              </button>
            </div>

            {/* Trip error */}
            {tripError && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {tripError}
              </div>
            )}

            {/* Trip result */}
            {tripData && (
              <div className="mt-5 rounded-xl border border-white/5 bg-slate-900 p-5 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Trip ID</p>
                    <p className="text-lg font-bold text-slate-100">#{tripData.tripId}</p>
                    {tripData.travelerAddress && (
                      <p className="mt-0.5 text-xs font-mono text-slate-500 break-all">
                        {String(tripData.travelerAddress).slice(0, 12)}…{String(tripData.travelerAddress).slice(-6)}
                      </p>
                    )}
                  </div>
                  <TripStatusBadge status={tripData.tripStatus} />
                </div>

                {/* Detail grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {tripData.fareAmountAlgo !== undefined && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Fare</p>
                      <p className="mt-0.5 text-base font-semibold text-slate-200">
                        {Number(tripData.fareAmountAlgo).toFixed(4)} ALGO
                      </p>
                    </div>
                  )}
                  {tripData.premiumAmountAlgo !== undefined && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Premium</p>
                      <p className="mt-0.5 text-base font-semibold text-slate-200">
                        {Number(tripData.premiumAmountAlgo).toFixed(4)} ALGO
                      </p>
                    </div>
                  )}
                  {tripData.delayHours !== undefined && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Delay</p>
                      <p className="mt-0.5 text-base font-semibold text-slate-200">
                        {tripData.delayHours}h
                      </p>
                    </div>
                  )}
                </div>

                {/* Extra fields (catch-all) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(tripData)
                    .filter(([k]) => !['tripId', 'travelerAddress', 'tripStatus', 'fareAmountAlgo', 'premiumAmountAlgo', 'delayHours'].includes(k))
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-xs">
                        <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-slate-300 font-mono">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manage Trip / Update Status */}
      {operatorData && (
        <div className="rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-lg mt-6 block">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Settings className="h-5 w-5 text-teal-400" />
            Update Trip Status
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-400">Trip ID</label>
              <input
                type="number"
                value={manageTripId}
                onChange={(e) => setManageTripId(e.target.value)}
                placeholder="e.g. 1"
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-400">Delay Hours</label>
              <input
                type="number"
                min="0"
                value={delayHours}
                onChange={(e) => setDelayHours(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer mb-5 p-3 rounded-xl border border-white/5 bg-slate-900 hover:bg-slate-800/80 transition-colors">
            <div className="relative flex items-center">
              <input 
                type="checkbox"
                checked={isCancelled}
                onChange={(e) => setIsCancelled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            </div>
            <span className="text-sm font-medium text-slate-300">Is Flight Cancelled?</span>
          </label>

          {manageError && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {manageError}
            </div>
          )}

          <button
            onClick={handleUpdateTrip}
            disabled={manageLoading || !manageTripId}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
          >
            {manageLoading ? 'Updating Status...' : 'Update Status'}
          </button>
        </div>
      )}

      {/* Neither loading nor error nor data — shouldn't happen, but safe fallback */}
      {!loading && !error && !notRegistered && !operatorData && null}
    </div>
  );
}
