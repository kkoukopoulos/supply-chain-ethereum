// test/db-test-helper.js
class DBTestHelper {
  static users = [];
  static products = [];
  
  static async connect() {
    console.log('Using in-memory database for testing');
    this.users = [];
    this.products = [];
  }

  static async disconnect() {
    console.log('Disconnected from in-memory database');
    this.printSummary();
  }

  static async clearDatabase() {
    this.users = [];
    this.products = [];
    console.log('Cleared in-memory database');
  }

  static async logUserToDB(userAddress, name, role) {
    const user = {
      userAddress,
      name,
      role,
      createdAt: new Date()
    };
    
    // Update if exists, otherwise add
    const existingIndex = this.users.findIndex(u => u.userAddress === userAddress);
    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }
    
    console.log(`Logged user: ${name} (${role}) at ${userAddress}`);
    return user;
  }

  static async logProductToDB(name, manufacturerName, barcode, manufacturedTime, currentOwner) {
    const product = {
      name,
      manufacturerName,
      barcode,
      manufacturedTime,
      currentOwner,
      history: [{
        owner: currentOwner,
        timestamp: new Date(),
        transactionType: 'Manufactured'
      }],
      createdAt: new Date()
    };
    
    // Update if exists, otherwise add
    const existingIndex = this.products.findIndex(p => p.barcode === barcode);
    if (existingIndex >= 0) {
      this.products[existingIndex] = product;
    } else {
      this.products.push(product);
    }
    
    console.log(`Logged product: ${name} (${barcode}) owned by ${currentOwner}`);
    return product;
  }

  static async logProductTransferToDB(barcode, fromAddress, toAddress) {
    const productIndex = this.products.findIndex(p => p.barcode === barcode);
    
    if (productIndex >= 0) {
      this.products[productIndex].currentOwner = toAddress;
      this.products[productIndex].history.push({
        owner: toAddress,
        timestamp: new Date(),
        transactionType: 'Transfer'
      });
      
      console.log(`Logged transfer: ${barcode} from ${fromAddress} to ${toAddress}`);
      return this.products[productIndex];
    } else {
      console.log(`Product ${barcode} not found for transfer`);
      return null;
    }
  }

  static printSummary() {
    console.log('\n-------TEST DATABASE SUMMARY-------');
    console.log(`Users: ${this.users.length}`);
    this.users.forEach(user => {
      console.log(`   - ${user.name} (${user.role}): ${user.userAddress}`);
    });
    
    console.log(`\nProducts: ${this.products.length}`);
    this.products.forEach(product => {
      const currentOwnerUser = this.users.find(u => u.userAddress === product.currentOwner);
      const ownerName = currentOwnerUser ? currentOwnerUser.name : 'Unknown';
      console.log(`   - ${product.name} (${product.barcode})`);
      console.log(`     Current Owner: ${ownerName} (${product.currentOwner})`);
      console.log(`     History: ${product.history.length} entries`);
    });
    console.log('------------------------------------\n');
  }

  // Helper to get data for verification
  static getUsers() { return this.users; }
  static getProducts() { return this.products; }
}

module.exports = DBTestHelper;