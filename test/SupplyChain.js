const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChain with Manufacturer Restriction", function () {
  let SupplyChain, Users, Products;
  let supplyChain, users, products;
  let owner, manufacturer, supplier, vendor, customer;

  beforeEach(async function () {
    [owner, manufacturer, supplier, vendor, customer] = await ethers.getSigners();
    
    // Deploy contracts
    Users = await ethers.getContractFactory("Users");
    users = await Users.deploy();
    
    Products = await ethers.getContractFactory("Products");
    products = await Products.deploy();
    
    SupplyChain = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SupplyChain.deploy(users.target, products.target);
  });

  describe("User Registration", function () {
    it("should register users with different roles", async function () {
      // Register different roles
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);

      // Verify roles
      const manufacturerUser = await supplyChain.returnUser(manufacturer.address);
      const supplierUser = await supplyChain.returnUser(supplier.address);
      const vendorUser = await supplyChain.returnUser(vendor.address);
      const customerUser = await supplyChain.returnUser(customer.address);

      expect(manufacturerUser.role).to.equal(0); // Manufacturer
      expect(supplierUser.role).to.equal(1); // Supplier
      expect(vendorUser.role).to.equal(2); // Vendor
      expect(customerUser.role).to.equal(3); // Customer
    });

    it("should correctly identify manufacturer status", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(customer).registerUser("Customer", 3);

      // Use the new function in SupplyChain
      const isManufacturer = await supplyChain.isUserManufacturer(manufacturer.address);
      const isCustomerManufacturer = await supplyChain.isUserManufacturer(customer.address);

      expect(isManufacturer).to.be.true;
      expect(isCustomerManufacturer).to.be.false;
    });
  });

  describe("Product Registration with Manufacturer Restriction", function () {
    beforeEach(async function () {
      // Register users
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);
    });

    it("should allow manufacturer to add product", async function () {
      const tx = await supplyChain.connect(manufacturer).registerProduct(
        "Smartphone",
        "Manufacturer Inc",
        "123456789012",
        "2025-09-30T10:00:00Z"
      );
      await tx.wait();

      // Verify product was added
      const product = await products.getProductByBarcode("123456789012");
      expect(product.name).to.equal("Smartphone");
      expect(product.manufacturerName).to.equal("Manufacturer Inc");

      // Verify manufacturer owns the product
      const productCount = await products.getUserProductCount(manufacturer.address);
      expect(productCount).to.equal(1);
    });

    it("should revert when supplier tries to add product", async function () {
      await expect(
        supplyChain.connect(supplier).registerProduct(
          "Unauthorized Product",
          "Supplier Co",
          "999888777",
          "2025-09-30"
        )
      ).to.be.revertedWith("Only manufacturer can add products.");
    });

    it("should revert when vendor tries to add product", async function () {
      await expect(
        supplyChain.connect(vendor).registerProduct(
          "Unauthorized Product",
          "Vendor Store",
          "999888777",
          "2025-09-30"
        )
      ).to.be.revertedWith("Only manufacturer can add products.");
    });

    it("should revert when customer tries to add product", async function () {
      await expect(
        supplyChain.connect(customer).registerProduct(
          "Unauthorized Product",
          "End Customer",
          "999888777",
          "2025-09-30"
        )
      ).to.be.revertedWith("Only manufacturer can add products.");
    });

    it("should revert when unregistered user tries to add product", async function () {
      const unregisteredUser = owner; // owner hasn't registered as any role

      // Now it should revert with "User not registered" because we check registration first
      await expect(
        supplyChain.connect(unregisteredUser).registerProduct(
          "Unauthorized Product",
          "Unregistered User",
          "999888777",
          "2025-09-30"
        )
      ).to.be.revertedWith("User not registered");
    });

    it("should revert when adding product with duplicate barcode", async function () {
      // Add first product
      await supplyChain.connect(manufacturer).registerProduct(
        "Smartphone",
        "Manufacturer Inc",
        "123456789012",
        "2025-09-30"
      );

      // Try to add product with same barcode
      await expect(
        supplyChain.connect(manufacturer).registerProduct(
          "Another Phone",
          "Manufacturer Inc",
          "123456789012", // Same barcode
          "2025-10-01"
        )
      ).to.be.revertedWith("Product with this barcode already exists");
    });
  });

  describe("Product Transfers", function () {
    const testBarcode = "123456789012";

    beforeEach(async function () {
      // Register all users
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);

      // Manufacturer adds a product
      await supplyChain.connect(manufacturer).registerProduct(
        "Smartphone",
        "Manufacturer Inc",
        testBarcode,
        "2025-09-30"
      );
    });

    it("should transfer product from manufacturer to supplier", async function () {
      // Verify initial state
      let manufacturerProductCount = await products.getUserProductCount(manufacturer.address);
      let supplierProductCount = await products.getUserProductCount(supplier.address);
      expect(manufacturerProductCount).to.equal(1);
      expect(supplierProductCount).to.equal(0);

      // Transfer
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);

      // Verify transfer
      manufacturerProductCount = await products.getUserProductCount(manufacturer.address);
      supplierProductCount = await products.getUserProductCount(supplier.address);
      expect(manufacturerProductCount).to.equal(0);
      expect(supplierProductCount).to.equal(1);

      // Verify history
      const history = await products.productHistory(testBarcode, 1);
      expect(history.owner).to.equal(supplier.address);
    });

    it("should transfer product through multiple parties", async function () {
      // Initial state: product created (1 history entry)
      
      // Manufacturer -> Supplier (2nd history entry)
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      
      // Supplier -> Vendor (3rd history entry)
      await supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode);
      
      // Vendor -> Customer (4th history entry)
      await supplyChain.connect(vendor).sellProduct(customer.address, testBarcode);

      // Verify final owner
      const customerProductCount = await products.getUserProductCount(customer.address);
      expect(customerProductCount).to.equal(1);

      // Verify history length: 4 entries total (creation + 3 transfers)
      const historyLength = await products.getProductHistoryLength(testBarcode);
      expect(historyLength).to.equal(4);
      
      // Verify the last entry is the customer
      const latestHistory = await products.productHistory(testBarcode, 3);
      expect(latestHistory.owner).to.equal(customer.address);
    });

    it("should revert when non-owner tries to sell product", async function () {
      // Supplier tries to sell product they don't own
      await expect(
        supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode)
      ).to.be.revertedWith("Product not in seller inventory");
    });

    it("should revert when selling to unregistered user", async function () {
      const unregisteredUser = owner; // owner hasn't registered

      await expect(
        supplyChain.connect(manufacturer).sellProduct(unregisteredUser.address, testBarcode)
      ).to.be.revertedWith("User not registered");
    });

    it("should revert when selling non-existent product", async function () {
      await expect(
        supplyChain.connect(manufacturer).sellProduct(supplier.address, "NON_EXISTENT_BARCODE")
      ).to.be.revertedWith("Product not found");
    });

    it("should revert when selling to self", async function () {
      await expect(
        supplyChain.connect(manufacturer).sellProduct(manufacturer.address, testBarcode)
      ).to.be.revertedWith("Cannot sell to yourself");
    });
  });

  describe("Edge Cases", function () {
    it("should handle multiple products from same manufacturer", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);

      // Add multiple products
      await supplyChain.connect(manufacturer).registerProduct("Product1", "Manufacturer Inc", "111", "2025-01-01");
      await supplyChain.connect(manufacturer).registerProduct("Product2", "Manufacturer Inc", "222", "2025-01-02");
      await supplyChain.connect(manufacturer).registerProduct("Product3", "Manufacturer Inc", "333", "2025-01-03");

      const productCount = await products.getUserProductCount(manufacturer.address);
      expect(productCount).to.equal(3);

      // Verify all products exist
      const product1 = await products.getProductByBarcode("111");
      const product2 = await products.getProductByBarcode("222");
      const product3 = await products.getProductByBarcode("333");

      expect(product1.name).to.equal("Product1");
      expect(product2.name).to.equal("Product2");
      expect(product3.name).to.equal("Product3");
    });

    it("should enforce input validation", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);

      await expect(
        supplyChain.connect(manufacturer).registerProduct(
          "", // Empty name
          "Manufacturer Inc",
          "123456",
          "2025-09-30"
        )
      ).to.be.revertedWith("Product name cannot be empty");

      await expect(
        supplyChain.connect(manufacturer).registerProduct(
          "Valid Product",
          "Manufacturer Inc",
          "", // Empty barcode
          "2025-09-30"
        )
      ).to.be.revertedWith("Barcode cannot be empty");
    });
  });
});