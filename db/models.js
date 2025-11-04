const { query } = require('./config');

class DatabaseModels {
  
  // User operations
  static async upsertUser(userAddress, name, role) {
    const text = `
      INSERT INTO users (user_address, name, role) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (user_address) 
      DO UPDATE SET name = $2, role = $3, last_active = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    return await query(text, [userAddress, name, role]);
  }

  static async getUser(userAddress) {
    const text = 'SELECT * FROM users WHERE user_address = $1';
    return await query(text, [userAddress]);
  }

  // Product operations
  static async insertProduct(productData) {
    const text = `
      INSERT INTO products (barcode, name, manufacturer_name, manufactured_time, blockchain_created_block) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *;
    `;
    const values = [
      productData.barcode,
      productData.name,
      productData.manufacturerName,
      productData.manufacturedTime,
      productData.blockNumber
    ];
    return await query(text, values);
  }

  static async getProduct(barcode) {
    const text = `
      SELECT p.*, u.name as manufacturer_name 
      FROM products p 
      JOIN users u ON p.manufacturer_address = u.user_address 
      WHERE barcode = $1;
    `;
    return await query(text, [barcode]);
  }

  // Product history operations
  static async insertProductHistory(historyData) {
    const text = `
      INSERT INTO product_history 
      (barcode, owner_address, timestamp, blockchain_timestamp, transaction_hash, block_number) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *;
    `;
    const values = [
      historyData.barcode,
      historyData.owner,
      new Date(historyData.timestamp * 1000), // Convert to JS Date
      historyData.timestamp,
      historyData.transactionHash,
      historyData.blockNumber
    ];
    return await query(text, values);
  }

  static async getProductHistory(barcode) {
    const text = `
      SELECT ph.*, u.name as owner_name, u.role as owner_role
      FROM product_history ph
      JOIN users u ON ph.owner_address = u.user_address
      WHERE barcode = $1
      ORDER BY ph.timestamp ASC;
    `;
    return await query(text, [barcode]);
  }

  // Event logging
  static async logEvent(eventData) {
    const text = `
      INSERT INTO events_log 
      (event_name, contract_address, transaction_hash, block_number, event_data) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING *;
    `;
    const values = [
      eventData.eventName,
      eventData.contractAddress,
      eventData.transactionHash,
      eventData.blockNumber,
      eventData.eventData
    ];
    return await query(text, values);
  }

  // Analytics queries
  static async getSupplyChainMetrics(barcode) {
    const text = `
      SELECT 
        COUNT(*) as total_transfers,
        MIN(timestamp) as first_transfer,
        MAX(timestamp) as last_transfer,
        COUNT(DISTINCT owner_address) as unique_owners
      FROM product_history 
      WHERE barcode = $1;
    `;
    return await query(text, [barcode]);
  }

  static async getUserStats(userAddress) {
    const text = `
      SELECT 
        u.*,
        COUNT(DISTINCT ph.barcode) as total_products_handled,
        COUNT(ph.id) as total_transactions
      FROM users u
      LEFT JOIN product_history ph ON u.user_address = ph.owner_address
      WHERE u.user_address = $1
      GROUP BY u.id;
    `;
    return await query(text, [userAddress]);
  }
}

module.exports = DatabaseModels;