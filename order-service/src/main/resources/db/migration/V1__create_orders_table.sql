CREATE TABLE orders (
    id UUID PRIMARY KEY,
    member_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(30) NOT NULL,
    failure_reason VARCHAR(255),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_member_id ON orders (member_id);
CREATE INDEX idx_orders_status ON orders (status);
