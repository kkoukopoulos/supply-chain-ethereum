import { ethers } from 'ethers';
import { config } from './config.js';
import { ObserverDatabase } from './database.js';
import { EventProcessor } from './event-processor.js';

export class BlockchainScanner {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.blockchain.rpcUrl);
    this.db = new ObserverDatabase();
    this.processor = new EventProcessor(this.db);
    this.isScanning = false;
    this.contractAddress = config.blockchain.contractAddress.toLowerCase();
  }

  async scanHistoricalBlocks() {
    if (this.isScanning) {
      console.log('Scan already in progress');
      return;
    }

    this.isScanning = true;
    try {
      const latestBlock = await this.db.getLatestBlock();
      const currentBlock = await this.provider.getBlockNumber();
      
      console.log(`Scanning blocks from ${latestBlock} to ${currentBlock}`);

      for (let blockNumber = latestBlock + 1; blockNumber <= currentBlock; blockNumber++) {
        await this.scanBlock(blockNumber);
        
        if (blockNumber % 100 === 0) {
          console.log(`Progress: ${blockNumber}/${currentBlock}`);
        }
      }

      console.log('Historical scan completed');
    } catch (error) {
      console.error('Error during historical scan:', error);
    } finally {
      this.isScanning = false;
    }
  }

  async scanBlock(blockNumber) {
    try {
      const block = await this.provider.getBlockWithTransactions(blockNumber);
      
      for (const tx of block.transactions) {
        // Skip contract creation transactions (no 'to' address)
        if (!tx.to) {
          continue;
        }

        // Check if transaction is to our contract
        if (tx.to.toLowerCase() === this.contractAddress) {
          await this.processTransaction(tx, block);
        }
      }

      await this.db.addBlock({
        number: block.number,
        hash: block.hash,
        timestamp: block.timestamp
      });

      console.log(`Successfully processed block ${blockNumber}`);

    } catch (error) {
      console.error(`Error scanning block ${blockNumber}:`, error.message);
    }
  }

  async processTransaction(tx, block) {
    try {
      const receipt = await this.provider.getTransactionReceipt(tx.hash);
      
      if (!receipt || !receipt.logs) {
        console.log(`No receipt or logs for transaction ${tx.hash}`);
        return;
      }
      
      for (const log of receipt.logs) {
        await this.processor.processLog(log, block, tx);
      }
    } catch (error) {
      console.error(`Error processing transaction ${tx.hash}:`, error.message);
    }
  }

  async startRealTimeMonitoring() {
    console.log('Starting real-time block monitoring');
    
    this.provider.on('block', async (blockNumber) => {
      console.log(`New block detected: ${blockNumber}`);
      try {
        await this.scanBlock(blockNumber);
      } catch (error) {
        console.error(`Error processing new block ${blockNumber}:`, error.message);
      }
    });

    this.provider.on('error', (error) => {
      console.error('Blockchain provider error:', error);
    });
  }

  async initialize() {
    try {
      // Test connection first
      const network = await this.provider.getNetwork();
      console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
      
      const currentBlock = await this.provider.getBlockNumber();
      console.log(`Current block: ${currentBlock}`);

      await this.scanHistoricalBlocks();
      await this.startRealTimeMonitoring();
    } catch (error) {
      console.error('Failed to initialize observer:', error.message);
    }
  }
}