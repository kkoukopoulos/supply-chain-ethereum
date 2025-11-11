// test/SupplyChain.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const DBTestHelper = require("./db-test-helper");

describe("SupplyChain with Database Logging", function () {
  let SupplyChain, Users, Products;
  let supplyChain, users, products;
  let owner, manufacturer, supplier, vendor, customer;

  before(async function () {
    await DBTestHelper.connect();
    await DBTestHelper.clearDatabase();
  });

  after(async function () {
    await DBTestHelper.disconnect();
  });

  beforeEach(async function () {
    [owner, manufacturer, supplier, vendor, customer] = await ethers.getSigners();
    
    Users = await ethers.getContractFactory("Users");
    users = await Users.deploy();
    
    Products = await ethers.getContractFactory("Products");
    products = await Products.deploy();
    
    SupplyChain = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SupplyChain.deploy(users.target, products.target);
  });

  describe("User Registration", function () {
    it("should register users with different roles and log to database", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer 1", 0, "0001");
      await DBTestHelper.logUserToDB(manufacturer.address, "Manufacturer 1", "Manufacturer");

      await supplyChain.connect(supplier).registerUser("Supplier 1", 1, "0002");
      await DBTestHelper.logUserToDB(supplier.address, "Supplier 1", "Supplier");

      await supplyChain.connect(vendor).registerUser("Vendor 1", 2, "0003");
      await DBTestHelper.logUserToDB(vendor.address, "Vendor 1", "Vendor");

      await supplyChain.connect(customer).registerUser("Customer 1", 3, "0004");
      await DBTestHelper.logUserToDB(customer.address, "Customer 1", "Customer");

      const manufacturerUser = await supplyChain.returnUser(manufacturer.address);
      const supplierUser = await supplyChain.returnUser(supplier.address);
      const vendorUser = await supplyChain.returnUser(vendor.address);
      const customerUser = await supplyChain.returnUser(customer.address);

      expect(manufacturerUser.role).to.equal(0);
      expect(supplierUser.role).to.equal(1);
      expect(vendorUser.role).to.equal(2);
      expect(customerUser.role).to.equal(3);
    });

    it("should correctly identify manufacturer status", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer 1", 0, "0001");
      await DBTestHelper.logUserToDB(manufacturer.address, "Manufacturer 1", "Manufacturer");
      
      await supplyChain.connect(customer).registerUser("Customer 1", 3, "0004");
      await DBTestHelper.logUserToDB(customer.address, "Customer 1", "Customer");
 
      const isManufacturer = await supplyChain.isUserManufacturer(manufacturer.address);
      const isCustomerManufacturer = await supplyChain.isUserManufacturer(customer.address);

      expect(isManufacturer).to.be.true;
      expect(isCustomerManufacturer).to.be.false;
    });
  });

  describe("Product Registration", function () {
    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer 1", 0, "0001");
      await supplyChain.connect(supplier).registerUser("Supplier 1", 1, "0002");
      await supplyChain.connect(vendor).registerUser("Vendor 1", 2, "0003");
      await supplyChain.connect(customer).registerUser("Customer 1", 3, "0004");

      await DBTestHelper.logUserToDB(manufacturer.address, "Manufacturer 1", "Manufacturer");
      await DBTestHelper.logUserToDB(supplier.address, "Supplier 1", "Supplier");
      await DBTestHelper.logUserToDB(vendor.address, "Vendor 1", "Vendor");
      await DBTestHelper.logUserToDB(customer.address, "Customer 1", "Customer");
    });

    it("should allow manufacturer to add product and log to database", async function () {
      await supplyChain.connect(manufacturer).registerProduct(
        "Drug 1",
        "Manufacturer 1",
        "0123456789",
        "2025-09-30T10:00:00Z"
      );

      await DBTestHelper.logProductToDB(
        "Drug 1",
        "Manufacturer 1",
        "0123456789",
        "2025-09-30T10:00:00Z",
        manufacturer.address
      );

      const product = await products.getProductByBarcode("0123456789");
      expect(product.name).to.equal("Drug 1");

      const productCount = await products.getUserProductCount(manufacturer.address);
      expect(productCount).to.equal(1);
    });

    it("should revert when non-manufacturer tries to add product", async function () {
      await expect(
        supplyChain.connect(supplier).registerProduct(
          "Drug X",
          "Supplier 1",
          "9876543210",
          "2025-09-30"
        )
      ).to.be.revertedWith("Only manufacturer can add products.");
    });
  });

  describe("Supply Chain Path Enforcement", function () {
    const testBarcode = "0123456789";

    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer 1", 0, "0001");
      await supplyChain.connect(supplier).registerUser("Supplier 1", 1, "0002");
      await supplyChain.connect(vendor).registerUser("Vendor 1", 2, "0003");
      await supplyChain.connect(customer).registerUser("Customer 1", 3, "0004");

      await DBTestHelper.logUserToDB(manufacturer.address, "Manufacturer 1", "Manufacturer");
      await DBTestHelper.logUserToDB(supplier.address, "Supplier 1", "Supplier");
      await DBTestHelper.logUserToDB(vendor.address, "Vendor 1", "Vendor");
      await DBTestHelper.logUserToDB(customer.address, "Customer 1", "Customer");

      await supplyChain.connect(manufacturer).registerProduct(
        "Drug 1",
        "Manufacturer 1",
        testBarcode,
        "2025-09-30"
      );

      await DBTestHelper.logProductToDB(
        "Drug 1",
        "Manufacturer 1",
        testBarcode,
        "2025-09-30",
        manufacturer.address
      );
    });

    it("should allow manufacturer to sell to supplier", async function () {
      await expect(
        supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode)
      ).not.to.be.reverted;
      
      await DBTestHelper.logProductTransferToDB(testBarcode, manufacturer.address, supplier.address);
    });

    it("should prevent manufacturer from selling directly to vendor", async function () {
      await expect(
        supplyChain.connect(manufacturer).sellProduct(vendor.address, testBarcode)
      ).to.be.revertedWith("Manufacturer can only sell to Supplier");
    });

    it("should allow proper path: manufacturer->supplier->vendor->customer", async function () {
      // Manufacturer -> Supplier
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, manufacturer.address, supplier.address);
      
      // Supplier -> Vendor
      await supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, supplier.address, vendor.address);
      
      // Vendor -> Customer
      await supplyChain.connect(vendor).sellProduct(customer.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, vendor.address, customer.address);

      const customerProductCount = await products.getUserProductCount(customer.address);
      expect(customerProductCount).to.equal(1);
    });

    it("should prevent supplier from selling to customer", async function () {
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, manufacturer.address, supplier.address);
      
      await expect(
        supplyChain.connect(supplier).sellProduct(customer.address, testBarcode)
      ).to.be.revertedWith("Supplier can only sell to Vendor");
    });

    it("should prevent customer from selling", async function () {
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, manufacturer.address, supplier.address);
      
      await supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, supplier.address, vendor.address);
      
      await supplyChain.connect(vendor).sellProduct(customer.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, vendor.address, customer.address);
      
      await expect(
        supplyChain.connect(customer).sellProduct(vendor.address, testBarcode)
      ).to.be.revertedWith("Customer cannot sell the product");
    });
  });

  describe("Product History", function () {
    const testBarcode = "0123456789";

    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer 1", 0, "0001");
      await supplyChain.connect(supplier).registerUser("Supplier 1", 1, "0002");
      await supplyChain.connect(vendor).registerUser("Vendor 1", 2, "0003");
      await supplyChain.connect(customer).registerUser("Customer 1", 3, "0004");

      await DBTestHelper.logUserToDB(manufacturer.address, "Manufacturer 1", "Manufacturer");
      await DBTestHelper.logUserToDB(supplier.address, "Supplier 1", "Supplier");
      await DBTestHelper.logUserToDB(vendor.address, "Vendor 1", "Vendor");
      await DBTestHelper.logUserToDB(customer.address, "Customer 1", "Customer");

      await supplyChain.connect(manufacturer).registerProduct(
        "Drug 1",
        "Manufacturer 1",
        testBarcode,
        "2025-09-30"
      );

      await DBTestHelper.logProductToDB(
        "Drug 1",
        "Manufacturer 1",
        testBarcode,
        "2025-09-30",
        manufacturer.address
      );
    });

    it("should track product history through transfers", async function () {
      // Manufacturer -> Supplier
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, manufacturer.address, supplier.address);
      
      // Supplier -> Vendor
      await supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, supplier.address, vendor.address);
      
      // Vendor -> Customer
      await supplyChain.connect(vendor).sellProduct(customer.address, testBarcode);
      await DBTestHelper.logProductTransferToDB(testBarcode, vendor.address, customer.address);

      const history = await products.getProductHistory(testBarcode);
      expect(history.length).to.equal(4);
      
      expect(history[0].owner).to.equal(manufacturer.address);
      expect(history[1].owner).to.equal(supplier.address);
      expect(history[2].owner).to.equal(vendor.address);
      expect(history[3].owner).to.equal(customer.address);
    });
  });
});