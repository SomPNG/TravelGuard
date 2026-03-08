const algosdk = require('algosdk');

// ─── OPERATOR POLICY BOX (40 bytes) ───────────────────────────────
// AVM native layout (bool stored as full uint64, not ARC-4 1-byte):
//   [0:8]   depositBalance      (uint64)
//   [8:16]  premiumPercent      (uint64)
//   [16:24] compensationPercent (uint64)
//   [24:32] activeTrips         (uint64)
//   [32:40] isRegistered        (uint64: 0=false, 1=true)

const OPERATOR_BOX_SIZE = 40;

function decodeOperatorPolicy(raw) {
  if (!raw || raw.byteLength < OPERATOR_BOX_SIZE) {
    throw new Error(
      `Operator box too small: expected ${OPERATOR_BOX_SIZE} bytes, got ${raw?.byteLength ?? 0}. ` +
      `Raw (hex): ${raw ? Buffer.from(raw).toString('hex') : 'null'}`
    );
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  return {
    depositBalance:      Number(view.getBigUint64(0)),
    premiumPercent:      Number(view.getBigUint64(8)),
    compensationPercent: Number(view.getBigUint64(16)),
    activeTrips:         Number(view.getBigUint64(24)),
    isRegistered:        Number(view.getBigUint64(32)) !== 0,
  };
}

// ─── TRIP RECORD BOX (120 bytes) ──────────────────────────────────
// ABI tuple: (byte[], byte[], uint64, uint64, uint64, uint64, uint64, uint64)
// Static head (52 bytes):
//   [0:2]   offset to traveler data   (uint16)
//   [2:4]   offset to operator data   (uint16)
//   [4:12]  fareAmount                (uint64)
//   [12:20] premiumAmount             (uint64)
//   [20:28] tripStatus                (uint64)
//   [28:36] delayHours                (uint64)
//   [36:44] refundPaid                (uint64 - full 8 bytes now)
//   [44:52] deadlineRound             (uint64)
// Dynamic tail:
//   [52:54] traveler length (uint16)  → always 32
//   [54:86] traveler bytes            (32 bytes)
//   [86:88] operator length (uint16)  → always 32
//   [88:120] operator bytes           (32 bytes)

const TRIP_BOX_SIZE = 120;

function decodeTripRecord(raw) {
  if (!raw || raw.byteLength < TRIP_BOX_SIZE) {
    throw new Error(
      `Trip box too small: expected ${TRIP_BOX_SIZE} bytes, got ${raw?.byteLength ?? 0}. ` +
      `Raw (hex): ${raw ? Buffer.from(raw).toString('hex') : 'null'}`
    );
  }
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);

  const fareAmount    = Number(view.getBigUint64(4));
  const premiumAmount = Number(view.getBigUint64(12));
  const tripStatus    = Number(view.getBigUint64(20));
  const delayHours    = Number(view.getBigUint64(28));
  const refundPaid    = Number(view.getBigUint64(36)) !== 0;
  const deadlineRound = Number(view.getBigUint64(44));

  // Decode dynamic byte[] fields
  // Traveler starts at 52 (2 bytes length + 32 bytes data) -> data is 54 to 86
  const travelerBytes = raw.slice(54, 86);
  // Operator starts at 86 (2 bytes length + 32 bytes data) -> data is 88 to 120
  const operatorBytes = raw.slice(88, 120);

  let travelerAddress = null;
  let operatorAddress = null;
  try { travelerAddress = algosdk.encodeAddress(travelerBytes); } catch (_) {}
  try { operatorAddress = algosdk.encodeAddress(operatorBytes); } catch (_) {}

  return {
    travelerAddress,
    operatorAddress,
    fareAmount,
    premiumAmount,
    tripStatus,
    delayHours,
    refundPaid,
    deadlineRound,
  };
}

module.exports = { decodeOperatorPolicy, decodeTripRecord };
