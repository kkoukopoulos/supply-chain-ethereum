// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "./Types.sol";

contract Users {
    uint public userCount = 0;
    mapping(address => Types.User) public users;

    event NewUser(
        address userAddress,
        string name,
        Types.UserRole role
    );

    function addUser(address _userAddress, string memory _name, Types.UserRole _role) public {
        if (bytes(users[_userAddress].name).length == 0) {
            userCount += 1;
        }
        
        users[_userAddress] = Types.User(_userAddress, _name, _role);
        emit NewUser(_userAddress, _name, _role);
    }

    function getUserInfo(address _addr) external view returns (string memory name, Types.UserRole role) {
        Types.User memory usr = users[_addr];
        return (usr.name, usr.role);
    }

    function getUser(address _addr) external view returns (Types.User memory) {
        return users[_addr];
    }
}