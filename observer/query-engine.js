import { ObserverDatabase } from './database.js';

export class QueryEngine {
  constructor() {
    this.db = new ObserverDatabase();
  }

  async getAllUsers() {
    return await this.db.getAllUsers();
  }

  async getUserInventory(userAddress, blockNumber = null) {
    const inventory = await this.db.getUserInventory(userAddress, blockNumber);
    
    // Transform to match expected format
    return inventory.map(item => ({
      name: item.name,
      manufacturerName: item.manufacturer_name,
      barcode: item.barcode,
      manufacturedTime: item.manufactured_time,
      volume: item.volume || 0
    }));
  }

  async getProductHistory(barcode) {
    return await this.db.getProductHistory(barcode);
  }

  async getTransactionProof(blockNumber, txHash) {
    return await this.db.getTransactionProof(blockNumber, txHash);
  }

  async getProductAuditTrail(barcode) {
    const audit = await this.db.getProductAuditTrail(barcode);
    
    // Transform to match expected format
    return {
      product: {
        barcode: audit.product?.barcode,
        name: audit.product?.name,
        manufacturerName: audit.product?.manufacturer_name,
        manufacturedTime: audit.product?.manufactured_time,
        volume: audit.currentHolders?.reduce((total, holder) => total + (holder.volume || 0), 0) || 0
      },
      transactionHistory: audit.transactionHistory,
      currentHolders: audit.currentHolders,
      totalTransactions: audit.totalTransactions
    };
  }

  async getSupplyChainStats() {
    const users = await this.getAllUsers();
    const transactions = await this.db.getAllTransactions();
    
    // Calculate total inventory volume across all users
    let totalInventoryVolume = 0;
    for (const user of users) {
      const inventory = await this.getUserInventory(user.address);
      totalInventoryVolume += inventory.reduce((sum, item) => sum + (item.volume || 0), 0);
    }
    
    return {
      totalUsers: users.length,
      totalTransactions: transactions.length,
      totalProducts: await this.db.getTotalProducts(),
      totalInventoryVolume: totalInventoryVolume,
      activeUsers: users.filter(u => u.last_updated_block > 0).length
    };
  }
}