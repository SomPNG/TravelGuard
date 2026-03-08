const algosdk = require('algosdk');

async function diagnose() {
  const client = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', 443);
  const APP_ID = 756737231;

  // 1. List all boxes
  const boxesResp = await client.getApplicationBoxes(APP_ID).do();
  const boxes = boxesResp.boxes || [];
  console.log(`\n=== Boxes on App ${APP_ID} ===`);
  console.log(`Total boxes found: ${boxes.length}`);

  for (const box of boxes) {
    const name = box.name; // Uint8Array
    const nameHex = Buffer.from(name).toString('hex');
    const nameLen = name.length;

    // Try reading it
    try {
      const data = await client.getApplicationBoxByName(APP_ID, name).do();
      const value = data.value; // Uint8Array
      console.log(`\nBox: ${nameHex} (name length: ${nameLen})`);
      console.log(`  Value length: ${value.length} bytes`);
      console.log(`  Value hex: ${Buffer.from(value).toString('hex')}`);
      if (nameLen === 32) {
        try {
          const addr = algosdk.encodeAddress(new Uint8Array(name));
          console.log(`  → Address: ${addr}`);
        } catch(e) {}
      }
      if (value.length === 33) {
        const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
        console.log(`  Decoded as OperatorPolicy:`);
        console.log(`    depositBalance:      ${Number(view.getBigUint64(0))} microALGO`);
        console.log(`    premiumPercent:      ${Number(view.getBigUint64(8))}`);
        console.log(`    compensationPercent: ${Number(view.getBigUint64(16))}`);
        console.log(`    activeTrips:         ${Number(view.getBigUint64(24))}`);
        console.log(`    isRegistered:        ${(value[32] & 0x80) !== 0}`);
      }
    } catch (e) {
      console.log(`Box ${nameHex}: ERROR reading - ${e.message}`);
    }
  }

  if (boxes.length === 0) {
    console.log('No boxes exist on this app yet.');
    console.log('\n→ The "box_put wrong size 0 != 33" error is NOT from an existing box.');
    console.log('→ The issue is in how the transaction is being constructed.');
    console.log('→ The contract tries to box_create + box_put internally, but fails.');
  }
}

diagnose().catch(e => {
  console.error('Diagnosis failed:', e.message);
  process.exit(1);
});
