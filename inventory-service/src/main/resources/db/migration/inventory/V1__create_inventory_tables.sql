CREATE TABLE product_stock (
    product_id UUID PRIMARY KEY,
    quantity_available INTEGER NOT NULL CHECK (quantity_available >= 0)
);

CREATE TABLE inventory_reservations (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL UNIQUE,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
