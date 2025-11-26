import express from 'express';
import cors from 'cors';
import { BlockchainScanner } from './blockchain-scanner.js';
import { QueryEngine } from './query-engine.js';
import { config } from './config.js';

const app = express();
app.use(cors());
app.use(express.json());

const scanner = new BlockchainScanner();
const queryEngine = new QueryEngine();

// Initialize the observer
async function initialize() {
  try {
    await scanner.initialize();
    console.log('Observer service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize observer service:', error.message);
  }
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await queryEngine.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:address/inventory', async (req, res) => {
  try {
    const { address } = req.params;
    const { block } = req.query;
    
    const inventory = await queryEngine.getUserInventory(address, block);
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:barcode/history', async (req, res) => {
  try {
    const { barcode } = req.params;
    const history = await queryEngine.getProductHistory(barcode);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions/proof', async (req, res) => {
  try {
    const { blockNumber, txHash } = req.query;
    const proof = await queryEngine.getTransactionProof(blockNumber, txHash);
    
    if (!proof) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    res.json(proof);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit/product/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;
    const audit = await queryEngine.getProductAuditTrail(barcode);
    res.json(audit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(config.server.port, () => {
  console.log(`Observer service running on port ${config.server.port}`);
  initialize();
});