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

    function registerUser(string memory _name, Types.UserRole _role) public {
        users.addUser(msg.sender, _name, _role);
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
}