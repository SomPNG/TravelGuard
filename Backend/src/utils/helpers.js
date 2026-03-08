const TRIP_STATUS = {
  0: 'ACTIVE',
  1: 'DELAYED',
  2: 'OPERATOR_CANCELLED',
  3: 'COMPLETED',
};

/**
 * Convert a status code to a human-readable label.
 */
function tripStatusLabel(code) {
  return TRIP_STATUS[code] || 'UNKNOWN';
}

/**
 * Convert microALGO to ALGO (for display convenience).
 */
function microAlgoToAlgo(microAlgo) {
  return Number(microAlgo) / 1_000_000;
}

module.exports = {
  tripStatusLabel,
  microAlgoToAlgo,
  TRIP_STATUS,
};
