// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.30;

import "./Types.sol";
import "./Users.sol";

contract Products {
    Users public users;
    Types.Product[] public products;
    mapping(address => string[]) public userProducts;
    mapping(string => bool) public productExists;
    mapping(string => Types.Product) public barcodeToProduct;

    event NewProduct(
        address manufacturer,
        string name,
        string manufacturerName,
        string barcode,
        string manufacturedTime,
        uint256 volume
    );

    event ProductSold(
        string barcode,
        address buyer,
        address seller,
        uint256 transferTime,
        uint256 volume
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
        string memory _manufacturedTime,
        uint256 _volume
    ) public onlyManufacturer(_manufacturer) {
        require(!productExists[_barcode], "Product with this barcode already exists");
        require(bytes(_name).length > 0, "Product name cannot be empty");
        require(bytes(_barcode).length > 0, "Barcode cannot be empty");
        require(_volume > 0, "Volume must be greater than zero");
        
        Types.Product memory newProduct = Types.Product(_name, _manufacturerName, _barcode, _manufacturedTime, _volume);
        products.push(newProduct);
        barcodeToProduct[_barcode] = newProduct;
        productExists[_barcode] = true;

        userProducts[_manufacturer].push(_barcode);

        emit NewProduct(_manufacturer, _name, _manufacturerName, _barcode, _manufacturedTime, _volume);
    }

    function sell(
        address _seller, 
        address _buyer, 
        string memory _barcode,
        uint256 _volume
    ) 
        public 
        onlyRegisteredUser(_seller) 
        onlyRegisteredUser(_buyer) 
    {
        require(productExists[_barcode], "Product not found");
        require(_seller != _buyer, "Cannot sell to yourself");
        require(_volume > 0, "Volume must be greater than zero");

        Types.Product storage product = barcodeToProduct[_barcode];
        require(product.volume >= _volume, "Insufficient volume to sell");

        // Get seller and buyer roles
        Types.User memory sellerUser = users.getUser(_seller);
        Types.User memory buyerUser = users.getUser(_buyer);
        
        // Enforce the supply chain path
        _validateTransferPath(sellerUser.role, buyerUser.role);

        // Check if seller owns this product
        bool sellerOwnsProduct = false;
        string[] storage sellerProducts = userProducts[_seller];
        for (uint256 i = 0; i < sellerProducts.length; i++) {
            if (keccak256(bytes(sellerProducts[i])) == keccak256(bytes(_barcode))) {
                sellerOwnsProduct = true;
                break;
            }
        }
        require(sellerOwnsProduct, "Seller does not own this product");

        // If selling entire volume, transfer the product completely to buyer
        if (_volume == product.volume) {
            // Remove from seller
            for (uint256 i = 0; i < sellerProducts.length; i++) {
                if (keccak256(bytes(sellerProducts[i])) == keccak256(bytes(_barcode))) {
                    sellerProducts[i] = sellerProducts[sellerProducts.length - 1];
                    sellerProducts.pop();
                    break;
                }
            }
            
            // Add to buyer
            userProducts[_buyer].push(_barcode);
        } else {
            // Partial transfer - reduce seller's volume
            product.volume -= _volume;
            
            // Create new product entry for buyer with the transferred volume
            Types.Product memory newProduct = Types.Product(
                product.name,
                product.manufacturerName,
                _barcode,
                product.manufacturedTime,
                _volume
            );
            
            products.push(newProduct);
            userProducts[_buyer].push(_barcode);
        }

        emit ProductSold(_barcode, _buyer, _seller, block.timestamp, _volume);
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

    function getProductByBarcode(string memory _barcode) public view returns (Types.Product memory) {
        require(productExists[_barcode], "Product not found");
        return barcodeToProduct[_barcode];
    }

    function getUserProductCount(address user) public view returns (uint) {
        return userProducts[user].length;
    }

    function getUserTotalVolume(address user) public view returns (uint256) {
        string[] memory barcodes = userProducts[user];
        uint256 totalVolume = 0;
        
        for (uint i = 0; i < barcodes.length; i++) {
            totalVolume += barcodeToProduct[barcodes[i]].volume;
        }
        
        return totalVolume;
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