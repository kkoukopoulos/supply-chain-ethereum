export const config = {
  blockchain: {
    rpcUrl: process.env.RPC_URL || "http://localhost:8545",
    contractAddress: process.env.CONTRACT_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    startBlock: parseInt(process.env.START_BLOCK) || 0
  },
  database: {
    path: process.env.DB_PATH || "./observer.db"
  },
  server: {
    port: parseInt(process.env.PORT) || 3001
  }
};