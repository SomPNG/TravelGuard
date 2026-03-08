const express = require('express');
const router = express.Router();
const algosdk = require('algosdk');
const algorand = require('../services/algorand');
const { tripStatusLabel, microAlgoToAlgo } = require('../utils/helpers');

const { decodeTripRecord } = require('../utils/decode');

// ─── CONSTANTS ─────────────────────────────────────────────────────
const TRIP_ACTIVE = 0;
const TRIP_DELAYED = 1;

// ─── GET /api/trip/:tripId/:operatorAddress ────────────────────────
// Returns the TripRecord for a given trip ID + operator address
router.get('/:tripId/:operatorAddress', async (req, res, next) => {
  try {
    const { operatorAddress, tripId } = req.params;
    const tripIdNum = parseInt(tripId, 10);

    // Validate inputs
    if (!algosdk.isValidAddress(operatorAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid operator Algorand address',
      });
    }
    if (isNaN(tripIdNum) || tripIdNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Trip ID must be a positive integer',
      });
    }

    // Read trip box directly
    const rawBox = await algorand.readTripBox(operatorAddress, tripIdNum);
    if (!rawBox) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const decoded = decodeTripRecord(rawBox);

    res.json({
      success: true,
      data: {
        tripId: tripIdNum,
        operatorAddress: decoded.operatorAddress,
        travelerAddress: decoded.travelerAddress,
        fareAmount: decoded.fareAmount,
        fareAmountAlgo: microAlgoToAlgo(decoded.fareAmount),
        premiumAmount: decoded.premiumAmount,
        premiumAmountAlgo: microAlgoToAlgo(decoded.premiumAmount),
        tripStatus: decoded.tripStatus,
        tripStatusLabel: tripStatusLabel(decoded.tripStatus),
        delayHours: decoded.delayHours,
        refundPaid: decoded.refundPaid,
        deadlineRound: decoded.deadlineRound,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/trip/:tripId/:operatorAddress/refund-estimate ────────
// Returns the refund estimate for a trip
router.get('/:tripId/:operatorAddress/refund-estimate', async (req, res, next) => {
  try {
    const { operatorAddress, tripId } = req.params;
    const tripIdNum = parseInt(tripId, 10);

    // Validate inputs
    if (!algosdk.isValidAddress(operatorAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid operator Algorand address',
      });
    }
    if (isNaN(tripIdNum) || tripIdNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Trip ID must be a positive integer',
      });
    }

    // Read trip box directly
    const rawBox = await algorand.readTripBox(operatorAddress, tripIdNum);
    if (!rawBox) {
      return res.status(404).json({
        success: false,
        error: 'Trip not found',
      });
    }

    const trip = decodeTripRecord(rawBox);
    let refundEstimate = 0;

    // Calculate refund based on contract logic Calculate Refund Penalty
    if (trip.tripStatus === TRIP_ACTIVE) {
      // 10% penalty
      const penaltyAmount = Math.floor((trip.fareAmount * 10) / 100);
      refundEstimate = trip.fareAmount - penaltyAmount;
    } else if (trip.tripStatus === TRIP_DELAYED) {
      // Need current round to check if deadline passed
      const client = algorand.getAlgodClient();
      const status = await client.status().do();
      const currentRound = status['last-round'];

      if (currentRound > trip.deadlineRound) {
        refundEstimate = trip.fareAmount;
      }
    }

    res.json({
      success: true,
      data: {
        tripId: tripIdNum,
        operatorAddress,
        refundEstimate,
        refundEstimateAlgo: microAlgoToAlgo(refundEstimate),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
