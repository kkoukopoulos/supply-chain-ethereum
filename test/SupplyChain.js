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
});