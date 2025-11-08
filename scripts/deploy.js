const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Supply Chain Contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Users contract
  console.log("Deploying Users contract...");
  const Users = await ethers.getContractFactory("Users");
  const users = await Users.deploy();
  await users.waitForDeployment();
  const usersAddress = await users.getAddress();
  console.log("Users deployed to:", usersAddress);

  // Deploy Products contract
  console.log("Deploying Products contract...");
  const Products = await ethers.getContractFactory("Products");
  const products = await Products.deploy();
  await products.waitForDeployment();
  const productsAddress = await products.getAddress();
  console.log("Products deployed to:", productsAddress);

  // Deploy SupplyChain contract
  console.log("Deploying SupplyChain contract...");
  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy(usersAddress, productsAddress);
  await supplyChain.waitForDeployment();
  const supplyChainAddress = await supplyChain.getAddress();
  console.log("SupplyChain deployed to:", supplyChainAddress);

  // Set the Users contract in Products contract
  console.log("Setting Users contract in Products...");
  await products.setUsersContract(usersAddress);
  console.log("Users contract set in Products");

  // Save the addresses to a file for frontend use
  const addresses = {
    users: usersAddress,
    products: productsAddress,
    supplyChain: supplyChainAddress
  };

  console.log("\nAll contracts deployed successfully");
  console.log("======================================");
  console.log("Users:", usersAddress);
  console.log("Products:", productsAddress);
  console.log("SupplyChain:", supplyChainAddress);
  console.log("======================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });