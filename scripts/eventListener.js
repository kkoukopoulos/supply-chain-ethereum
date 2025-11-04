const { ethers } = require('ethers');
const DatabaseModels = require('../db/models');
require('dotenv').config();

class EventListener {
  constructor(contractAddress, abi, providerUrl) {
    this.provider = new ethers.JsonRpcProvider(providerUrl || process.env.RPC_URL);
    this.contract = new ethers.Contract(contractAddress, abi, this.provider);
    this.lastBlock = 0;
  }

  async startListening() {
    console.log('Starting event listener...');

    // New User event
    this.contract.on('NewUser', async (userAddress, name, role, event) => {
      console.log('NewUser event detected:', { userAddress, name, role: role.toString() });
      
      try {
        const roleName = this.getRoleName(parseInt(role));
        await DatabaseModels.upsertUser(userAddress, name, roleName);
        await DatabaseModels.logEvent({
          eventName: 'NewUser',
          contractAddress: event.address,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          eventData: { userAddress, name, role: roleName }
        });
        console.log('User saved to database:', userAddress);
      } catch (error) {
        console.error('Error saving user:', error);
      }
    });

    // New Product event
    this.contract.on('NewProduct', async (manufacturer, name, manufacturerName, barcode, manufacturedTime, event) => {
      console.log('NewProduct event detected:', { manufacturer, name, barcode });
      
      try {
        await DatabaseModels.insertProduct({
          barcode,
          name,
          manufacturerName,
          manufacturedTime,
          blockNumber: event.blockNumber
        });

        // Add initial product history
        await DatabaseModels.insertProductHistory({
          barcode,
          owner: manufacturer,
          timestamp: (await this.provider.getBlock(event.blockNumber)).timestamp,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        });

        await DatabaseModels.logEvent({
          eventName: 'NewProduct',
          contractAddress: event.address,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          eventData: { manufacturer, name, manufacturerName, barcode, manufacturedTime }
        });

        console.log('Product saved to database:', barcode);
      } catch (error) {
        console.error('Error saving product:', error);
      }
    });

    // Product Ownership Transfer event
    this.contract.on('ProductOwnershipTransfer', async (barcode, buyer, seller, transferTime, event) => {
      console.log('ProductOwnershipTransfer event detected:', { barcode, buyer, seller });
      
      try {
        await DatabaseModels.insertProductHistory({
          barcode,
          owner: buyer,
          timestamp: transferTime,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber
        });

        await DatabaseModels.logEvent({
          eventName: 'ProductOwnershipTransfer',
          contractAddress: event.address,
          transactionHash: event.transactionHash,
          blockNumber: event.blockNumber,
          eventData: { barcode, buyer, seller, transferTime: transferTime.toString() }
        });

        console.log('Product transfer saved to database:', barcode);
      } catch (error) {
        console.error('Error saving product transfer:', error);
      }
    });

    console.log('Event listener started successfully');
  }

  getRoleName(roleId) {
    const roles = ['Manufacturer', 'Supplier', 'Vendor', 'Customer'];
    return roles[roleId] || 'Unknown';
  }

  async stopListening() {
    this.contract.removeAllListeners();
    console.log('Event listener stopped');
  }
}

module.exports = EventListener;