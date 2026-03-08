import algosdk from 'algosdk';
import { PeraWalletConnect } from '@perawallet/connect';
import { APP_ID, ALGOD_SERVER, ALGOD_PORT } from '../config';

// ------------------------------------------------------------------ //
//  ABI – must exactly match the deployed TravelGuard contract          //
// ------------------------------------------------------------------ //
const TRAVELGUARD_ABI = {
  name: 'TravelGuard',
  methods: [
    {
      name: 'registerOperator',
      args: [
        { type: 'uint64', name: 'premiumPercent' },
        { type: 'uint64', name: 'compensationPercent' },
        { type: 'pay',    name: 'payment' },
      ],
      returns: { type: 'void' },
    },
    {
      name: 'bookTrip',
      args: [
        { type: 'uint64',  name: 'fare' },
        { type: 'byte[]',  name: 'operatorAddress' },
        { type: 'pay',     name: 'payment' },
      ],
      returns: { type: 'uint64' },
    },
    {
      name: 'updateTripStatus',
      args: [
        { type: 'uint64', name: 'tripId' },
        { type: 'byte[]', name: 'operatorAddress' },
        { type: 'uint64', name: 'newDelayHours' },
        { type: 'uint64', name: 'isCancelled' },
      ],
      returns: { type: 'void' },
    },
    {
      name: 'claimRefund',
      args: [
        { type: 'uint64', name: 'tripId' },
        { type: 'byte[]', name: 'operatorAddress' },
      ],
      returns: { type: 'void' },
    },
    {
      name: 'completeTrip',
      args: [
        { type: 'uint64', name: 'tripId' },
        { type: 'byte[]', name: 'operatorAddress' },
      ],
      returns: { type: 'void' },
    },
  ],
};

// MBR for a 33-byte box with 32-byte name: 2500 + 400*(32+33) = 28500
const BOX_MBR_MICROALGO = 31300; // 2500 + 400 * (32 + 40) for a 40-byte box with 32-byte name

// ------------------------------------------------------------------ //
//  registerOperatorOnChain                                             //
// ------------------------------------------------------------------ //
export async function registerOperatorOnChain(
  peraWallet: PeraWalletConnect,
  senderAddress: string,
  premiumPercent: number,
  compensationPercent: number,
  depositAlgo: number,
): Promise<void> {
  const algodClient = new algosdk.Algodv2('', ALGOD_SERVER, ALGOD_PORT);
  const sp = await algodClient.getTransactionParams().do();

  const depositMicroAlgo = Math.round(depositAlgo * 1_000_000);
  const totalPayment = depositMicroAlgo + BOX_MBR_MICROALGO; // deposit + box rent

  const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: senderAddress,
    receiver: algosdk.getApplicationAddress(APP_ID),
    amount: totalPayment,
    suggestedParams: sp,
  });

  const peraSigner: algosdk.TransactionSigner = async (txnGroup: algosdk.Transaction[], indexes: number[]) => {
    const txnsToSign = txnGroup.map((txn, i) => {
      if (indexes.includes(i)) {
        return { txn };          // Pera signs this one
      }
      return { txn, signers: [] as string[] }; // Pera skips this one
    });
    const signedTxns = await peraWallet.signTransaction([txnsToSign]);
    return signedTxns;
  };

  const appCallSp = { ...sp, flatFee: true, fee: 2000 };
  const contract = new algosdk.ABIContract(TRAVELGUARD_ABI);
  const atc = new algosdk.AtomicTransactionComposer();

  atc.addMethodCall({
    appID: APP_ID,
    method: contract.getMethodByName('registerOperator'),
    methodArgs: [
      premiumPercent,
      compensationPercent,
      { txn: paymentTxn, signer: peraSigner },
    ],
    sender: senderAddress,
    suggestedParams: appCallSp,
    signer: peraSigner,
    boxes: [
      { appIndex: 0, name: algosdk.decodeAddress(senderAddress).publicKey },
    ],
  });

  await atc.execute(algodClient, 4);
}

