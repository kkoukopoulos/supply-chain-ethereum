import sqlite3 from 'sqlite3';
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
        volume INTEGER,
        current_owner TEXT,
        created_block INTEGER,
        created_tx_hash TEXT,
        FOREIGN KEY (current_owner) REFERENCES users(address)
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

      CREATE TABLE IF NOT EXISTS inventory_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_address TEXT,
        barcode TEXT,
        volume INTEGER,
        block_number INTEGER,
        timestamp INTEGER,
        FOREIGN KEY (user_address) REFERENCES users(address),
        FOREIGN KEY (barcode) REFERENCES products(barcode)
      );

      CREATE INDEX IF NOT EXISTS idx_blocks_processed ON blocks(processed);
      CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_number);
      CREATE INDEX IF NOT EXISTS idx_tx_barcode ON transactions(barcode);
      CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_snapshots(user_address);
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
        `INSERT OR REPLACE INTO products (barcode, name, manufacturer_name, manufactured_time, volume, current_owner, created_block, created_tx_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [product.barcode, product.name, product.manufacturerName, product.manufacturedTime, product.volume, product.currentOwner, blockNumber, txHash],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
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
      const query = blockNumber 
        ? `SELECT p.* FROM products p 
           JOIN transactions t ON p.barcode = t.barcode 
           WHERE t.to_address = ? AND t.block_number <= ? 
           GROUP BY p.barcode 
           HAVING MAX(t.block_number)`
        : `SELECT * FROM products WHERE current_owner = ?`;
      
      this.db.all(query, [userAddress], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
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
      else resolve(row.count);
    });
  });
}
}