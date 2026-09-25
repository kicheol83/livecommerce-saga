ALTER TABLE product_stock ADD COLUMN unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

UPDATE product_stock SET unit_price = 39000 WHERE product_id = '11111111-1111-1111-1111-111111111111';

ALTER TABLE inventory_reservations ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE inventory_reservations ADD COLUMN expires_at TIMESTAMPTZ;

UPDATE inventory_reservations SET status = 'RELEASED' WHERE released = TRUE;

ALTER TABLE inventory_reservations DROP COLUMN released;
ALTER TABLE inventory_reservations ALTER COLUMN status DROP DEFAULT;

CREATE INDEX idx_reservations_held_expires_at ON inventory_reservations (expires_at) WHERE status = 'HELD';
