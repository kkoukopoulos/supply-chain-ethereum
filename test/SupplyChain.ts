import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("SupplyChain", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deploySupplyChainFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, manufacturer, supplier, vendor, customer] = await ethers.getSigners();

    const SupplyChain = await ethers.getContractFactory("SupplyChain");
    const supplyChain = await SupplyChain.deploy();

    return { supplyChain, owner, manufacturer, supplier, vendor, customer };
  }

  describe("User Registration", function () {
    it("Should register a manufacturer", async function () {
      const { supplyChain, manufacturer } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Co", 0);
      
      const userInfo = await supplyChain.returnUserInfo(manufacturer.address);
      expect(userInfo[0]).to.equal("Manufacturer Co"); // name is first return value
      expect(userInfo[1]).to.equal(0); // role is second return value
    });

    it("Should register a supplier", async function () {
      const { supplyChain, supplier } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(supplier).registerUser("Supplier Inc", 1);
      
      const userInfo = await supplyChain.returnUserInfo(supplier.address);
      expect(userInfo[0]).to.equal("Supplier Inc");
      expect(userInfo[1]).to.equal(1);
    });

    it("Should register a vendor", async function () {
      const { supplyChain, vendor } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(vendor).registerUser("Vendor Shop", 2);
      
      const userInfo = await supplyChain.returnUserInfo(vendor.address);
      expect(userInfo[0]).to.equal("Vendor Shop");
      expect(userInfo[1]).to.equal(2);
    });

    it("Should register a customer", async function () {
      const { supplyChain, customer } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(customer).registerUser("John Customer", 3);
      
      const userInfo = await supplyChain.returnUserInfo(customer.address);
      expect(userInfo[0]).to.equal("John Customer");
      expect(userInfo[1]).to.equal(3);
    });

    it("Should return complete user information", async function () {
      const { supplyChain, manufacturer } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(manufacturer).registerUser("Test Manufacturer", 0);
      
      const user = await supplyChain.returnUser(manufacturer.address);
      expect(user.name).to.equal("Test Manufacturer");
      expect(user.role).to.equal(0);
      expect(user.userAddress).to.equal(manufacturer.address);
    });
  });

  describe("Product Management", function () {
    it("Should allow manufacturer to register a product", async function () {
      const { supplyChain, manufacturer } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(manufacturer).registerUser("Product Manufacturer", 0);

      await expect(
        supplyChain.connect(manufacturer).registerProduct(
          "Test Product",
          "Product Manufacturer",
          "1234567890123",
          "2024-01-01T12:00:00Z"
        )
      ).to.emit(supplyChain, "NewProduct").withArgs(
        "Test Product",
        "Product Manufacturer",
        "1234567890123",
        "2024-01-01T12:00:00Z"
      );
    });

    it("Should not allow non-manufacturer to register a product", async function () {
      const { supplyChain, supplier } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(supplier).registerUser("Test Supplier", 1);
      
      await expect(
        supplyChain.connect(supplier).registerProduct(
          "Test Product",
          "Test Supplier",
          "1234567890123",
          "2024-01-01T12:00:00Z"
        )
      ).to.be.revertedWith("Only manufacturer can add products.");
    });
  });

  describe("Product Ownership Transfer", function () {
    const barcode = "1234567890123";

    async function deployWithProductFixture() {
      const fixture = await loadFixture(deploySupplyChainFixture);
      const { supplyChain, manufacturer, supplier, vendor, customer } = fixture;

      // Setup users
      await supplyChain.connect(manufacturer).registerUser("Manufacturer Co", 0);
      await supplyChain.connect(supplier).registerUser("Supplier Inc", 1);
      await supplyChain.connect(vendor).registerUser("Vendor Shop", 2);
      await supplyChain.connect(customer).registerUser("End Customer", 3);

      // Manufacturer creates a product
      await supplyChain.connect(manufacturer).registerProduct(
        "Test Product",
        "Manufacturer Co",
        barcode,
        "2024-01-01T12:00:00Z"
      );

      return { ...fixture, barcode };
    }

    it("Should transfer product from manufacturer to supplier", async function () {
      const { supplyChain, manufacturer, supplier, barcode } = await loadFixture(deployWithProductFixture);
      
      await expect(
        supplyChain.connect(manufacturer).sellProduct(supplier.address, barcode)
      ).to.emit(supplyChain, "ProductOwnershipTransfer");
    });

    it("Should transfer product through the entire supply chain", async function () {
      const { supplyChain, manufacturer, supplier, vendor, customer, barcode } = await loadFixture(deployWithProductFixture);
      
      // Manufacturer -> Supplier
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, barcode);
      
      // Supplier -> Vendor
      await supplyChain.connect(supplier).sellProduct(vendor.address, barcode);
      
      // Vendor -> Customer
      await expect(
        supplyChain.connect(vendor).sellProduct(customer.address, barcode)
      ).to.emit(supplyChain, "ProductOwnershipTransfer");
    });

    it("Should not allow transfer if seller doesn't own the product", async function () {
      const { supplyChain, supplier, vendor, barcode } = await loadFixture(deployWithProductFixture);
      
      await expect(
        supplyChain.connect(supplier).sellProduct(vendor.address, barcode)
      ).to.be.revertedWith("Product not in seller inventory");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple products with different barcodes", async function () {
      const { supplyChain, manufacturer, supplier } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(manufacturer).registerUser("Multi Product Manufacturer", 0);
      
      const barcodes = ["1234567890123", "2345678901234", "3456789012345"];
      
      for (let i = 0; i < barcodes.length; i++) {
        await supplyChain.connect(manufacturer).registerProduct(
          `Product ${i + 1}`,
          "Multi Product Manufacturer",
          barcodes[i],
          "2024-01-01T12:00:00Z"
        );
      }

      // Register supplier to transfer product
      await supplyChain.connect(supplier).registerUser("Test Supplier", 1);
      
      // Transfer one product to test isolation
      await supplyChain.connect(manufacturer).sellProduct(supplier.address, barcodes[0]);
    });

    it("Should handle duplicate barcode registration attempts", async function () {
      const { supplyChain, manufacturer } = await loadFixture(deploySupplyChainFixture);
      
      await supplyChain.connect(manufacturer).registerUser("Test Manufacturer", 0);
      
      // Register first product
      await supplyChain.connect(manufacturer).registerProduct(
        "Product 1",
        "Test Manufacturer",
        "1234567890123",
        "2024-01-01T12:00:00Z"
      );

      // Try to register duplicate barcode (current contract allows this)
      await supplyChain.connect(manufacturer).registerProduct(
        "Product 2",
        "Test Manufacturer",
        "1234567890123",
        "2024-01-02T12:00:00Z"
      );
    });
  });
});