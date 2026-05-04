-- Enable UUID generation extension (usually enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. User Scans History Table
CREATE TABLE IF NOT EXISTS user_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    barcode VARCHAR(255) NOT NULL,
    product_name VARCHAR(255),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products (Business Entities) Table
CREATE TABLE IF NOT EXISTS products (
    barcode VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    image_url TEXT,
    nutriscore VARCHAR(10),
    ecoscore VARCHAR(10),
    ingredients_text TEXT,
    additives_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Optional: How to promote a user to admin manually
-- UPDATE users SET role = 'admin' WHERE email = 'example@example.com';
