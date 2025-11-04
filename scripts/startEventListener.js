const EventListener = require('./eventListener');
require('dotenv').config();

async function start() {
  const listener = new EventListener(process.env.RPC_URL);
  
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