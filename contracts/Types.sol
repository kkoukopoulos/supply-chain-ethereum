// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

library Types {
    enum UserRole {
        Manufacturer,
        Supplier,
        Vendor,
        Customer
    }
    
    struct User {
        address userAddress;
        string name;
        UserRole role;
    }

    struct Product {
        string name;
        string manufacturerName;
        string barcode;
        string manufacturedTime;
    }

    struct ProductHistory {
        address owner;
        uint256 timestamp;
    }
}