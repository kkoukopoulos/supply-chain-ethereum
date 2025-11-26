import { ethers } from 'ethers';
import { config } from './config.js';

// Contract ABIs for event parsing
const SupplyChainABI = [
  "event NewProduct(address manufacturer, string name, string manufacturerName, string barcode, string manufacturedTime, uint256 volume)",
  "event ProductSold(string barcode, address buyer, address seller, uint256 transferTime, uint256 volume)"
];

const UsersABI = [
  "event NewUser(address userAddress, string name, uint8 role, string publicKey)"
];

export class EventProcessor {
  constructor(db) {
    this.db = db;
    this.supplyChainInterface = new ethers.utils.Interface(SupplyChainABI);
    this.usersInterface = new ethers.utils.Interface(UsersABI);
  }

  async processLog(log, block, tx) {
    try {
      // Skip if no address or not our contract (optional filter)
      if (!log.address) {
        return;
      }

      // Try to parse as SupplyChain event
      try {
        const parsedLog = this.supplyChainInterface.parseLog(log);
        await this.handleSupplyChainEvent(parsedLog, block, tx);
        return;
      } catch (e) {
        // Not a SupplyChain event, continue to next parser
      }

      // Try to parse as Users event
      try {
        const parsedLog = this.usersInterface.parseLog(log);
        await this.handleUsersEvent(parsedLog, block, tx);
        return;
      } catch (e) {
        // Not a Users event
      }

    } catch (error) {
      console.error('Error processing log:', error.message);
    }
  }

  async handleSupplyChainEvent(parsedLog, block, tx) {
    const { name, args } = parsedLog;

    try {
      switch (name) {
        case 'NewProduct':
          await this.handleNewProduct(args, block, tx);
          break;
        case 'ProductSold':
          await this.handleProductSold(args, block, tx);
          break;
        default:
          console.log(`Unknown SupplyChain event: ${name}`);
      }
    } catch (error) {
      console.error(`Error handling SupplyChain event ${name}:`, error.message);
    }
  }

  async handleUsersEvent(parsedLog, block, tx) {
    const { name, args } = parsedLog;

    try {
      if (name === 'NewUser') {
        await this.handleNewUser(args, block.number);
      } else {
        console.log(`Unknown Users event: ${name}`);
      }
    } catch (error) {
      console.error(`Error handling Users event ${name}:`, error.message);
    }
  }

  async handleNewUser(args, blockNumber) {
    try {
      const user = {
        userAddress: args.userAddress,
        name: args.name,
        role: args.role,
        publicKey: args.publicKey
      };

      await this.db.addUser(user, blockNumber);
      console.log(`New user registered: ${user.name} (${user.userAddress})`);
    } catch (error) {
      console.error('Error handling NewUser event:', error.message);
    }
  }

  async handleNewProduct(args, block, tx) {
    try {
      const product = {
        barcode: args.barcode,
        name: args.name,
        manufacturerName: args.manufacturerName,
        manufacturedTime: args.manufacturedTime,
        volume: args.volume.toString(),
        currentOwner: args.manufacturer
      };

      await this.db.addProduct(product, block.number, tx.hash);
      await this.db.addTransaction(
        'NewProduct',
        args.barcode,
        null, // from
        args.manufacturer, // to
        args.volume.toString(),
        block.number,
        tx.hash,
        block.timestamp
      );

      console.log(`New product registered: ${product.name} (${product.barcode})`);
    } catch (error) {
      console.error('Error handling NewProduct event:', error.message);
    }
  }

  async handleProductSold(args, block, tx) {
    try {
      await this.db.addTransaction(
        'ProductSold',
        args.barcode,
        args.seller,
        args.buyer,
        args.volume.toString(),
        block.number,
        tx.hash,
        block.timestamp
      );

      console.log(`Product sold: ${args.barcode} from ${args.seller} to ${args.buyer}, volume: ${args.volume}`);
    } catch (error) {
      console.error('Error handling ProductSold event:', error.message);
    }
  }
}