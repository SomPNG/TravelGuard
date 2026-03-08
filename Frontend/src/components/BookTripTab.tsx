import { useState, useEffect } from 'react';
import {
  Plane,
  Search,
  AlertCircle,
  ShieldCheck,
  Coins,
  Loader2,
  Wallet,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { BACKEND_URL } from '../config';
import { peraWallet, algoToMicroAlgo } from '../lib/algorand';
import { bookTripOnChain } from '../services/algorand';

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */
interface OperatorInfo {
  premiumPercent: number;
  compensationPercent: number;
  depositBalance?: number;
  activeTrips?: number;
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
/*  Main Component                                                      */
/* ------------------------------------------------------------------ */
export default function BookTripTab({ accountAddress }: { accountAddress: string | null }) {
  const [operatorAddress, setOperatorAddress] = useState('');
  const [fare, setFare] = useState('');

  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [operatorInfo, setOperatorInfo] = useState<OperatorInfo | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  /* ---- derived calculations ---- */
  const fareNum = Math.max(parseFloat(fare) || 0, 0);
  const premiumAmt = operatorInfo ? fareNum * operatorInfo.premiumPercent / 100 : 0;
  const totalCost = fareNum + premiumAmt;

  /* ---- Check Operator ---- */
  const handleCheckOperator = async () => {
    if (!operatorAddress.trim()) return;
    setCheckLoading(true);
    setCheckError(null);
    setOperatorInfo(null);
    setFare('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/operator/${operatorAddress.trim()}`);
      if (res.status === 404) throw new Error('Operator not found or not registered');
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      setOperatorInfo(json.data ?? json);
    } catch (err: unknown) {
      setCheckError(err instanceof Error ? err.message : 'Failed to fetch operator');
    } finally {
      setCheckLoading(false);
    }
  };

  /* ---- Book Trip ---- */
  const [bookLoading, setBookLoading] = useState(false);

  const handleBookTrip = async () => {
    if (!accountAddress || !operatorInfo || fareNum < 0.001) return;
    setBookLoading(true);
    setCheckError(null);
    try {
      const tripId = await bookTripOnChain(
        peraWallet,
        accountAddress,
        operatorAddress,
        fareNum,
        premiumAmt
      );

      setToast(`Trip booked successfully! Your Trip ID is ${tripId}`);
      setFare('');
    } catch (err: unknown) {
      setCheckError(err instanceof Error ? err.message : 'Failed to book trip');
    } finally {
      setBookLoading(false);
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
          <p className="mt-1 text-sm text-slate-400">Please connect your Pera Wallet to book a trip.</p>
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

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 shadow-lg shadow-teal-500/20">
          <Plane className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Book a Trip</h1>
          <p className="text-sm text-slate-400">Choose an operator and secure your journey</p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-white/10 bg-slate-800 p-6 shadow-xl space-y-6">

        {/* Step 1 — Operator Address */}
        <div>
          <label htmlFor="operatorAddressInput" className="mb-2 block text-sm font-medium text-slate-300">
            Operator Address
          </label>
          <div className="flex gap-3">
            <input
              id="operatorAddressInput"
              type="text"
              value={operatorAddress}
              onChange={(e) => { setOperatorAddress(e.target.value); setOperatorInfo(null); setCheckError(null); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckOperator()}
              placeholder="Enter Algorand operator address…"
              className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors font-mono"
            />
            <button
              id="checkOperatorBtn"
              onClick={handleCheckOperator}
              disabled={checkLoading || !operatorAddress.trim()}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-slate-700 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              {checkLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Check Operator
            </button>
          </div>
        </div>

        {/* Check error */}
        {checkError && (
          <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {checkError}
          </div>
        )}

        {/* Step 2 — Fare input (Always visible) */}
        <div>
          <label htmlFor="fareInput" className="mb-2 block text-sm font-medium text-slate-300">
            Fare Amount <span className="text-slate-500">(ALGO, min 0.001)</span>
          </label>
          <div className="relative">
            <input
              id="fareInput"
              type="number"
              min={0.001}
              step={0.001}
              value={fare}
              onChange={(e) => setFare(e.target.value)}
              placeholder="e.g. 5.000"
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 pr-16 text-sm text-slate-200 placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">ALGO</span>
          </div>
        </div>

        {/* Operator verified info */}
        {operatorInfo && (
          <div className="space-y-5 rounded-xl border border-teal-500/20 bg-teal-500/5 p-5">
            {/* Verified badge row */}
            <div className="flex items-center gap-2 text-teal-400">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-sm font-semibold">Operator Verified</span>
            </div>

            {/* Operator stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/5 bg-slate-900 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Premium Rate</p>
                <p className="mt-1 text-xl font-bold text-slate-100">{operatorInfo.premiumPercent}%</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-slate-900 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Compensation Rate</p>
                <p className="mt-1 text-xl font-bold text-slate-100">{operatorInfo.compensationPercent}%</p>
              </div>
            </div>

            {/* Cost formula hint */}
            <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/60 rounded-lg px-3 py-2 border border-white/5">
              <Coins className="h-3.5 w-3.5 shrink-0" />
              Total = Fare + (Fare × {operatorInfo.premiumPercent}%)
            </div>
          </div>
        )}

        {/* Cost breakdown — only shown once fareNum > 0 */}
        {fareNum > 0 && (
          <div className="rounded-xl border border-white/5 bg-slate-900 px-4 py-3 space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-400">
              <span>Base Fare</span>
              <span>{fareNum.toFixed(4)} ALGO</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Insurance Premium ({operatorInfo ? operatorInfo.premiumPercent : 0}%)</span>
              <span>+ {premiumAmt.toFixed(4)} ALGO</span>
            </div>
            <div className="flex items-center justify-between border-t border-white/5 pt-2 font-semibold text-slate-200">
              <span>Calculated Total</span>
              <span className="text-teal-400 text-base">{totalCost.toFixed(4)} ALGO</span>
            </div>
          </div>
        )}

        {/* Book Trip button */}
        <button
          id="bookTripBtn"
          onClick={handleBookTrip}
          disabled={fareNum < 0.001 || !operatorInfo || bookLoading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/25 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-all cursor-pointer"
        >
          {bookLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {bookLoading ? 'Booking Trip...' : 'Book Trip'}
          {!bookLoading && <ArrowRight className="h-4 w-4 ml-1" />}
        </button>
      </div>
    </div>
  );
}
