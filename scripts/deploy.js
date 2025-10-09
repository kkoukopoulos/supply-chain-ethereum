const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying Supply Chain contracts...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  // Fix for getBalance issue - use different approach
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  try {
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
    console.log("🔗 Deploying SupplyChain contract...");
    const SupplyChain = await ethers.getContractFactory("SupplyChain");
    const supplyChain = await SupplyChain.deploy(usersAddress, productsAddress);
    await supplyChain.waitForDeployment();
    const supplyChainAddress = await supplyChain.getAddress();
    console.log("SupplyChain deployed to:", supplyChainAddress);

    // Set the Users contract in Products
    console.log("Linking contracts...");
    const tx = await products.setUsersContract(usersAddress);
    await tx.wait();
    console.log("Contracts linked successfully");

    // Save addresses to a file for easy reference
    const fs = require("fs");
    const addresses = {
      users: usersAddress,
      products: productsAddress,
      supplyChain: supplyChainAddress,
      network: "localhost"
    };
    
    fs.writeFileSync("deployed-addresses.json", JSON.stringify(addresses, null, 2));
    console.log("Addresses saved to deployed-addresses.json");

    console.log("All contracts deployed successfully!");
    console.log("\n Contract Addresses:");
    console.log("   Users:", usersAddress);
    console.log("   Products:", productsAddress);
    console.log("   SupplyChain:", supplyChainAddress);

    return addresses;

  } catch (error) {
    console.error("Deployment error:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });