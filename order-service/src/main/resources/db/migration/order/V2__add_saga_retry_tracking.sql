ALTER TABLE orders ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_orders_status_updated_at ON orders (status, updated_at);
