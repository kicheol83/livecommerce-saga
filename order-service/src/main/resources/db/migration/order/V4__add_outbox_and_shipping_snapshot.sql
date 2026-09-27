CREATE TABLE outbox_events (
    id UUID PRIMARY KEY,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    payload TEXT NOT NULL,
    topic VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error VARCHAR(500),
    trace_parent VARCHAR(55),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_pending_created_at ON outbox_events (created_at) WHERE status = 'PENDING';

ALTER TABLE orders ADD COLUMN recipient_name VARCHAR(30);
ALTER TABLE orders ADD COLUMN recipient_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN zip_code VARCHAR(5);
ALTER TABLE orders ADD COLUMN address_line1 VARCHAR(200);
ALTER TABLE orders ADD COLUMN address_line2 VARCHAR(100);

CREATE INDEX idx_orders_member_created_at ON orders (member_id, created_at DESC);
