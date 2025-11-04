const EventListener = require('./eventListener');
const { abi } = require('../artifacts/contracts/SupplyChain.sol/SupplyChain.json');
require('dotenv').config();

async function start() {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  
  if (!contractAddress) {
    console.error('CONTRACT_ADDRESS not found in .env file. Please deploy contracts first.');
    process.exit(1);
  }

  const listener = new EventListener(contractAddress, abi, process.env.RPC_URL);
  
  try {
    await listener.startListening();
  } catch (error) {
    console.error('Failed to start event listener:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down event listener...');
    await listener.stopListening();
    process.exit(0);
  });
}

start();