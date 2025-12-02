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
    
    // Track product ownership by address+barcode to handle multiple instances
    mapping(address => mapping(string => uint256)) public userProductVolume;

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
        userProductVolume[_manufacturer][_barcode] = _volume;

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

        // Get current seller's volume for this product
        uint256 sellerVolume = userProductVolume[_seller][_barcode];
        require(sellerVolume >= _volume, "Insufficient volume to sell");

        // Get seller and buyer roles
        Types.User memory sellerUser = users.getUser(_seller);
        Types.User memory buyerUser = users.getUser(_buyer);
        
        // Enforce the supply chain path
        _validateTransferPath(sellerUser.role, buyerUser.role);

        // Check if seller owns this product
        require(sellerVolume > 0, "Seller does not own this product");

        // Get product details before modifying anything
        Types.Product memory originalProduct = barcodeToProduct[_barcode];

        // Update seller's volume
        userProductVolume[_seller][_barcode] = sellerVolume - _volume;
        
        // Update product volume in storage if seller's volume becomes 0
        if (userProductVolume[_seller][_barcode] == 0) {
            // Remove barcode from seller's inventory array
            _removeBarcodeFromUser(_seller, _barcode);
        }

        // Handle buyer's side
        uint256 buyerVolume = userProductVolume[_buyer][_barcode];
        
        if (buyerVolume == 0) {
            // Buyer doesn't have this product yet, add to their inventory
            userProducts[_buyer].push(_barcode);
            userProductVolume[_buyer][_barcode] = _volume;
        } else {
            // Buyer already has this product, add volume
            userProductVolume[_buyer][_barcode] = buyerVolume + _volume;
        }

        // Update the global product volume in barcodeToProduct mapping
        // This should reflect the original product's volume, not the transferred portion
        barcodeToProduct[_barcode] = Types.Product(
            originalProduct.name,
            originalProduct.manufacturerName,
            originalProduct.barcode,
            originalProduct.manufacturedTime,
            originalProduct.volume  // Keep original manufacturer's volume
        );

        emit ProductSold(_barcode, _buyer, _seller, block.timestamp, _volume);
    }

    function _removeBarcodeFromUser(address user, string memory _barcode) internal {
        string[] storage userBarcodes = userProducts[user];
        
        for (uint256 i = 0; i < userBarcodes.length; i++) {
            if (keccak256(bytes(userBarcodes[i])) == keccak256(bytes(_barcode))) {
                userBarcodes[i] = userBarcodes[userBarcodes.length - 1];
                userBarcodes.pop();
                break;
            }
        }
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
            totalVolume += userProductVolume[user][barcodes[i]];
        }
        
        return totalVolume;
    }

    function getProductVolume(address user, string memory _barcode) public view returns (uint256) {
        return userProductVolume[user][_barcode];
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
            Types.Product memory baseProduct = barcodeToProduct[barcodes[i]];
            uint256 userVolume = userProductVolume[user][barcodes[i]];
            
            inventory[i] = Types.Product(
                baseProduct.name,
                baseProduct.manufacturerName,
                baseProduct.barcode,
                baseProduct.manufacturedTime,
                userVolume  // Use the user's specific volume
            );
        }
        
        return inventory;
    }
}