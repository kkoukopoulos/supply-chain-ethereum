// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "./Types.sol";
import "./Users.sol";

contract Products {
    Users public users;
    Types.Product[] public products;
    mapping(address => string[]) public userProducts;
    mapping(string => Types.ProductHistory[]) public productHistory;

    event NewProduct(
        string name,
        string manufacturerName,
        string barcode,
        string manufacturedTime
    );

    event ProductOwnershipTransfer(
        string name,
        string manufacturerName,
        string barcode,
        string buyerName,
        string sellerName,
        uint256 transferTime
    );

    modifier onlyManufacturer() {
        Types.User memory usr = users.getUser(msg.sender);
        require(usr.role == Types.UserRole.Manufacturer, "Only manufacturer can add products.");
        _;
    }

    // link with Users contract
    function setUsersContract(address _users) public {
        users = Users(_users);
    }

    function addProduct(
        string memory _name,
        string memory _manufacturerName,
        string memory _barcode,
        string memory _manufacturedTime
    ) public onlyManufacturer {
        products.push(Types.Product(_name, _manufacturerName, _barcode, _manufacturedTime));
        Types.Product memory _product = products[products.length - 1];

        // Save barcode under sender's products
        userProducts[msg.sender].push(_barcode);

        productHistory[_product.barcode].push(Types.ProductHistory({
            owner: msg.sender,
            timestamp: block.timestamp
        }));

        emit NewProduct(
            _product.name,
            _product.manufacturerName,
            _product.barcode,
            _product.manufacturedTime
        );
    }

    function sell(address buyer, string memory _barcode) public {
        // Find product
        Types.Product memory _product;
        bool found = false;
        for (uint i = 0; i < products.length; i++) {
            if (keccak256(bytes(products[i].barcode)) == keccak256(bytes(_barcode))) {
                _product = products[i];
                found = true;
                break;
            }
        }
        require(found, "Product not found");

        // Ensure seller owns it
        string[] storage sellerProducts = userProducts[msg.sender];
        uint256 productIndex = sellerProducts.length;
        for (uint256 i = 0; i < sellerProducts.length; i++) {
            if (keccak256(bytes(sellerProducts[i])) == keccak256(bytes(_barcode))) {
                productIndex = i;
                break;
            }
        }
        require(productIndex < sellerProducts.length, "Product not in seller inventory");

        // Remove from seller
        if (productIndex < sellerProducts.length - 1) {
            sellerProducts[productIndex] = sellerProducts[sellerProducts.length - 1];
        }
        sellerProducts.pop();

        // Add to buyer
        userProducts[buyer].push(_barcode);

        // Log new owner
        productHistory[_barcode].push(Types.ProductHistory({
            owner: buyer,
            timestamp: block.timestamp
        }));

        string memory buyerName = users.getUser(buyer).name;
        string memory sellerName = users.getUser(msg.sender).name;

        emit ProductOwnershipTransfer(
            _product.name,
            _product.manufacturerName,
            _product.barcode,
            buyerName,
            sellerName,
            block.timestamp
        );
    }
}
