ALTER TABLE payments ADD COLUMN payment_key VARCHAR(200);
ALTER TABLE payments ADD COLUMN method VARCHAR(50);
ALTER TABLE payments ADD COLUMN approved_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN failure_code VARCHAR(100);
ALTER TABLE payments ADD COLUMN failure_message VARCHAR(500);
ALTER TABLE payments ADD COLUMN cancelled_at TIMESTAMPTZ;

UPDATE payments SET status = 'CONFIRMED' WHERE status = 'RESERVED';
