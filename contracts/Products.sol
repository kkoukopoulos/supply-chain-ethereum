// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "./Types.sol";
import "./Users.sol";

contract Products {
    Users public users;
    Types.Product[] public products;
    mapping(address => string[]) public userProducts;
    mapping(string => Types.ProductHistory[]) public productHistory;
    mapping(string => bool) public productExists;
    mapping(string => Types.Product) public barcodeToProduct;

    event NewProduct(
        address manufacturer,
        string name,
        string manufacturerName,
        string barcode,
        string manufacturedTime
    );

    event ProductOwnershipTransfer(
        string name,
        string manufacturerName,
        string barcode,
        address buyer,
        address seller,
        uint256 transferTime
    );

    function setUsersContract(address _users) public {
        users = Users(_users);
    }

    function addProduct(
        address _manufacturer, // Add manufacturer address as parameter
        string memory _name,
        string memory _manufacturerName,
        string memory _barcode,
        string memory _manufacturedTime
    ) public {
        require(!productExists[_barcode], "Product with this barcode already exists");
        
        Types.Product memory newProduct = Types.Product(_name, _manufacturerName, _barcode, _manufacturedTime);
        products.push(newProduct);
        barcodeToProduct[_barcode] = newProduct;
        productExists[_barcode] = true;

        // Save barcode under manufacturer's products
        userProducts[_manufacturer].push(_barcode);

        productHistory[_barcode].push(Types.ProductHistory({
            owner: _manufacturer,
            timestamp: block.timestamp
        }));

        emit NewProduct(_manufacturer, _name, _manufacturerName, _barcode, _manufacturedTime);
    }

    function sell(address _seller, address _buyer, string memory _barcode) public {
        require(productExists[_barcode], "Product not found");

        // Ensure seller owns it
        string[] storage sellerProducts = userProducts[_seller];
        bool foundInInventory = false;
        uint256 productIndex = sellerProducts.length;
        
        for (uint256 i = 0; i < sellerProducts.length; i++) {
            if (keccak256(bytes(sellerProducts[i])) == keccak256(bytes(_barcode))) {
                productIndex = i;
                foundInInventory = true;
                break;
            }
        }
        
        require(foundInInventory, "Product not in seller inventory");

        // Remove from seller
        sellerProducts[productIndex] = sellerProducts[sellerProducts.length - 1];
        sellerProducts.pop();

        // Add to buyer
        userProducts[_buyer].push(_barcode);

        // Log new owner
        productHistory[_barcode].push(Types.ProductHistory({
            owner: _buyer,
            timestamp: block.timestamp
        }));

        emit ProductOwnershipTransfer(
            barcodeToProduct[_barcode].name,
            barcodeToProduct[_barcode].manufacturerName,
            _barcode,
            _buyer,
            _seller,
            block.timestamp
        );
    }

    function getProductByBarcode(string memory _barcode) public view returns (Types.Product memory) {
        require(productExists[_barcode], "Product not found");
        return barcodeToProduct[_barcode];
    }

    function getUserProductCount(address user) public view returns (uint) {
        return userProducts[user].length;
    }

    function getProductHistoryLength(string memory _barcode) public view returns (uint) {
        return productHistory[_barcode].length;
    }
}