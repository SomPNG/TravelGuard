import algosdk from 'algosdk';
import { PeraWalletConnect } from '@perawallet/connect';

export const APP_ID = 756737231;
export const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
export const ALGOD_PORT = 443;
export const ALGOD_TOKEN = '';

export const client = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

export const peraWallet = new PeraWalletConnect({
  shouldShowSignTxnToast: false,
});

export const ABI_JSON = {
  "name": "TravelGuard",
  "methods": [
    { "name": "registerOperator", "args": [{"type":"uint64","name":"premiumPercent"},{"type":"uint64","name":"compensationPercent"},{"type":"pay","name":"payment"}], "returns": {"type":"void"} },
    { "name": "bookTrip", "args": [{"type":"uint64","name":"fare"},{"type":"byte[]","name":"operatorAddress"},{"type":"pay","name":"payment"}], "returns": {"type":"uint64"} },
    { "name": "userCancel", "args": [{"type":"uint64","name":"tripId"},{"type":"byte[]","name":"operatorAddress"}], "returns": {"type":"void"} },
    { "name": "updateTripStatus", "args": [{"type":"uint64","name":"tripId"},{"type":"byte[]","name":"operatorAddress"},{"type":"uint64","name":"newDelayHours"},{"type":"bool","name":"isCancelled"}], "returns": {"type":"void"} },
    { "name": "claimRefund", "args": [{"type":"uint64","name":"tripId"},{"type":"byte[]","name":"operatorAddress"}], "returns": {"type":"void"} },
    { "name": "completeTrip", "args": [{"type":"uint64","name":"tripId"},{"type":"byte[]","name":"operatorAddress"}], "returns": {"type":"void"} }
  ]
};

export const contract = new algosdk.ABIContract(ABI_JSON);

export function getOperatorBox(address: string) {
  return {
    appIndex: 0,
    name: algosdk.decodeAddress(address).publicKey
  };
}

export function getTripBox(operatorAddress: string, tripId: number) {
  const pubKey = algosdk.decodeAddress(operatorAddress).publicKey;
  const tripIdBytes = new Uint8Array(8);
  new DataView(tripIdBytes.buffer).setBigUint64(0, BigInt(tripId));
  const boxKey = new Uint8Array([...pubKey, ...tripIdBytes]);
  return {
    appIndex: 0,
    name: boxKey
  };
}

export function truncateAddress(address: string) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function microAlgoToAlgo(microAlgo: number) {
  return microAlgo / 1_000_000;
}

export function algoToMicroAlgo(algo: number) {
  return Math.floor(algo * 1_000_000);
}

/* ------------------------------------------------------------------ */
/*  Box Decoders                                                        */
/* ------------------------------------------------------------------ */

/** Hex-dump a Uint8Array for debugging (e.g. "0a1b2c..."). */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build a DataView that is correctly anchored to the slice.
 * Guards against byteOffset + byteLength > raw.buffer.byteLength.
 */
function safeDataView(raw: Uint8Array): DataView {
  if (raw.byteOffset + raw.byteLength > raw.buffer.byteLength) {
    throw new RangeError(
      `Box buffer slice is invalid: byteOffset=${raw.byteOffset}, byteLength=${raw.byteLength}, ` +
      `buffer.byteLength=${raw.buffer.byteLength}`
    );
  }
  return new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
}

/**
 * Operator box layout (33 bytes):
 *  [0..7]   depositBalance      (uint64, big-endian)
 *  [8..15]  premiumPercent      (uint64, big-endian)
 *  [16..23] compensationPercent (uint64, big-endian)
 *  [24..31] activeTrips         (uint64, big-endian)
 *  [32]     flags byte — bit7 = isRegistered
 */
export interface OperatorPolicy {
  depositBalance: number;
  premiumPercent: number;
  compensationPercent: number;
  activeTrips: number;
  isRegistered: boolean;
}

const OPERATOR_BOX_SIZE = 33;

export function decodeOperatorPolicy(raw: Uint8Array): OperatorPolicy {
  if (raw.byteLength < OPERATOR_BOX_SIZE) {
    throw new RangeError(
      `decodeOperatorPolicy: expected ${OPERATOR_BOX_SIZE} bytes, got ${raw.byteLength}. ` +
      `hex=${toHex(raw)}`
    );
  }
  const view = safeDataView(raw);
  return {
    depositBalance:      Number(view.getBigUint64(0)),
    premiumPercent:      Number(view.getBigUint64(8)),
    compensationPercent: Number(view.getBigUint64(16)),
    activeTrips:         Number(view.getBigUint64(24)),
    isRegistered:        (raw[32] & 0x80) !== 0,
  };
}

/**
 * Trip box layout (113 bytes):
 *  [0..7]   tripId              (uint64, big-endian)
 *  [8..39]  travelerAddress     (32-byte public key)
 *  [40..47] fareAmount          (uint64, big-endian, microAlgo)
 *  [48..55] premiumAmount       (uint64, big-endian, microAlgo)
 *  [56..63] delayHours          (uint64, big-endian)
 *  [64]     tripStatus          (uint8: 0=Active 1=Delayed 2=Cancelled 3=Completed)
 *  [65]     refundPaid          (uint8: 0=false, 1=true)
 *  [66..112] reserved / padding
 */
export interface TripRecord {
  tripId: number;
  travelerAddress: string;
  fareAmount: number;
  premiumAmount: number;
  delayHours: number;
  tripStatus: number;
  refundPaid: boolean;
}

const TRIP_BOX_SIZE = 113;

export function decodeTripRecord(raw: Uint8Array): TripRecord {
  if (raw.byteLength < TRIP_BOX_SIZE) {
    throw new RangeError(
      `decodeTripRecord: expected ${TRIP_BOX_SIZE} bytes, got ${raw.byteLength}. ` +
      `hex=${toHex(raw)}`
    );
  }
  const view = safeDataView(raw);
  const travelerPubKey = raw.slice(8, 40);
  const travelerAddress = algosdk.encodeAddress(travelerPubKey);
  return {
    tripId:         Number(view.getBigUint64(0)),
    travelerAddress,
    fareAmount:     Number(view.getBigUint64(40)),
    premiumAmount:  Number(view.getBigUint64(48)),
    delayHours:     Number(view.getBigUint64(56)),
    tripStatus:     raw[64],
    refundPaid:     raw[65] !== 0,
  };
}

