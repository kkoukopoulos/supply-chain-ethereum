const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying Supply Chain Contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy in sequence
  const Users = await ethers.getContractFactory("Users");
  const users = await Users.deploy();
  await users.waitForDeployment();

  const Products = await ethers.getContractFactory("Products");
  const products = await Products.deploy();
  await products.waitForDeployment();

  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy(await users.getAddress(), await products.getAddress());
  await supplyChain.waitForDeployment();

  // Connect contracts
  await products.setUsersContract(await users.getAddress());

  console.log("\n✅ Deployment Complete!");
  console.log("Users:", await users.getAddress());
  console.log("Products:", await products.getAddress());
  console.log("SupplyChain:", await supplyChain.getAddress());

  // Save addresses
  const addresses = {
    users: await users.getAddress(),
    products: await products.getAddress(),
    supplyChain: await supplyChain.getAddress()
  };
  
  require('fs').writeFileSync('deployed-addresses.json', JSON.stringify(addresses, null, 2));
  console.log("📄 Addresses saved to deployed-addresses.json");
}

main().catch(console.error);