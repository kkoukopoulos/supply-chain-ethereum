const { expect } = require("chai");

describe("SupplyChain", function () {
  let SupplyChain, supplyChain;
  let owner, manufacturer, vendor;

  beforeEach(async function () {
    [owner, manufacturer, vendor, customer] = await ethers.getSigners();

    const SC = await ethers.getContractFactory("SupplyChain");
    supplyChain = await SC.deploy();
    await supplyChain.deployed();
  });

  it("should register users", async function () {
    await supplyChain.connect(manufacturer).registerUser("Manu1", 0); // Manufacturer
    const user = await supplyChain.returnUserInfo(manufacturer.address);
    expect(user.name).to.equal("Manu1");
  });

  it("should create and transfer product", async function () {
    await supplyChain.connect(manufacturer).registerUser("Manu1", 0);
    await supplyChain.connect(vendor).registerUser("Vendor1", 2);

    await supplyChain.connect(manufacturer).registerProduct("Laptop", "Manu1", "ABC123", "2025-09-25");

    await supplyChain.connect(manufacturer).sellProduct(vendor.address, "ABC123");

    const history = await supplyChain.products().productHistory("ABC123", 1);
    expect(history.owner).to.equal(vendor.address);
  });
});
