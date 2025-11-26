import { ObserverDatabase } from './database.js';

export class QueryEngine {
  constructor() {
    this.db = new ObserverDatabase();
  }

  async getAllUsers() {
    return await this.db.getAllUsers();
  }

  async getUserInventory(userAddress, blockNumber = null) {
    return await this.db.getUserInventory(userAddress, blockNumber);
  }

  async getProductHistory(barcode) {
    return await this.db.getProductHistory(barcode);
  }

  async getTransactionProof(blockNumber, txHash) {
    return await this.db.getTransactionProof(blockNumber, txHash);
  }

  async getProductAuditTrail(barcode) {
    const product = await this.db.getProduct(barcode);
    const transactions = await this.db.getProductHistory(barcode);
    
    return {
      product,
      transactionHistory: transactions,
      currentOwner: product?.currentOwner,
      totalTransactions: transactions.length
    };
  }

  async getSupplyChainStats() {
    // Implementation for overall statistics
    const users = await this.getAllUsers();
    const transactions = await this.db.getAllTransactions();
    
    return {
      totalUsers: users.length,
      totalTransactions: transactions.length,
      totalProducts: await this.db.getTotalProducts(),
      activeUsers: users.filter(u => u.last_updated_block > 0).length
    };
  }
}