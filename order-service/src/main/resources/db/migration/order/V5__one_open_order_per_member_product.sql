CREATE UNIQUE INDEX uq_orders_one_open_per_member_product
    ON orders (member_id, product_id)
    WHERE status IN ('AWAITING_STOCK', 'AWAITING_PAYMENT', 'PAYMENT_CONFIRMING', 'CONFIRMING_STOCK');
