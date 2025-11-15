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
        string barcode,
        address buyer,
        address seller,
        uint256 transferTime
    );

    modifier onlyManufacturer(address _manufacturer) {
        Types.User memory user = users.getUser(_manufacturer);
        require(user.role == Types.UserRole.Manufacturer, "Only manufacturer can add products");
        require(bytes(user.name).length > 0, "User not registered");
        _;
    }

    modifier onlyRegisteredUser(address _user) {
        Types.User memory user = users.getUser(_user);
        require(bytes(user.name).length > 0, "User not registered");
        _;
    }

    function setUsersContract(address _users) public {
        users = Users(_users);
    }

    function addProduct(
        address _manufacturer,
        string memory _name,
        string memory _manufacturerName,
        string memory _barcode,
        string memory _manufacturedTime
    ) public onlyManufacturer(_manufacturer) {
        require(!productExists[_barcode], "Product with this barcode already exists");
        require(bytes(_name).length > 0, "Product name cannot be empty");
        require(bytes(_barcode).length > 0, "Barcode cannot be empty");
        
        Types.Product memory newProduct = Types.Product(_name, _manufacturerName, _barcode, _manufacturedTime);
        products.push(newProduct);
        barcodeToProduct[_barcode] = newProduct;
        productExists[_barcode] = true;

        userProducts[_manufacturer].push(_barcode);

        productHistory[_barcode].push(Types.ProductHistory({
            owner: _manufacturer,
            timestamp: block.timestamp
        }));

        emit NewProduct(_manufacturer, _name, _manufacturerName, _barcode, _manufacturedTime);
    }

    function sell(address _seller, address _buyer, string memory _barcode) 
        public 
        onlyRegisteredUser(_seller) 
        onlyRegisteredUser(_buyer) 
    {
        require(productExists[_barcode], "Product not found");
        require(_seller != _buyer, "Cannot sell to yourself");

        // Get seller and buyer roles
        Types.User memory sellerUser = users.getUser(_seller);
        Types.User memory buyerUser = users.getUser(_buyer);
        
        // Get current product history
        Types.ProductHistory[] storage history = productHistory[_barcode];
        require(history.length > 0, "Product has no history");
        
        address currentOwner = history[history.length - 1].owner;
        require(currentOwner == _seller, "Only current owner can sell product");
        
        // Enforce the supply chain path
        _validateTransferPath(sellerUser.role, buyerUser.role);

        // Remove from seller and add to buyer
        _transferOwnership(_seller, _buyer, _barcode);

        // Log new owner
        history.push(Types.ProductHistory({
            owner: _buyer,
            timestamp: block.timestamp
        }));

        emit ProductOwnershipTransfer(_barcode, _buyer, _seller, block.timestamp);
    }

    function _validateTransferPath(Types.UserRole sellerRole, Types.UserRole buyerRole) internal pure {
        if (sellerRole == Types.UserRole.Manufacturer) {
            require(buyerRole == Types.UserRole.Supplier, "Manufacturer can only sell to Supplier");
        } else if (sellerRole == Types.UserRole.Supplier) {
            require(buyerRole == Types.UserRole.Vendor, "Supplier can only sell to Vendor");
        } else if (sellerRole == Types.UserRole.Vendor) {
            require(buyerRole == Types.UserRole.Customer, "Vendor can only sell to Customer");
        } else {
            revert("Customer cannot sell the product");
        }
    }

    function _transferOwnership(address _seller, address _buyer, string memory _barcode) internal {
        // Remove from seller
        string[] storage sellerProducts = userProducts[_seller];
        bool found = false;
        
        for (uint256 i = 0; i < sellerProducts.length; i++) {
            if (keccak256(bytes(sellerProducts[i])) == keccak256(bytes(_barcode))) {
                sellerProducts[i] = sellerProducts[sellerProducts.length - 1];
                sellerProducts.pop();
                found = true;
                break;
            }
        }
        
        require(found, "Product not in seller inventory");

        // Add to buyer
        userProducts[_buyer].push(_barcode);
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

    function getProductHistory(string memory _barcode) public view returns (Types.ProductHistory[] memory) {
        require(productExists[_barcode], "Product not found");
        return productHistory[_barcode];
    }

    function isUserManufacturer(address user) public view returns (bool) {
        Types.User memory userData = users.getUser(user);
        return userData.role == Types.UserRole.Manufacturer;
    }

    function getUserInventory(address user) public view returns (string[] memory) {
        return userProducts[user];
    }

    function getUserInventoryWithDetails(address user) public view returns (Types.Product[] memory) {
        string[] memory barcodes = userProducts[user];
        Types.Product[] memory inventory = new Types.Product[](barcodes.length);
        
        for (uint i = 0; i < barcodes.length; i++) {
            inventory[i] = barcodeToProduct[barcodes[i]];
        }
        
        return inventory;
    }
}