const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Supply Chain Contracts...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Deploy
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

  console.log("\nDeployment Complete");
  console.log("Users:", await users.getAddress());
  console.log("Products:", await products.getAddress());
  console.log("SupplyChain:", await supplyChain.getAddress());
}

main().catch(console.error);