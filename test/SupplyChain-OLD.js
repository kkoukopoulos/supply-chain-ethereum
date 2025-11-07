const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChain with Manufacturer Restriction", function () {
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

  describe("User Registration", function () {
    it("should register users with different roles", async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);

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
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(customer).registerUser("Customer", 3);

      const isManufacturer = await supplyChain.isUserManufacturer(manufacturer.address);
      const isCustomerManufacturer = await supplyChain.isUserManufacturer(customer.address);

      expect(isManufacturer).to.be.true;
      expect(isCustomerManufacturer).to.be.false;
    });
  });

  describe("Product Registration", function () {
    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);
    });

    it("should allow manufacturer to add product", async function () {
      await supplyChain.connect(manufacturer).registerProduct(
        "Smartphone",
        "Manufacturer Inc",
        "123456789012",
        "2025-09-30T10:00:00Z"
      );

      const product = await products.getProductByBarcode("123456789012");
      expect(product.name).to.equal("Smartphone");

      const productCount = await products.getUserProductCount(manufacturer.address);
      expect(productCount).to.equal(1);
    });

    it("should revert when non-manufacturer tries to add product", async function () {
      await expect(
        supplyChain.connect(supplier).registerProduct(
          "Unauthorized Product",
          "Supplier Co",
          "999888777",
          "2025-09-30"
        )
      ).to.be.revertedWith("Only manufacturer can add products.");
    });
  });

  describe("Supply Chain Path Enforcement", function () {
    const testBarcode = "123456789012";

    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);

      await supplyChain.connect(manufacturer).registerProduct(
        "Smartphone",
        "Manufacturer Inc",
        testBarcode,
        "2025-09-30"
      );
    });

    it("should allow manufacturer to sell to supplier", async function () {
      await expect(
        supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode)
      ).not.to.be.reverted;
    });

    it("should prevent manufacturer from selling directly to vendor", async function () {
      await expect(
        supplyChain.connect(manufacturer).sellProduct(vendor.address, testBarcode)
      ).to.be.revertedWith("Manufacturer can only sell to Supplier");
    });

    it("should allow proper path: manufacturer->supplier->vendor->customer", async function () {
      // Manufacturer -> Supplier
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      
      // Supplier -> Vendor
      await supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode);
      
      // Vendor -> Customer
      await supplyChain.connect(vendor).sellProduct(customer.address, testBarcode);

      const customerProductCount = await products.getUserProductCount(customer.address);
      expect(customerProductCount).to.equal(1);
    });

    it("should prevent supplier from selling to customer", async function () {
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      
      await expect(
        supplyChain.connect(supplier).sellProduct(customer.address, testBarcode)
      ).to.be.revertedWith("Supplier can only sell to Vendor");
    });

    it("should prevent customer from selling", async function () {
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      await supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode);
      await supplyChain.connect(vendor).sellProduct(customer.address, testBarcode);
      
      await expect(
        supplyChain.connect(customer).sellProduct(vendor.address, testBarcode)
      ).to.be.revertedWith("Customer cannot sell the product");
    });
  });

  describe("Product History", function () {
    const testBarcode = "123456789012";

    beforeEach(async function () {
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Inc", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Co", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Store", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);

      await supplyChain.connect(manufacturer).registerProduct(
        "Smartphone",
        "Manufacturer Inc",
        testBarcode,
        "2025-09-30"
      );
    });

    it("should track product history through transfers", async function () {
      // Manufacturer -> Supplier
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, testBarcode);
      
      // Supplier -> Vendor
      await supplyChain.connect(supplier).sellProduct(vendor.address, testBarcode);
      
      // Vendor -> Customer
      await supplyChain.connect(vendor).sellProduct(customer.address, testBarcode);

      const history = await products.getProductHistory(testBarcode);
      expect(history.length).to.equal(4);
      
      expect(history[0].owner).to.equal(manufacturer.address);
      expect(history[1].owner).to.equal(supplier.address);
      expect(history[2].owner).to.equal(vendor.address);
      expect(history[3].owner).to.equal(customer.address);
    });
  });
});