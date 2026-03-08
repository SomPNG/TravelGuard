const algosdk = require('algosdk');
const config = require('../config');
const contractJson = require('../contract/TravelGuard.arc32.json');

// ─── ALGOD CLIENT ──────────────────────────────────────────────────
let _client = null;

function getAlgodClient() {
  if (!_client) {
    _client = new algosdk.Algodv2(config.algod.token, config.algod.server, config.algod.port);
  }
  return _client;
}

// ─── ABI CONTRACT ──────────────────────────────────────────────────
const contract = new algosdk.ABIContract(contractJson);

/**
 * Look up an ABI method by name.
 */
function getMethod(name) {
  const method = contract.methods.find((m) => m.name === name);
  if (!method) throw new Error(`ABI method "${name}" not found`);
  return method;
}

// ─── SIMULATE READONLY METHOD ──────────────────────────────────────

/**
 * Call a readonly ABI method via simulate (no signing required).
 * @param {string} methodName - Name of the readonly ABI method
 * @param {any[]} methodArgs - Arguments to pass (in JS native types)
 * @returns {Promise<any>} - The decoded return value
 */
async function callReadonly(methodName, methodArgs = []) {
  const client = getAlgodClient();
  const method = getMethod(methodName);

  // Use a dummy sender address since simulate doesn't need signing
  const sender = algosdk.generateAccount().addr;

  const suggestedParams = await client.getTransactionParams().do();

  const atc = new algosdk.AtomicTransactionComposer();
  atc.addMethodCall({
    appID: config.appId,
    method,
    methodArgs,
    sender,
    suggestedParams,
    signer: algosdk.makeEmptyTransactionSigner(),
  });

  // In algosdk v3, simulate requires explicit permission for unsigned txns
  const simRequest = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [],
    allowEmptySignatures: true,
    allowUnnamedResources: true,
  });

  const result = await atc.simulate(client, simRequest);

  // Check for simulation errors
  if (result.simulateResponse.txnGroups[0].failureMessage) {
    throw new Error(`Simulate failed: ${result.simulateResponse.txnGroups[0].failureMessage}`);
  }

  const methodResult = result.methodResults[0];
  return methodResult.returnValue;
}

// ─── GLOBAL STATE ──────────────────────────────────────────────────

/**
 * Read application global state directly from the Algod API.
 * Compatible with algosdk v3 (Uint8Array keys/values, camelCase properties).
 */
async function getGlobalState() {
  const client = getAlgodClient();
  const appInfo = await client.getApplicationByID(config.appId).do();
  const globalState = appInfo.params.globalState || [];

  const decoded = {};
  for (const kv of globalState) {
    // In algosdk v3, keys are Uint8Arrays
    const key = Buffer.from(kv.key).toString('utf8');
    if (kv.value.type === 2) {
      // uint64 — returned as BigInt in v3
      decoded[key] = Number(kv.value.uint);
    } else {
      // bytes — returned as Uint8Array in v3
      decoded[key] = kv.value.bytes;
    }
  }
  return decoded;
}

// ─── BOX READS ─────────────────────────────────────────────────────

/**
 * Get all box names for the application.
 */
async function getBoxNames() {
  const client = getAlgodClient();
  const response = await client.getApplicationBoxes(config.appId).do();
  return response.boxes.map((b) => ({
    nameRaw: b.name,
    nameBase64: Buffer.from(b.name).toString('base64'),
    nameHex: Buffer.from(b.name).toString('hex'),
  }));
}

/**
 * Read a raw box by name (Uint8Array key).
 * Returns the raw bytes or null if not found.
 */
async function readBox(boxName) {
  const client = getAlgodClient();
  try {
    const response = await client.getApplicationBoxByName(config.appId, boxName).do();
    return response.value; // Uint8Array
  } catch (err) {
    if (err.status === 404 || (err.message && err.message.includes('not found'))) {
      return null;
    }
    throw err;
  }
}

/**
 * Read an operator's box by their Algorand address.
 * Box key = 32-byte public key.
 */
async function readOperatorBox(address) {
  const pubKey = algosdk.decodeAddress(address).publicKey;
  return readBox(pubKey);
}

/**
 * Read a trip's box by operator address + trip ID.
 * Box key = concat(operatorPubKey, bigEndian(tripId)).
 */
async function readTripBox(operatorAddress, tripId) {
  const pubKey = algosdk.decodeAddress(operatorAddress).publicKey;
  const tripIdBytes = new Uint8Array(8);
  new DataView(tripIdBytes.buffer).setBigUint64(0, BigInt(tripId));
  const boxKey = new Uint8Array([...pubKey, ...tripIdBytes]);
  return readBox(boxKey);
}

module.exports = {
  getAlgodClient,
  contract,
  getMethod,
  callReadonly,
  getGlobalState,
  getBoxNames,
  readBox,
  readOperatorBox,
  readTripBox,
  appId: config.appId,
};

