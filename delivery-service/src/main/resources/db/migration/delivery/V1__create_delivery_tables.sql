CREATE TABLE deliveries (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE,
    member_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    recipient_name VARCHAR(30) NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    zip_code VARCHAR(5) NOT NULL,
    address_line1 VARCHAR(200) NOT NULL,
    address_line2 VARCHAR(100),
    carrier VARCHAR(50) NOT NULL,
    tracking_number VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL,
    ordered_at TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deliveries_member_id ON deliveries (member_id);

CREATE TABLE tracking_events (
    id UUID PRIMARY KEY,
    delivery_id UUID NOT NULL REFERENCES deliveries (id),
    event_id VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL,
    location VARCHAR(100) NOT NULL,
    description VARCHAR(200) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tracking_events_delivery_occurred ON tracking_events (delivery_id, occurred_at);

CREATE TABLE courier_jobs (
    tracking_number VARCHAR(20) PRIMARY KEY,
    region VARCHAR(30) NOT NULL,
    recipient_name VARCHAR(30) NOT NULL,
    step INTEGER NOT NULL DEFAULT 0,
    next_event_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_courier_jobs_due ON courier_jobs (next_event_at);