export async function bookTripOnChain(
  peraWallet: PeraWalletConnect,
  senderAddress: string,
  operatorAddress: string,
  fareAlgo: number,
  premiumAlgo: number
): Promise<number> {
  const client = new algosdk.Algodv2('', ALGOD_SERVER, ALGOD_PORT);
  const sp = await client.getTransactionParams().do();
  
  // 1. Send exactly fare + premium (No MBR because App account covers it)
  const fareMicroAlgo = Math.round(fareAlgo * 1_000_000);
  const premiumMicroAlgo = Math.round(premiumAlgo * 1_000_000);
  const totalPayment = fareMicroAlgo + premiumMicroAlgo;
  const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: senderAddress,
    receiver: algosdk.getApplicationAddress(APP_ID),
    amount: totalPayment,
    suggestedParams: sp,
  });
  
  const peraSigner = async (txnGroup: algosdk.Transaction[], indexes: number[]) => {
    const txnsToSign = txnGroup.map((txn, i) => {
      if (indexes.includes(i)) return { txn };
      return { txn, signers: [] as string[] };
    });
    return peraWallet.signTransaction([txnsToSign]);
  };
  const contract = new algosdk.ABIContract(TRAVELGUARD_ABI);
  
  // 2. We need to pass the explicit Trip box name to Algorand.
  // Let's fetch the actual totalTrips from the global state reliably:
  const stateResp = await client.getApplicationByID(APP_ID).do();
  let nextTripId = 1; // Default if it's the very first trip ever
  const gs = stateResp.params.globalState || [];
  
  // Search for the key "totalTrips" (algosdk v3 uses Uint8Arrays for keys)
  const totalTripsItem = gs.find((kv: any) => {
    // Some algosdk versions return string, some return Uint8Array
    const keyStr = typeof kv.key === 'string' 
      ? Buffer.from(kv.key, 'base64').toString() 
      : Buffer.from(kv.key).toString('utf-8');
    return keyStr === 'totalTrips';
  });
  
  if (totalTripsItem && totalTripsItem.value && totalTripsItem.value.uint !== undefined) {
    // algosdk v3 stores this as a BigInt directly
    nextTripId = Number(totalTripsItem.value.uint) + 1;
  }
  const operatorPubKey = algosdk.decodeAddress(operatorAddress).publicKey;
  
  // Convert nextTripId to 8-byte big-endian
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(nextTripId));
  const tripIdBytes = new Uint8Array(buffer);
  
  // Concat operator address + trip ID for the composite box name
  const tripBoxName = new Uint8Array(operatorPubKey.length + tripIdBytes.length);
  tripBoxName.set(operatorPubKey);
  tripBoxName.set(tripIdBytes, operatorPubKey.length);
  
  console.log('--- DEBUG BOOK TRIP ALGORAND ---');
  console.log('Global State totalTripsItem:', totalTripsItem);
  console.log('calculated nextTripId:', nextTripId);
  console.log('Hex Box Name:', Buffer.from(tripBoxName).toString('hex'));
  console.log('--------------------------------');

  const atc = new algosdk.AtomicTransactionComposer();
  atc.addMethodCall({
    appID: APP_ID,
    method: contract.getMethodByName('bookTrip'),
    methodArgs: [
      fareMicroAlgo,
      operatorPubKey,
      { txn: paymentTxn, signer: peraSigner },
    ],
    sender: senderAddress,
    suggestedParams: { ...sp, flatFee: true, fee: 2000 },
    signer: peraSigner,
    boxes: [
      { appIndex: 0, name: operatorPubKey }, // Operator Policy Box
      { appIndex: 0, name: tripBoxName }     // New Trip Box
    ],
  });
  await atc.execute(client, 4);
  return nextTripId;
}

// ------------------------------------------------------------------ //
//  updateTripStatusOnChain                                             //
// ------------------------------------------------------------------ //
export async function updateTripStatusOnChain(
  peraWallet: PeraWalletConnect,
  senderAddress: string,
  tripId: number,
  delayHours: number,
  isCancelled: boolean
): Promise<void> {
  const client = new algosdk.Algodv2('', ALGOD_SERVER, ALGOD_PORT);
  const sp = await client.getTransactionParams().do();
  
  const contract = new algosdk.ABIContract(TRAVELGUARD_ABI);
  const atc = new algosdk.AtomicTransactionComposer();
  
  // Box names
  const operatorPubKey = algosdk.decodeAddress(senderAddress).publicKey;
  
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(tripId));
  const tripIdBytes = new Uint8Array(buffer);
  
  const tripBoxName = new Uint8Array(operatorPubKey.length + tripIdBytes.length);
  tripBoxName.set(operatorPubKey);
  tripBoxName.set(tripIdBytes, operatorPubKey.length);
  
  const peraSigner = async (txnGroup: algosdk.Transaction[], indexes: number[]) => {
    const txnsToSign = txnGroup.map((txn, i) => {
      if (indexes.includes(i)) return { txn };
      return { txn, signers: [] as string[] };
    });
    return peraWallet.signTransaction([txnsToSign]);
  };
  
  atc.addMethodCall({
    appID: APP_ID,
    method: contract.getMethodByName('updateTripStatus'),
    methodArgs: [
      tripId,
      operatorPubKey,
      delayHours,
      isCancelled ? 1 : 0
    ],
    sender: senderAddress,
    suggestedParams: { ...sp, flatFee: true, fee: 2000 },
    signer: peraSigner,
    boxes: [
      { appIndex: 0, name: operatorPubKey }, // Need Operator box for compensation values
      { appIndex: 0, name: tripBoxName }     // Need Trip box to update status
    ],
  });
  
  await atc.execute(client, 4);
}

