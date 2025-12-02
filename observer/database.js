// Use createRequire to handle CommonJS module in ES module context
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sqlite3 = require('sqlite3');

import { config } from './config.js';

export class ObserverDatabase {
  constructor() {
    this.db = new sqlite3.Database(config.database.path);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS blocks (
        block_number INTEGER PRIMARY KEY,
        block_hash TEXT UNIQUE,
        timestamp INTEGER,
        processed BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS users (
        address TEXT PRIMARY KEY,
        name TEXT,
        role INTEGER,
        public_key TEXT,
        first_seen_block INTEGER,
        last_updated_block INTEGER
      );

      CREATE TABLE IF NOT EXISTS products (
        barcode TEXT PRIMARY KEY,
        name TEXT,
        manufacturer_name TEXT,
        manufactured_time TEXT,
        created_block INTEGER,
        created_tx_hash TEXT
      );

      CREATE TABLE IF NOT EXISTS user_inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT,
        barcode TEXT,
        volume INTEGER,
        last_updated_block INTEGER,
        last_updated_tx_hash TEXT,
        UNIQUE(user_address, barcode),
        FOREIGN KEY (user_address) REFERENCES users(address),
        FOREIGN KEY (barcode) REFERENCES products(barcode)
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT,
        barcode TEXT,
        from_address TEXT,
        to_address TEXT,
        volume INTEGER,
        block_number INTEGER,
        tx_hash TEXT,
        timestamp INTEGER,
        FOREIGN KEY (barcode) REFERENCES products(barcode),
        FOREIGN KEY (from_address) REFERENCES users(address),
        FOREIGN KEY (to_address) REFERENCES users(address)
      );

      CREATE INDEX IF NOT EXISTS idx_blocks_processed ON blocks(processed);
      CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_number);
      CREATE INDEX IF NOT EXISTS idx_tx_barcode ON transactions(barcode);
      CREATE INDEX IF NOT EXISTS idx_inventory_user ON user_inventory(user_address);
      CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON user_inventory(barcode);
    `);
  }

  async addBlock(block) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO blocks (block_number, block_hash, timestamp, processed) 
         VALUES (?, ?, ?, ?)`,
        [block.number, block.hash, block.timestamp, true],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async addUser(user, blockNumber) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO users (address, name, role, public_key, first_seen_block, last_updated_block)
         VALUES (?, ?, ?, ?, COALESCE((SELECT first_seen_block FROM users WHERE address = ?), ?), ?)`,
        [user.userAddress, user.name, user.role, user.publicKey, user.userAddress, blockNumber, blockNumber],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async addProduct(product, blockNumber, txHash) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO products (barcode, name, manufacturer_name, manufactured_time, created_block, created_tx_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [product.barcode, product.name, product.manufacturerName, product.manufacturedTime, blockNumber, txHash],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async updateUserInventory(userAddress, barcode, volume, blockNumber, txHash) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO user_inventory (user_address, barcode, volume, last_updated_block, last_updated_tx_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [userAddress, barcode, volume, blockNumber, txHash],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async removeUserInventory(userAddress, barcode) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `DELETE FROM user_inventory WHERE user_address = ? AND barcode = ?`,
        [userAddress, barcode],
        function(err) {
          if (err) reject(err);
          else resolve(this.changes);
        }
      );
    });
  }

  async getCurrentUserInventory(userAddress, barcode) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM user_inventory WHERE user_address = ? AND barcode = ?",
        [userAddress, barcode],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async addTransaction(eventType, barcode, fromAddress, toAddress, volume, blockNumber, txHash, timestamp) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO transactions (event_type, barcode, from_address, to_address, volume, block_number, tx_hash, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventType, barcode, fromAddress, toAddress, volume, blockNumber, txHash, timestamp],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  async getLatestBlock() {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT MAX(block_number) as latest_block FROM blocks",
        (err, row) => {
          if (err) reject(err);
          else resolve(row?.latest_block || config.blockchain.startBlock);
        }
      );
    });
  }

  async getUserInventory(userAddress, blockNumber = null) {
    return new Promise((resolve, reject) => {
      if (blockNumber) {
        // Historical inventory at specific block (not implemented in this simplified version)
        this.db.all(
          `SELECT p.*, ui.volume 
           FROM products p 
           JOIN user_inventory ui ON p.barcode = ui.barcode 
           WHERE ui.user_address = ?`,
          [userAddress],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      } else {
        // Current inventory
        this.db.all(
          `SELECT p.*, ui.volume 
           FROM products p 
           JOIN user_inventory ui ON p.barcode = ui.barcode 
           WHERE ui.user_address = ? AND ui.volume > 0`,
          [userAddress],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      }
    });
  }

  async getProductHistory(barcode) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM transactions WHERE barcode = ? ORDER BY block_number ASC`,
        [barcode],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getAllUsers() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM users", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getTransactionProof(blockNumber, txHash) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT t.*, b.block_hash 
         FROM transactions t 
         JOIN blocks b ON t.block_number = b.block_number 
         WHERE t.block_number = ? AND t.tx_hash = ?`,
        [blockNumber, txHash],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getProductAuditTrail(barcode) {
    const product = await this.getProduct(barcode);
    const transactions = await this.getProductHistory(barcode);
    const currentHolders = await this.getProductHolders(barcode);
    
    return {
      product,
      transactionHistory: transactions,
      currentHolders,
      totalTransactions: transactions.length
    };
  }

  async getProduct(barcode) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM products WHERE barcode = ?",
        [barcode],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  async getProductHolders(barcode) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT u.address, u.name, ui.volume 
         FROM user_inventory ui 
         JOIN users u ON ui.user_address = u.address 
         WHERE ui.barcode = ? AND ui.volume > 0`,
        [barcode],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getSupplyChainStats() {
    const users = await this.getAllUsers();
    const transactions = await this.getAllTransactions();
    const totalProducts = await this.getTotalProducts();
    
    // Calculate total inventory volume
    let totalInventoryVolume = 0;
    const allInventory = await this.getAllInventory();
    allInventory.forEach(item => {
      totalInventoryVolume += item.volume || 0;
    });
    
    return {
      totalUsers: users.length,
      totalTransactions: transactions.length,
      totalProducts: totalProducts,
      totalInventoryVolume: totalInventoryVolume,
      activeUsers: users.filter(u => u.last_updated_block > 0).length
    };
  }

  async getAllTransactions() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM transactions ORDER BY block_number ASC", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getTotalProducts() {
    return new Promise((resolve, reject) => {
      this.db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });
  }

  async getAllInventory() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT ui.user_address, ui.barcode, ui.volume 
         FROM user_inventory ui 
         WHERE ui.volume > 0`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async getAllProducts() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * FROM products", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}