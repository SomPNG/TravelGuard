const express = require('express');
const router = express.Router();
const algorand = require('../services/algorand');
const { microAlgoToAlgo } = require('../utils/helpers');
const algosdk = require('algosdk');

// ─── GET /api/platform/info ────────────────────────────────────────
// Returns platform global state: platformBalance, totalTrips, platformOwner
router.get('/info', async (req, res, next) => {
  try {
    const globalState = await algorand.getGlobalState();

    const platformBalance = globalState.platformBalance ?? 0;
    const totalTrips = globalState.totalTrips ?? 0;
    const platformOwnerBytes = globalState.platformOwner;

    let platformOwner = null;
    if (platformOwnerBytes && platformOwnerBytes.length === 32) {
      platformOwner = algosdk.encodeAddress(new Uint8Array(platformOwnerBytes));
    }

    res.json({
      success: true,
      data: {
        platformBalance: Number(platformBalance),
        platformBalanceAlgo: microAlgoToAlgo(platformBalance),
        totalTrips: Number(totalTrips),
        platformOwner,
        appId: algorand.appId,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/platform/boxes ───────────────────────────────────────
// Lists all box names (useful for debugging / exploring state)
router.get('/boxes', async (req, res, next) => {
  try {
    const boxes = await algorand.getBoxNames();
    res.json({
      success: true,
      data: { count: boxes.length, boxes },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
