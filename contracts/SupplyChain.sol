// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "./Types.sol";
import "./Users.sol";
import "./Products.sol";

contract SupplyChain {
    Users public users;
    Products public products;

    constructor() {
        users = new Users();
        products = new Products();
        // link users instance to products instance
        products.setUsersContract(address(users));
    }

    function registerUser(string memory _name,Types.UserRole _role) public {
        users.addUser(_name, _role);
    }

    function returnUserInfo(address _addr) external view returns (string memory name, Types.UserRole role) {
        users.getUserInfo(_addr);
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
        products.addProduct(_name, _manufacturerName, _barcode, _manufacturedTime);
    }

    function sellProduct(address buyer, string memory _barcode) external {
        products.sell(buyer, _barcode);
    }
}