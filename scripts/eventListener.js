const { ethers } = require('ethers');
const DatabaseModels = require('../db/models');
require('dotenv').config();

class EventListener {
  constructor(providerUrl) {
    this.provider = new ethers.JsonRpcProvider(providerUrl || process.env.RPC_URL);
    this.lastBlock = 0;
  }

  async startListening() {
    console.log('Starting event listener...');

    // Get contract addresses
    const usersAddress = process.env.USERS_CONTRACT_ADDRESS;
    const productsAddress = process.env.PRODUCTS_CONTRACT_ADDRESS;
    const supplyChainAddress = process.env.CONTRACT_ADDRESS;

    if (!usersAddress || !productsAddress) {
      console.error('Contract addresses not found in .env file');
      return;
    }

    // Load ABIs
    const usersAbi = require('../artifacts/contracts/Users.sol/Users.json').abi;
    const productsAbi = require('../artifacts/contracts/Products.sol/Products.json').abi;

    // Create contract instances
    this.usersContract = new ethers.Contract(usersAddress, usersAbi, this.provider);
    this.productsContract = new ethers.Contract(productsAddress, productsAbi, this.provider);

    // Listen to Users contract events
    this.usersContract.on('NewUser', async (userAddress, name, role, event) => {
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

    // Listen to Products contract events
    this.productsContract.on('NewProduct', async (manufacturer, name, manufacturerName, barcode, manufacturedTime, event) => {
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

    this.productsContract.on('ProductOwnershipTransfer', async (barcode, buyer, seller, transferTime, event) => {
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
    console.log('Listening to:');
    console.log(`  - Users contract: ${usersAddress}`);
    console.log(`  - Products contract: ${productsAddress}`);
  }

  getRoleName(roleId) {
    const roles = ['Manufacturer', 'Supplier', 'Vendor', 'Customer'];
    return roles[roleId] || 'Unknown';
  }

  async stopListening() {
    if (this.usersContract) {
      this.usersContract.removeAllListeners();
    }
    if (this.productsContract) {
      this.productsContract.removeAllListeners();
    }
    console.log('Event listener stopped');
  }
}

module.exports = EventListener;