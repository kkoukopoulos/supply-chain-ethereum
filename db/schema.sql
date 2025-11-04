-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_address VARCHAR(42) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Manufacturer', 'Supplier', 'Vendor', 'Customer')),
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    manufacturer_name VARCHAR(255) NOT NULL,
    manufactured_time VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blockchain_created_block BIGINT
);

-- Product history table
CREATE TABLE IF NOT EXISTS product_history (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(255) NOT NULL REFERENCES products(barcode),
    owner_address VARCHAR(42) NOT NULL,
    transaction_type VARCHAR(20) DEFAULT 'TRANSFER',
    timestamp TIMESTAMP NOT NULL,
    blockchain_timestamp BIGINT NOT NULL,
    transaction_hash VARCHAR(66),
    block_number BIGINT
);

-- Extended product details
CREATE TABLE IF NOT EXISTS product_details (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(255) UNIQUE NOT NULL REFERENCES products(barcode),
    description TEXT,
    category VARCHAR(100),
    weight DECIMAL,
    dimensions VARCHAR(50),
    image_url VARCHAR(500),
    specifications JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Supply chain metrics
CREATE TABLE IF NOT EXISTS supply_chain_metrics (
    id SERIAL PRIMARY KEY,
    barcode VARCHAR(255) NOT NULL REFERENCES products(barcode),
    from_role VARCHAR(20) NOT NULL,
    to_role VARCHAR(20) NOT NULL,
    transfer_days INTEGER,
    gas_used DECIMAL,
    gas_cost DECIMAL,
    transaction_hash VARCHAR(66),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events log for auditing
CREATE TABLE IF NOT EXISTS events_log (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    transaction_hash VARCHAR(66) NOT NULL,
    block_number BIGINT NOT NULL,
    event_data JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_address ON users(user_address);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_product_history_barcode ON product_history(barcode);
CREATE INDEX IF NOT EXISTS idx_product_history_owner ON product_history(owner_address);
CREATE INDEX IF NOT EXISTS idx_product_history_timestamp ON product_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_block_number ON events_log(block_number);