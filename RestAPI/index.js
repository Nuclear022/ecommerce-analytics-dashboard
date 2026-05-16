const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // 1. Importamos JWT
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Clave secreta para firmar los tokens (En producción debe ir en el .env)
const JWT_SECRET = process.env.JWT_SECRET || 'mi_clave_secreta_super_segura_com6023m';

// --- CONFIGURACIÓN DE BASE DE DATOS ---
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '220204',
    database: process.env.DB_NAME || 'ecommerce_analytics',
    waitForConnections: true,
    connectionLimit: 10
}).promise();


// --- 2. MIDDLEWARE DE AUTENTICACIÓN (EL GUARDIÁN) ---
function authenticateToken(req, res, next) {
    // Buscamos el token en las cabeceras de la petición (Authorization Header)
    const authHeader = req.headers['authorization'];
    // El formato estándar de la industria es: "Bearer ENORME_CADENA_DEL_TOKEN"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: "Acceso denegado: Token no provisto" });
    }

    // Verificamos si el token es real y no ha expirado
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: "Token inválido o expirado" });
        }
        req.user = user; // Guardamos los datos del usuario en la petición por si los necesitamos
        next(); // ¡Todo bien! Dejamos pasar la petición a la ruta real
    });
}


// --- RUTAS DE LA API ---

// Login modificado para generar el Token JWT
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: "Usuario no encontrado" });
        
        const isMatch = await bcrypt.compare(password, rows[0].password);
        if (!isMatch) return res.status(401).json({ error: "Contraseña incorrecta" });
        
        // --- AQUÍ GENERAMOS EL TOKEN ---
        // Guardamos el id y el username dentro del token y configuramos que expire en 2 horas
        const token = jwt.sign(
            { id: rows[0].id, username: rows[0].username }, 
            JWT_SECRET, 
            { expiresIn: '2h' }
        );

        // Devolvemos el token al cliente
        res.json({ message: "Login exitoso", token: token });

    } catch (error) {
        res.status(500).json({ error: "Error en el servidor" });
    }
});

// --- RUTAS PROTEGIDAS CON EL MIDDLEWARE ---
// Nota cómo agregamos 'authenticateToken' antes de la función asíncrona. 
// Ahora nadie podrá ver ni modificar nada sin un token válido.

app.get('/api/products', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
        `);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/products', authenticateToken, async (req, res) => {
    const { name, price, category_id, stock } = req.body;
    try {
        await pool.query('INSERT INTO products (name, price, category_id, stock) VALUES (?, ?, ?, ?)', 
            [name, price, category_id, stock || 0]);
        res.status(201).json({ message: "Producto creado" });
    } catch (error) { res.status(500).json({ error: "Error al crear producto" }); }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, price, category_id } = req.body;
    try {
        await pool.query('UPDATE products SET name = ?, price = ?, category_id = ? WHERE id = ?',
            [name.trim(), parseFloat(price), parseInt(category_id), id]);
        res.json({ message: "Producto actualizado" });
    } catch (error) { res.status(500).json({ error: "Error interno" }); }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
        res.json({ message: "Eliminado" });
    } catch (error) { res.status(500).json({ error: "No se puede eliminar" }); }
});

app.get('/api/analytics/top-selling', authenticateToken, async (req, res) => {
    try {
        const query = `
            SELECT si.sale_id, si.product_id, p.name, si.quantity as total_qty, 
            (si.quantity * p.price) as total_revenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            ORDER BY total_revenue DESC LIMIT 10
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/sales', authenticateToken, async (req, res) => {
    const { product_id, quantity } = req.body;
    try {
        const [productRows] = await pool.query('SELECT price FROM products WHERE id = ?', [product_id]);
        if (productRows.length === 0) return res.status(404).json({ error: "No existe el producto" });
        
        const unit_price = productRows[0].price;
        const [saleResult] = await pool.query('INSERT INTO sales (sale_date) VALUES (NOW())');
        const saleId = saleResult.insertId;

        await pool.query(
            'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
            [saleId, product_id, quantity, unit_price]
        );
        res.status(201).json({ message: "Venta registrada" });
    } catch (error) { res.status(500).json({ error: "Error interno" }); }
});

app.put('/api/sales/:sale_id/:product_id', authenticateToken, async (req, res) => {
    const { sale_id, product_id } = req.params;
    const { quantity } = req.body;
    try {
        await pool.query('UPDATE sale_items SET quantity = ? WHERE sale_id = ? AND product_id = ?', [quantity, sale_id, product_id]);
        res.json({ message: "Cantidad actualizada" });
    } catch (error) { res.status(500).json({ error: "Error" }); }
});

app.delete('/api/sales/:sale_id/:product_id', authenticateToken, async (req, res) => {
    const { sale_id, product_id } = req.params;
    try {
        await pool.query('DELETE FROM sale_items WHERE sale_id = ? AND product_id = ?', [sale_id, product_id]);
        res.json({ message: "Venta eliminada" });
    } catch (error) { res.status(500).json({ error: "Error" }); }
});

// Iniciar Servidor
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 API Tokenizada corriendo en http://localhost:${PORT}`));