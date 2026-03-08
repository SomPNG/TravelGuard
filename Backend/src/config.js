require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 4000,
  algod: {
    server: process.env.ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
    port: parseInt(process.env.ALGOD_PORT, 10) || 443,
    token: process.env.ALGOD_TOKEN || '',
  },
  appId: parseInt(process.env.APP_ID, 10) || 756737231,
};
