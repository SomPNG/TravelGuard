import { useState, useEffect } from 'react';
import { Search, AlertCircle, CheckCircle2, Clock, Plane, Coins, XCircle, Settings } from 'lucide-react';
import { BACKEND_URL } from '../config';
import { microAlgoToAlgo, peraWallet } from '../lib/algorand';
import { updateTripStatusOnChain, claimRefundOnChain } from '../services/algorand';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface TripData {
  tripId: number;
  travelerAddress: string;
  operatorAddress: string;
  tripStatus: number; // 0: Active, 1: Delayed, 2: Cancelled, 3: Completed
  fareAmountAlgo: number;
  premiumAmountAlgo: number;
  delayHours: number;
  refundPaid: boolean;
}

/* ------------------------------------------------------------------ */
/*  Toast                                                               */
/* ------------------------------------------------------------------ */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-sky-500/30 bg-slate-800 px-5 py-4 shadow-2xl shadow-black/40 text-sm text-sky-300">
      <Clock className="h-4 w-4 shrink-0 text-sky-400" />
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 text-slate-500 hover:text-slate-300 transition-colors">✕</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge Component                                                     */
/* ------------------------------------------------------------------ */
function TripStatusBadge({ status }: { status: number }) {
  const map: Record<number, { label: string; color: string; dot: string }> = {
    0: { label: 'Active',            color: 'bg-blue-500/10 border-blue-500/20 text-blue-400',       dot: 'bg-blue-500' },
    1: { label: 'Delayed',           color: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400', dot: 'bg-yellow-500' },
    2: { label: 'OperatorCancelled', color: 'bg-red-500/10 border-red-500/20 text-red-400',          dot: 'bg-red-500' },
    3: { label: 'Completed',         color: 'bg-green-500/10 border-green-500/20 text-green-400',     dot: 'bg-green-500' },
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
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */
export default function MyTripsTab({ accountAddress }: { accountAddress: string | null }) {
  const [operatorAddress, setOperatorAddress] = useState('');
  const [tripId, setTripId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tripData, setTripData] = useState<TripData | null>(null);
  const [refundEstimate, setRefundEstimate] = useState<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  /* ---- fetch trip ---- */
  const fetchTrip = async () => {
    if (!operatorAddress.trim() || !tripId.trim()) return;
    setLoading(true);
    setError(null);
    setTripData(null);
    setRefundEstimate(null);

    const formattedOperator = operatorAddress.trim();
    const formattedTripId = tripId.trim();

    try {
      // 1. Fetch trip details
      const res = await fetch(`${BACKEND_URL}/api/trip/${formattedTripId}/${formattedOperator}`);
      if (res.status === 404) throw new Error('Trip not found');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      const trip: TripData = json.data ?? json;
      setTripData(trip);

      // 2. If Delayed (status 1) and refund hasn't been paid, calculate refund estimate locally
      if (trip.tripStatus === 1 && !trip.refundPaid && trip.fareAmountAlgo) {
        try {
          // Fetch operator to get compensation percentage
          const opRes = await fetch(`${BACKEND_URL}/api/operator/${formattedOperator}`);
          if (opRes.ok) {
            const opJson = await opRes.json();
            const operator = opJson.data ?? opJson;
            if (operator.compensationPercent) {
              const compAmount = trip.fareAmountAlgo * (operator.compensationPercent / 100);
              const totalRefund = trip.fareAmountAlgo + compAmount;
              setRefundEstimate(totalRefund);
            } else {
              setRefundEstimate(0);
            }
          }
        } catch (e) {
          console.error('Failed to calculate refund estimate', e);
          setRefundEstimate(0);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trip details');
    } finally {
      setLoading(false);
    }
  };

  /* ---- Actions (stubbed / implemented) ---- */
  const [manageDelayHours, setManageDelayHours] = useState(0);
  const [manageIsCancelled, setManageIsCancelled] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);

  // Fallback for traveler action
  const handleCancelTrip = () => {
    console.log('userCancel', { tripId, operatorAddress });
    setToast('Traveler cancellation coming soon!');
  };

  const handleClaimRefund = async () => {
    if (!accountAddress || !tripData) return;
    setManageLoading(true);
    setError(null);
    try {
      await claimRefundOnChain(
        peraWallet,
        accountAddress,
        tripData.tripId,
        tripData.operatorAddress
      );
      setToast('Refund claimed successfully! The ALGO has been credited to your wallet.');
      await fetchTrip();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to claim refund.');
    } finally {
      setManageLoading(false);
    }
  };

  const handleUpdateTrip = async () => {
    if (!accountAddress || !tripData) return;
    setManageLoading(true);
    setError(null);
    try {
      await updateTripStatusOnChain(
        peraWallet,
        accountAddress,
        tripData.tripId,
        manageDelayHours,
        manageIsCancelled
      );
      
      setToast(`Successfully updated Trip #${tripData.tripId} status!`);
      // Re-fetch to see the updated status
      fetchTrip();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update trip');
    } finally {
      setManageLoading(false);
    }
  };


  /* ---------------------------------------------------------------- */
  /*  Not connected                                                     */
  /* ---------------------------------------------------------------- */
  if (!accountAddress) {
    return (
      <div className="flex min-h-[55vh] flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/5 bg-slate-800 shadow-inner">
          <Plane className="h-9 w-9 text-slate-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-slate-200">Wallet Not Connected</h2>
          <p className="mt-1 text-sm text-slate-400">Please connect your Pera Wallet to view your trips.</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 shadow-lg shadow-teal-500/20">
          <Search className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">My Trips</h1>
          <p className="text-sm text-slate-400">Search for your booked flights and policies</p>
        </div>
      </div>

      {/* Look Up Form */}
      <div className="rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-xl space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="tripId" className="mb-2 block text-sm font-medium text-slate-300">Trip ID</label>
            <input
              id="tripId"
              type="number"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              placeholder="e.g. 1"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="operatorAddress" className="mb-2 block text-sm font-medium text-slate-300">Operator Address</label>
            <input
              id="operatorAddress"
              type="text"
              value={operatorAddress}
              onChange={(e) => setOperatorAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchTrip()}
              placeholder="Algorand address…"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors font-mono"
            />
          </div>
        </div>
        <button
          onClick={fetchTrip}
          disabled={loading || !operatorAddress.trim() || !tripId.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-700 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50 transition-colors border border-white/10"
        >
          {loading ? (
            <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
          ) : (
            <Search className="h-4 w-4" />
          )}
          Look Up Trip
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Trip Result Card */}
      {tripData && (
        <div className="rounded-2xl border border-white/10 bg-slate-800 shadow-xl overflow-hidden border-l-4 border-l-teal-500">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20">
                <Plane className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100">Trip #{tripData.tripId}</h3>
                <p className="font-mono text-[11px] text-slate-500">
                  {tripData.operatorAddress.slice(0, 10)}…{tripData.operatorAddress.slice(-6)}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              {/* Replace custom numeric badge with direct label string */}
              <span className="inline-flex items-center rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-semibold text-white">
                {tripData.tripStatusLabel}
              </span>
              {tripData.refundPaid && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-400 uppercase tracking-wide">
                  <CheckCircle2 className="h-3 w-3" />
                  Refund Paid
                </span>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/5 bg-slate-900 p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fare</p>
                <p className="mt-1 text-lg font-semibold text-slate-200">
                  {Number(tripData.fareAmountAlgo).toFixed(4)} <span className="text-xs font-normal text-slate-500">ALGO</span>
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-900 p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Premium</p>
                <p className="mt-1 text-lg font-semibold text-slate-200">
                  {Number(tripData.premiumAmountAlgo).toFixed(4)} <span className="text-xs font-normal text-slate-500">ALGO</span>
                </p>
              </div>
              <div className="rounded-xl border border-white/5 bg-slate-900 p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Delay</p>
                <p className="mt-1 text-lg font-semibold text-slate-200">
                  {tripData.delayHours} <span className="text-xs font-normal text-slate-500">hours</span>
                </p>
              </div>
            </div>

            {/* ACTION: Active -> Cancel Trip */}
            {tripData.tripStatus === 0 && (
              <button
                onClick={handleCancelTrip}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3.5 text-sm font-semibold text-red-500 hover:bg-red-500/20 transition-colors"
              >
                <XCircle className="h-4 w-4" />
                Cancel Trip
              </button>
            )}

            {/* ACTION: Delayed (1) & No Refund Paid -> Claim Refund */}
            {tripData.tripStatus === 1 && !tripData.refundPaid && refundEstimate !== null && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-teal-400" />
                    <p className="text-sm font-semibold text-teal-400">Refund Available</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-100">
                    {/* Assuming refundEstimate is already in ALGO based on the property name. If micro, we'd use microAlgoToAlgo */}
                    {refundEstimate.toFixed(4)} <span className="text-sm font-normal text-slate-400">ALGO</span>
                  </p>
                </div>
                <button
                  onClick={handleClaimRefund}
                  className="w-full sm:w-auto flex shrink-0 items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-teal-400 shadow-lg shadow-teal-500/25 hover:scale-[1.02] transition-all"
                >
                  <Coins className="h-4 w-4" />
                  Claim Refund
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Operator "Manage Trip" controls (only show if connected user IS the operator for this trip) */}
      {tripData && accountAddress === tripData.operatorAddress && (
        <div className="rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-xl mt-6">
          <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Settings className="h-5 w-5 text-teal-400" />
            Update Trip Status
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-400">Delay Hours</label>
              <input
                type="number"
                min="0"
                value={manageDelayHours}
                onChange={(e) => setManageDelayHours(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer mb-5 p-3 rounded-xl border border-white/5 bg-slate-900 hover:bg-slate-800/80 transition-colors">
            <div className="relative flex items-center">
              <input 
                type="checkbox"
                checked={manageIsCancelled}
                onChange={(e) => setManageIsCancelled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
            </div>
            <span className="text-sm font-medium text-slate-300">Is Flight Cancelled?</span>
          </label>

          <button
            onClick={handleUpdateTrip}
            disabled={manageLoading}
            className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
          >
            {manageLoading ? 'Updating Status...' : 'Update Status'}
          </button>
        </div>
      )}
    </div>
  );
}
