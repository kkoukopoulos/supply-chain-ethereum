import { ethers } from 'ethers';
import { config } from './config.js';

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
      // Try to parse as SupplyChain event
      try {
        const parsedLog = this.supplyChainInterface.parseLog(log);
        await this.handleSupplyChainEvent(parsedLog, block, tx);
        return;
      } catch (e) {
        // Not a SupplyChain event
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
      // Add product to products table
      await this.db.addProduct({
        barcode: args.barcode,
        name: args.name,
        manufacturerName: args.manufacturerName,
        manufacturedTime: args.manufacturedTime
      }, block.number, tx.hash);

      // Add initial inventory for manufacturer
      await this.db.updateUserInventory(
        args.manufacturer,
        args.barcode,
        args.volume.toString(),
        block.number,
        tx.hash
      );

      // Add transaction record
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

      console.log(`New product registered: ${args.name} (${args.barcode}) - Volume: ${args.volume} owned by ${args.manufacturer}`);
    } catch (error) {
      console.error('Error handling NewProduct event:', error.message);
    }
  }

  async handleProductSold(args, block, tx) {
    try {
      // First, get current volumes
      // In a real implementation, we'd query the blockchain for current state
      // For now, we'll track it in our database as we process events in order
      
      // Update seller's inventory (reduce volume)
      await this.updateSellerInventory(args.seller, args.barcode, args.volume, block, tx);
      
      // Update buyer's inventory (add volume)
      await this.updateBuyerInventory(args.buyer, args.barcode, args.volume, block, tx);

      // Add transaction record
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

      console.log(`Product sold: ${args.barcode} - ${args.volume} units from ${args.seller} to ${args.buyer}`);
    } catch (error) {
      console.error('Error handling ProductSold event:', error.message);
    }
  }

  async updateSellerInventory(seller, barcode, volumeToSell, block, tx) {
    try {
      // Get current seller inventory
      const sellerInventory = await this.db.getUserInventory(seller);
      const product = sellerInventory.find(item => item.barcode === barcode);
      
      if (product) {
        const currentVolume = parseInt(product.volume);
        const newVolume = currentVolume - parseInt(volumeToSell);
        
        if (newVolume > 0) {
          // Update seller's inventory with reduced volume
          await this.db.updateUserInventory(
            seller,
            barcode,
            newVolume,
            block.number,
            tx.hash
          );
        } else {
          // Remove from seller's inventory if volume becomes 0
          await this.db.removeUserInventory(seller, barcode);
        }
      }
    } catch (error) {
      console.error(`Error updating seller inventory for ${seller}:`, error.message);
    }
  }

  async updateBuyerInventory(buyer, barcode, volumeToBuy, block, tx) {
    try {
      // Get current buyer inventory
      const buyerInventory = await this.db.getUserInventory(buyer);
      const product = buyerInventory.find(item => item.barcode === barcode);
      
      if (product) {
        // Buyer already has this product, add to existing volume
        const currentVolume = parseInt(product.volume);
        const newVolume = currentVolume + parseInt(volumeToBuy);
        
        await this.db.updateUserInventory(
          buyer,
          barcode,
          newVolume,
          block.number,
          tx.hash
        );
      } else {
        // Buyer doesn't have this product yet
        await this.db.updateUserInventory(
          buyer,
          barcode,
          parseInt(volumeToBuy),
          block.number,
          tx.hash
        );
      }
    } catch (error) {
      console.error(`Error updating buyer inventory for ${buyer}:`, error.message);
    }
  }

  // Helper method to get current inventory (needs to be implemented in db)
  async getCurrentUserInventory(userAddress, barcode) {
    // This is a simplified version - in reality we'd query the db
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
}