// ------------------------------------------------------------------ //
//  claimRefundOnChain                                                  //
// ------------------------------------------------------------------ //
export async function claimRefundOnChain(
  peraWallet: PeraWalletConnect,
  senderAddress: string,
  tripId: number,
  operatorAddress: string
): Promise<void> {
  const client = new algosdk.Algodv2('', ALGOD_SERVER, ALGOD_PORT);
  const sp = await client.getTransactionParams().do();
  
  const contract = new algosdk.ABIContract(TRAVELGUARD_ABI);
  const atc = new algosdk.AtomicTransactionComposer();
  
  // Box names
  const operatorPubKey = algosdk.decodeAddress(operatorAddress).publicKey;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(tripId));
  const tripIdBytes = new Uint8Array(buffer);
  
  const tripBoxName = new Uint8Array(operatorPubKey.length + tripIdBytes.length);
  tripBoxName.set(operatorPubKey);
  tripBoxName.set(tripIdBytes, operatorPubKey.length);
  
  const peraSigner = async (txnGroup: algosdk.Transaction[], indexes: number[]) => {
    const txnsToSign = txnGroup.map((txn, i) => {
      if (indexes.includes(i)) return { txn };
      return { txn, signers: [] as string[] };
    });
    return peraWallet.signTransaction([txnsToSign]);
  };
  
  atc.addMethodCall({
    appID: APP_ID,
    method: contract.getMethodByName('claimRefund'),
    methodArgs: [
      tripId,
      operatorPubKey
    ],
    sender: senderAddress,
    suggestedParams: { ...sp, flatFee: true, fee: 2000 }, // Fee covers inner refund txn
    signer: peraSigner,
    boxes: [
      { appIndex: 0, name: operatorPubKey }, // Box 1: Operator Policy
      { appIndex: 0, name: tripBoxName }     // Box 2: Trip State
    ],
  });
  
  await atc.execute(client, 4);
}

// ------------------------------------------------------------------ //
//  completeTripOnChain                                                 //
// ------------------------------------------------------------------ //
export async function completeTripOnChain(
  peraWallet: PeraWalletConnect,
  senderAddress: string, // the oracle/platform owner
  tripId: number,
  operatorAddress: string
): Promise<void> {
  const client = new algosdk.Algodv2('', ALGOD_SERVER, ALGOD_PORT);
  const sp = await client.getTransactionParams().do();
  
  const contract = new algosdk.ABIContract(TRAVELGUARD_ABI);
  const atc = new algosdk.AtomicTransactionComposer();
  
  const operatorPubKey = algosdk.decodeAddress(operatorAddress).publicKey;
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, BigInt(tripId));
  const tripIdBytes = new Uint8Array(buffer);
  
  const tripBoxName = new Uint8Array(operatorPubKey.length + tripIdBytes.length);
  tripBoxName.set(operatorPubKey);
  tripBoxName.set(tripIdBytes, operatorPubKey.length);
  
  const peraSigner = async (txnGroup: algosdk.Transaction[], indexes: number[]) => {
    const txnsToSign = txnGroup.map((txn, i) => {
      if (indexes.includes(i)) return { txn };
      return { txn, signers: [] as string[] };
    });
    return peraWallet.signTransaction([txnsToSign]);
  };
  
  atc.addMethodCall({
    appID: APP_ID,
    method: contract.getMethodByName('completeTrip'),
    methodArgs: [
      tripId,
      operatorPubKey
    ],
    sender: senderAddress,
    suggestedParams: { ...sp, flatFee: true, fee: 2000 },
    signer: peraSigner,
    boxes: [
      { appIndex: 0, name: operatorPubKey },
      { appIndex: 0, name: tripBoxName }
    ],
  });
  
  await atc.execute(client, 4);
}
