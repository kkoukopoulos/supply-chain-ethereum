// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "./Types.sol";
import "./Users.sol";
import "./Products.sol";

contract SupplyChain {
    Users public users;
    Products public products;

    constructor(address _users, address _products) {
        users = Users(_users);
        products = Products(_products);
        products.setUsersContract(_users);
    }

    function registerUser(string memory _name, Types.UserRole _role, string memory _publicKey) public {
        users.addUser(msg.sender, _name, _role, _publicKey);
    }

    function getUserByPublicKey(string memory _publicKey) external view returns (Types.User memory) {
        return users.getUserByPublicKey(_publicKey);
    }

    function returnUserInfo(address _addr) external view returns (string memory name, Types.UserRole role) {
        return users.getUserInfo(_addr);
    }

    function returnUser(address _addr) external view returns (Types.User memory) {
        return users.getUser(_addr);
    }

    function registerProduct(
        string memory _name,
        string memory _manufacturerName,
        string memory _barcode,
        string memory _manufacturedTime
    ) external {
        products.addProduct(msg.sender, _name, _manufacturerName, _barcode, _manufacturedTime);
    }

    // NEW: Transfer product using buyer's publicKey (username)
    function sellProductByPublicKey(string memory buyerPublicKey, string memory _barcode) external {
        // Get buyer's address from their publicKey
        Types.User memory buyerUser = users.getUserByPublicKey(buyerPublicKey);
        require(buyerUser.userAddress != address(0), "Buyer not found");
        
        // Call the existing sell function with the resolved address
        products.sell(msg.sender, buyerUser.userAddress, _barcode);
    }

    // Keep the original function for backward compatibility
    function sellProduct(address buyer, string memory _barcode) external {
        products.sell(msg.sender, buyer, _barcode);
    }

    function isUserManufacturer(address user) external view returns (bool) {
        Types.User memory userData = users.getUser(user);
        return userData.role == Types.UserRole.Manufacturer;
    }

    function isSaleAllowed(address seller, address buyer) external view returns (bool) {
        Types.User memory sellerUser = users.getUser(seller);
        Types.User memory buyerUser = users.getUser(buyer);
        
        if (sellerUser.role == Types.UserRole.Manufacturer) {
            return buyerUser.role == Types.UserRole.Supplier;
        } else if (sellerUser.role == Types.UserRole.Supplier) {
            return buyerUser.role == Types.UserRole.Vendor;
        } else if (sellerUser.role == Types.UserRole.Vendor) {
            return buyerUser.role == Types.UserRole.Customer;
        }
        
        return false;
    }

    // NEW: Check if sale is allowed using publicKeys
    function isSaleAllowedByPublicKey(string memory sellerPublicKey, string memory buyerPublicKey) external view returns (bool) {
        Types.User memory sellerUser = users.getUserByPublicKey(sellerPublicKey);
        Types.User memory buyerUser = users.getUserByPublicKey(buyerPublicKey);
        
        require(sellerUser.userAddress != address(0), "Seller not found");
        require(buyerUser.userAddress != address(0), "Buyer not found");
        
        if (sellerUser.role == Types.UserRole.Manufacturer) {
            return buyerUser.role == Types.UserRole.Supplier;
        } else if (sellerUser.role == Types.UserRole.Supplier) {
            return buyerUser.role == Types.UserRole.Vendor;
        } else if (sellerUser.role == Types.UserRole.Vendor) {
            return buyerUser.role == Types.UserRole.Customer;
        }
        
        return false;
    }

    function getUserInventory(address user) external view returns (string[] memory) {
        return products.getUserInventory(user);
    }

    function getUserInventoryWithDetails(address user) external view returns (Types.Product[] memory) {
        return products.getUserInventoryWithDetails(user);
    }

    function getUserInventoryByPublicKey(string memory publicKey) external view returns (string[] memory) {
        Types.User memory userData = users.getUserByPublicKey(publicKey);
        require(userData.userAddress != address(0), "User not found");
        return products.getUserInventory(userData.userAddress);
    }

    function getUserInventoryWithDetailsByPublicKey(string memory publicKey) external view returns (Types.Product[] memory) {
        Types.User memory userData = users.getUserByPublicKey(publicKey);
        require(userData.userAddress != address(0), "User not found");
        return products.getUserInventoryWithDetails(userData.userAddress);
    }

    // NEW FUNCTION: Get product by barcode (wrapper for Products contract function)
    function getProductByBarcode(string memory _barcode) external view returns (Types.Product memory) {
        return products.getProductByBarcode(_barcode);
    }
}