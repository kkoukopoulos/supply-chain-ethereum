const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChain - On-Chain Storage Only", function () {
  let SupplyChain, Users, Products;
  let supplyChain, users, products;
  let owner, manufacturer, supplier, vendor, customer;

  beforeEach(async function () {
    [owner, manufacturer, supplier, vendor, customer] = await ethers.getSigners();
    
    Users = await ethers.getContractFactory("Users");
    users = await Users.deploy();
    
    Products = await ethers.getContractFactory("Products");
    products = await Products.deploy();
    
    SupplyChain = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SupplyChain.deploy(users.target, products.target);
  });

  describe("User Management", function () {
    it("should register users with public keys", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0, "manu_123");
      
      const user = await supplyChain.getUserByPublicKey("manu_123");
      expect(user.name).to.equal("Manufacturer Inc");
      expect(user.role).to.equal(0);
      expect(user.publicKey).to.equal("manu_123");
    });

    it("should prevent duplicate public keys", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0, "manu_123");
      
      await expect(
        supplyChain.connect(supplier).registerUser("Another User", 1, "manu_123")
      ).to.be.revertedWith("Public key already registered");
    });
  });

  describe("Product Management", function () {
    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0, "manu_123");
    });

    it("should register products", async function () {
      await supplyChain.connect(manufacturer).registerProduct(
        "Test Product",
        "Manufacturer Inc",
        "123456789",
        "2024-01-01"
      );

      const product = await products.getProductByBarcode("123456789");
      expect(product.name).to.equal("Test Product");
      expect(product.barcode).to.equal("123456789");
    });

    it("should prevent non-manufacturers from registering products", async function () {
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1, "supp_123");
      
      await expect(
        supplyChain.connect(supplier).registerProduct(
          "Test Product",
          "Supplier Co",
          "123456789",
          "2024-01-01"
        )
      ).to.be.revertedWith("Only manufacturer can add products");
    });
  });

  describe("Product Transfers", function () {
    const testBarcode = "123456789";

    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0, "manu_123");
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1, "supp_123");
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2, "vend_123");
      
      await supplyChain.connect(manufacturer).registerProduct(
        "Test Product",
        "Manufacturer Inc",
        testBarcode,
        "2024-01-01"
      );
    });

    it("should transfer products using public keys", async function () {
      await supplyChain.connect(manufacturer).sellProductByPublicKey("supp_123", testBarcode);
      
      const history = await products.getProductHistory(testBarcode);
      expect(history.length).to.equal(2);
      expect(history[1].owner).to.equal(supplier.address);
    });

    it("should enforce supply chain path", async function () {
      await expect(
        supplyChain.connect(manufacturer).sellProductByPublicKey("vend_123", testBarcode)
      ).to.be.revertedWith("Manufacturer can only sell to Supplier");
    });
  });

  describe("Inventory Management", function () {
    const testBarcode1 = "123456789";
    const testBarcode2 = "987654321";

    beforeEach(async function () {
      // Register users
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0, "manu_123");
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1, "supp_123");
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2, "vend_123");
      
      // Register products
      await supplyChain.connect(manufacturer).registerProduct(
        "Test Product 1",
        "Manufacturer Inc",
        testBarcode1,
        "2024-01-01"
      );
      
      await supplyChain.connect(manufacturer).registerProduct(
        "Test Product 2",
        "Manufacturer Inc",
        testBarcode2,
        "2024-01-02"
      );
    });

    it("should return empty inventory for new user", async function () {
      const inventory = await supplyChain.getUserInventory(supplier.address);
      expect(inventory).to.be.an('array').that.is.empty;
    });

    it("should return correct inventory for manufacturer after product registration", async function () {
      const inventory = await supplyChain.getUserInventory(manufacturer.address);
      expect(inventory).to.have.lengthOf(2);
      expect(inventory).to.include(testBarcode1);
      expect(inventory).to.include(testBarcode2);
    });

    it("should return inventory with product details", async function () {
      const inventoryDetails = await supplyChain.getUserInventoryWithDetails(manufacturer.address);
      
      expect(inventoryDetails).to.have.lengthOf(2);
      
      // Check first product
      expect(inventoryDetails[0].name).to.equal("Test Product 1");
      expect(inventoryDetails[0].barcode).to.equal(testBarcode1);
      expect(inventoryDetails[0].manufacturerName).to.equal("Manufacturer Inc");
      
      // Check second product
      expect(inventoryDetails[1].name).to.equal("Test Product 2");
      expect(inventoryDetails[1].barcode).to.equal(testBarcode2);
      expect(inventoryDetails[1].manufacturerName).to.equal("Manufacturer Inc");
    });

    it("should update inventory after product transfer", async function () {
      // Check initial inventory
      let manufacturerInventory = await supplyChain.getUserInventory(manufacturer.address);
      let supplierInventory = await supplyChain.getUserInventory(supplier.address);
      
      expect(manufacturerInventory).to.have.lengthOf(2);
      expect(supplierInventory).to.have.lengthOf(0);
      
      // Transfer one product
      await supplyChain.connect(manufacturer).sellProductByPublicKey("supp_123", testBarcode1);
      
      // Check updated inventory
      manufacturerInventory = await supplyChain.getUserInventory(manufacturer.address);
      supplierInventory = await supplyChain.getUserInventory(supplier.address);
      
      expect(manufacturerInventory).to.have.lengthOf(1);
      expect(manufacturerInventory[0]).to.equal(testBarcode2); // Only second product remains
      
      expect(supplierInventory).to.have.lengthOf(1);
      expect(supplierInventory[0]).to.equal(testBarcode1); // First product transferred
    });

    it("should get inventory by public key", async function () {
      const inventory = await supplyChain.getUserInventoryByPublicKey("manu_123");
      expect(inventory).to.have.lengthOf(2);
      expect(inventory).to.include(testBarcode1);
      expect(inventory).to.include(testBarcode2);
    });

    it("should get inventory with details by public key", async function () {
      const inventoryDetails = await supplyChain.getUserInventoryWithDetailsByPublicKey("manu_123");
      
      expect(inventoryDetails).to.have.lengthOf(2);
      expect(inventoryDetails[0].name).to.equal("Test Product 1");
      expect(inventoryDetails[0].barcode).to.equal(testBarcode1);
      expect(inventoryDetails[1].name).to.equal("Test Product 2");
      expect(inventoryDetails[1].barcode).to.equal(testBarcode2);
    });

    it("should revert when getting inventory for non-existent user by public key", async function () {
      await expect(
        supplyChain.getUserInventoryByPublicKey("nonexistent")
      ).to.be.revertedWith("User not found");
    });

    it("should return correct product count", async function () {
      const productCount = await products.getUserProductCount(manufacturer.address);
      expect(productCount).to.equal(2);
    });

    it("should return empty inventory for user with no products", async function () {
      const inventory = await supplyChain.getUserInventory(vendor.address);
      expect(inventory).to.be.an('array').that.is.empty;
      
      const inventoryDetails = await supplyChain.getUserInventoryWithDetails(vendor.address);
      expect(inventoryDetails).to.be.an('array').that.is.empty;
    });
  });

  describe("getProductByBarcode in SupplyChain", function () {
    const testBarcode = "123456789";
    const testBarcode2 = "987654321";

    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0, "manu_123");

      // Register products
      await supplyChain.connect(manufacturer).registerProduct(
        "Test Product",
        "Manufacturer Inc",
        testBarcode,
        "2024-01-01"
      );

      await supplyChain.connect(manufacturer).registerProduct(
        "Second Product",
        "Manufacturer Inc",
        testBarcode2,
        "2024-01-02"
      );
    });

    it("should return product details through SupplyChain contract", async function () {
      const product = await supplyChain.getProductByBarcode(testBarcode);

      expect(product.name).to.equal("Test Product");
      expect(product.manufacturerName).to.equal("Manufacturer Inc");
      expect(product.barcode).to.equal(testBarcode);
      expect(product.manufacturedTime).to.equal("2024-01-01");
    });

    it("should return different products for different barcodes", async function () {
      const product1 = await supplyChain.getProductByBarcode(testBarcode);
      const product2 = await supplyChain.getProductByBarcode(testBarcode2);

      expect(product1.name).to.equal("Test Product");
      expect(product2.name).to.equal("Second Product");
      expect(product1.barcode).to.equal(testBarcode);
      expect(product2.barcode).to.equal(testBarcode2);
    });

    it("should revert when getting non-existent product", async function () {
      const nonExistentBarcode = "000000000";

      await expect(supplyChain.getProductByBarcode(nonExistentBarcode)).to.be.revertedWith("Product not found");
    });

    it("should work after product transfers", async function () {
      // Register additional users for transfer
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1, "supp_123");

      // Product details should be available before transfer
      const productBefore = await supplyChain.getProductByBarcode(testBarcode);
      expect(productBefore.name).to.equal("Test Product");

      // Transfer product
      await supplyChain.connect(manufacturer).sellProductByPublicKey("supp_123", testBarcode);

      // Product details should remain the same after transfer
      const productAfter = await supplyChain.getProductByBarcode(testBarcode);
      expect(productAfter.name).to.equal("Test Product");
      expect(productAfter.manufacturerName).to.equal("Manufacturer Inc");
      expect(productAfter.barcode).to.equal(testBarcode);
    });

    it("should integrate with inventory functions", async function () {
      // Get product from inventory
      const inventory = await supplyChain.getUserInventory(manufacturer.address);
      expect(inventory).to.include(testBarcode);

      // Look up the same product by barcode
      const product = await supplyChain.getProductByBarcode(testBarcode);
      expect(product.barcode).to.equal(testBarcode);
      expect(product.name).to.equal("Test Product");
    });
  });
});