USE ecommerce_analytics;

-- 1. Limpiamos datos previos para evitar conflictos de ID (Opcional pero recomendado para pruebas)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE sale_items;
TRUNCATE TABLE sales;
TRUNCATE TABLE products;
SET FOREIGN_KEY_CHECKS = 1;

-- 2. Insertar Productos con IDs fijos (usamos 1, 2, 3... explícitamente)
INSERT INTO products (id, name, price, stock, category_id) VALUES 
(1, 'Laptop Pro', 1200.50, 15, 1),
(2, 'Monitor Gaming', 299.99, 8, 1),
(3, 'Zapatillas Running', 85.00, 25, 4),
(4, 'Raqueta de Tenis', 120.00, 10, 4),
(5, 'Set de Construcción', 55.99, 40, 5),
(6, 'Guía de Programación', 45.00, 30, 6);

-- 3. Insertar Ventas con IDs fijos
INSERT INTO sales (id, customer_name) VALUES 
(1, 'Maria Garcia'), 
(2, 'Carlos Rodriguez'), 
(3, 'Ana Martinez');

-- 4. Insertar Ítems de Venta usando los IDs que acabamos de forzar arriba
INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES 
(1, 3, 2, 85.00),   -- Maria (Venta 1) compró Zapatillas (Prod 3)
(1, 2, 1, 299.99),  -- Maria (Venta 1) compró Monitor (Prod 2)
(2, 5, 3, 55.99),   -- Carlos (Venta 2) compró Set Construcción (Prod 5)
(3, 1, 1, 1200.50), -- Ana (Venta 3) compró Laptop (Prod 1)
(3, 6, 2, 45.00);   -- Ana (Venta 3) compró Guía (Prod 6)