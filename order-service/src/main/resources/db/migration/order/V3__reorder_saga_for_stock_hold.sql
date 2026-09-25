UPDATE orders
SET status = 'CANCELLED',
    failure_reason = COALESCE(failure_reason, 'superseded by saga migration')
WHERE status NOT IN ('COMPLETED', 'CANCELLED');

ALTER TABLE orders ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE orders ADD COLUMN payment_key VARCHAR(200);
ALTER TABLE orders ADD COLUMN payment_deadline TIMESTAMPTZ;

CREATE INDEX idx_orders_awaiting_payment_deadline ON orders (payment_deadline) WHERE status = 'AWAITING_PAYMENT';
