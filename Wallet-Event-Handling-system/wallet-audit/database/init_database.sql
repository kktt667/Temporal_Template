-- Initialize wallet database schema
-- This script creates the table structure for wallet records

CREATE TABLE IF NOT EXISTS wallets (
    wallet_name TEXT PRIMARY KEY,
    rebalance INTEGER DEFAULT 0,
    open_order INTEGER DEFAULT 0,
    open_position INTEGER DEFAULT 0,
    new_balance INTEGER DEFAULT 0,
    check_balance INTEGER DEFAULT 0
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_wallet_name ON wallets(wallet_name); 