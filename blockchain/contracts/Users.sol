// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "./Types.sol";

contract Users {
    uint public userCount = 0;
    mapping(address => Types.User) public users;
    mapping(string => address) public publicKeyToAddress; // Map public key to address

    event NewUser(
        address userAddress,
        string name,
        Types.UserRole role,
        string publicKey
    );

    function addUser(address _userAddress, string memory _name, Types.UserRole _role, string memory _publicKey) public {
        // Check if user exists
        if (bytes(users[_userAddress].name).length == 0) {
            userCount += 1;
        }
        
        // Check if public key is already registered
        require(publicKeyToAddress[_publicKey] == address(0), "Public key already registered");
        
        users[_userAddress] = Types.User(_userAddress, _name, _role, _publicKey);
        publicKeyToAddress[_publicKey] = _userAddress; // Store mapping
        
        emit NewUser(_userAddress, _name, _role, _publicKey);
    }

    function getUserByPublicKey(string memory _publicKey) external view returns (Types.User memory) {
        address userAddress = publicKeyToAddress[_publicKey];
        require(userAddress != address(0), "User not found");
        return users[userAddress];
    }

    function getUserInfo(address _addr) external view returns (string memory name, Types.UserRole role) {
        Types.User memory usr = users[_addr];
        return (usr.name, usr.role);
    }

    function getUser(address _addr) external view returns (Types.User memory) {
        return users[_addr];
    }
}