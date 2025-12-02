import express from 'express';
import cors from 'cors';
import { BlockchainScanner } from './blockchain-scanner.js';
import { QueryEngine } from './query-engine.js';
import { config } from './config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

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

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await queryEngine.getSupplyChainStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
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

// NEW: Get all transactions (with optional limit)
app.get('/api/transactions', async (req, res) => {
  try {
    const { limit } = req.query;
    
    // Since queryEngine doesn't have getAllTransactions, use the database directly
    const db = queryEngine.db; // Access the db instance from queryEngine
    
    if (!db || !db.getAllTransactions) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const transactions = await db.getAllTransactions();
    
    // Apply limit if specified
    let result = transactions;
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        result = transactions.slice(-limitNum);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// NEW: Get all products
app.get('/api/products', async (req, res) => {
  try {
    const db = queryEngine.db; // Access the db instance from queryEngine
    
    if (!db || !db.getAllProducts) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    const products = await db.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve dashboard on root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(config.server.port, () => {
  console.log(`Observer service running on port ${config.server.port}`);
  console.log(`Dashboard available at: http://localhost:${config.server.port}`);
  initialize();
});