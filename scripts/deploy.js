const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const DatabaseModels = require("../db/models");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Deploy Users contract
  const Users = await ethers.getContractFactory("Users");
  const users = await Users.deploy();
  await users.waitForDeployment();
  console.log("Users contract deployed to:", await users.getAddress());

  // Deploy Products contract
  const Products = await ethers.getContractFactory("Products");
  const products = await Products.deploy();
  await products.waitForDeployment();
  console.log("Products contract deployed to:", await products.getAddress());

  // Deploy SupplyChain contract
  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy(await users.getAddress(), await products.getAddress());
  await supplyChain.waitForDeployment();
  console.log("SupplyChain contract deployed to:", await supplyChain.getAddress());

  // Set the users contract in Products contract
  await products.setUsersContract(await users.getAddress());
  console.log("Users contract set in Products contract");

  // Save contract addresses to .env file
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  
  // Remove existing contract addresses
  envContent = envContent.replace(/CONTRACT_ADDRESS=.*\n/g, '');
  
  // Add new contract addresses
  envContent += `CONTRACT_ADDRESS=${await supplyChain.getAddress()}\n`;
  envContent += `USERS_CONTRACT_ADDRESS=${await users.getAddress()}\n`;
  envContent += `PRODUCTS_CONTRACT_ADDRESS=${await products.getAddress()}\n`;
  
  fs.writeFileSync(envPath, envContent);
  console.log("Contract addresses saved to .env file");

  // Initialize database with contract info
  try {
    await DatabaseModels.logEvent({
      eventName: 'ContractDeployment',
      contractAddress: await supplyChain.getAddress(),
      transactionHash: supplyChain.deploymentTransaction().hash,
      blockNumber: await ethers.provider.getBlockNumber(),
      eventData: {
        deployer: deployer.address,
        usersContract: await users.getAddress(),
        productsContract: await products.getAddress(),
        supplyChainContract: await supplyChain.getAddress()
      }
    });
    console.log("Deployment logged to database");
  } catch (error) {
    console.log("Database logging skipped (database might not be set up)");
  }

  return {
    users: await users.getAddress(),
    products: await products.getAddress(),
    supplyChain: await supplyChain.getAddress()
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });