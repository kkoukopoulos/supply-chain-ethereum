const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChain", function () {
  let SupplyChain, supplyChain;
  let owner, manufacturer, vendor, customer;

  beforeEach(async function () {
    [owner, manufacturer, vendor, customer] = await ethers.getSigners();
    SupplyChain = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SupplyChain.deploy();
    await supplyChain.deployed();
  });

  it("should register a Manufacturer", async function () {
    await supplyChain.connect(manufacturer).registerUser("Maker", 0); // 0 = Manufacturer
    const user = await supplyChain.returnUser(manufacturer.address);
    expect(user.name).to.equal("Maker");
    expect(user.role).to.equal(0);
  });

  it("should allow Manufacturer to add product", async function () {
    await supplyChain.connect(manufacturer).registerUser("Maker", 0);
    await supplyChain.connect(manufacturer).registerProduct(
      "Phone",
      "Maker",
      "123456",
      "2025-09-30"
    );
    // check ότι υπάρχει ιστορικό
    const productsContract = await supplyChain.products();
    const Products = await ethers.getContractAt("Products", productsContract);
    const history = await Products.productHistory("123456", 0);
    expect(history.owner).to.equal(manufacturer.address);
  });

  it("should transfer product from manufacturer to vendor", async function () {
    await supplyChain.connect(manufacturer).registerUser("Maker", 0);
    await supplyChain.connect(vendor).registerUser("Reseller", 2); // 2 = Vendor
    await supplyChain.connect(manufacturer).registerProduct(
      "Phone",
      "Maker",
      "123456",
      "2025-09-30"
    );

    await supplyChain.connect(manufacturer).sellProduct(vendor.address, "123456");

    const productsContract = await supplyChain.products();
    const Products = await ethers.getContractAt("Products", productsContract);
    const history = await Products.productHistory("123456", 1);

    expect(history.owner).to.equal(vendor.address);
  });

  it("should revert if non-manufacturer tries to add product", async function () {
    await supplyChain.connect(customer).registerUser("Buyer", 3); // 3 = Customer
    await expect(
      supplyChain.connect(customer).registerProduct(
        "Fake",
        "Buyer",
        "999",
        "2025-09-30"
      )
    ).to.be.revertedWith("Only manufacturer can add products.");
  });
});
