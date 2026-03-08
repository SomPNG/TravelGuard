const express = require('express');
const router = express.Router();
const algosdk = require('algosdk');
const algorand = require('../services/algorand');
const { microAlgoToAlgo } = require('../utils/helpers');

const { decodeOperatorPolicy } = require('../utils/decode');

// ─── GET /api/operator/:address ────────────────────────────────────
// Returns the OperatorPolicy for the given Algorand address
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;

    // Validate Algorand address
    if (!algosdk.isValidAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Algorand address',
      });
    }

    // Read box directly
    const rawBox = await algorand.readOperatorBox(address);
    if (!rawBox) {
      return res.status(404).json({
        success: false,
        error: 'Operator not found',
      });
    }

    const decoded = decodeOperatorPolicy(rawBox);

    res.json({
      success: true,
      data: {
        address,
        depositBalance: decoded.depositBalance,
        depositBalanceAlgo: microAlgoToAlgo(decoded.depositBalance),
        premiumPercent: decoded.premiumPercent,
        compensationPercent: decoded.compensationPercent,
        activeTrips: decoded.activeTrips,
        isRegistered: decoded.isRegistered,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
