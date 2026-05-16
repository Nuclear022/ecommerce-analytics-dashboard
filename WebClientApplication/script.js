/**
 * script.js - Web Client Application (Versión Final Consolidada con JWT)
 * Módulo: Advance Web Development (COM6023M)
 * Descripción: Gestión de sesión segura, CRUD de productos/ventas, analítica dinámica
 * e integración tolerante a fallos con APIs de terceros.
 */

const API_URL = 'http://localhost:3000/api';
let salesChartInstance = null;

// --- 1. SEGURIDAD, ACCESO Y MIDDLEWARE DE CLIENTE ---

// Bloqueo de acceso inmediato si la sesión no figura activa
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'login.html';
}

/**
 * Función auxiliar para generar las cabeceras HTTP necesarias.
 * Inyecta de forma automatizada el Token JWT guardado en el localStorage
 * bajo el esquema de autenticación estándar de la industria (Bearer Token).
 */
function getAuthHeaders() {
    const token = localStorage.getItem('userToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userToken'); // Limpieza del token criptográfico por seguridad
    window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', () => {
    refreshView();
});

// --- 2. LÓGICA DE ACTUALIZACIÓN DE INTERFAZ ---

function refreshView() {
    fetchProducts();
    fetchSalesList();
    renderAnalytics();
    updateCurrencyConversion();
}

// --- 3. GESTIÓN DE PRODUCTOS (CRUD) ---

async function fetchProducts() {
    try {
        const response = await fetch(`${API_URL}/products`, {
            headers: getAuthHeaders() // Petición protegida
        });
        if (!response.ok) throw new Error('Error en la petición');
        
        const products = await response.json();
        const tbody = document.getElementById('product-table-body');
        
        tbody.innerHTML = products.map(p => `
            <tr id="product-row-${p.id}" class="hover:bg-gray-50 transition border-b text-sm">
                <td class="px-6 py-4 font-medium text-gray-900 product-name">${p.name} (ID: ${p.id})</td>
                
                <td class="px-6 py-4 product-category" data-category-id="${p.category_id}">
                    <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full uppercase font-bold">
                        ${p.category_name || 'Sin categoría'}
                    </span>
                </td>
                
                <td class="px-6 py-4 font-bold text-blue-600 product-price">$${Number(p.price).toFixed(2)}</td>
                
                <td class="px-6 py-4 text-center space-x-2 action-buttons">
                    <button onclick="editProductInline(${p.id}, '${p.name}', ${p.price}, ${p.category_id})" 
                            class="text-amber-500 hover:text-amber-700 font-bold uppercase tracking-wider text-xs">
                        Editar
                    </button>
                    <button onclick="deleteProduct(${p.id})" 
                            class="text-red-500 hover:text-red-700 font-bold transition uppercase tracking-wider text-xs">
                        Eliminar
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showStatus('Error al conectar con la API o sesión expirada', false);
    }
}

function editProductInline(id, currentName, currentPrice, currentCategoryId) {
    const row = document.getElementById(`product-row-${id}`);
    
    row.innerHTML = `
        <td class="px-6 py-4">
            <input type="text" id="edit-name-${id}" value="${currentName}" 
                   class="w-full border rounded p-1 font-medium text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none">
        </td>
        <td class="px-6 py-4">
            <input type="number" id="edit-category-${id}" value="${currentCategoryId}" placeholder="ID Cat (1-6)"
                   class="w-20 border rounded text-center p-1 focus:ring-2 focus:ring-blue-500 outline-none">
        </td>
        <td class="px-6 py-4">
            <input type="number" id="edit-price-${id}" value="${currentPrice}" step="0.01"
                   class="w-24 border rounded p-1 font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none">
        </td>
        <td class="px-6 py-4 text-center space-x-2">
            <button onclick="saveProductInline(${id})" 
                    class="text-green-600 hover:text-green-800 font-bold uppercase tracking-wider text-xs">
                Guardar
            </button>
            <button onclick="refreshView()" 
                    class="text-gray-500 hover:text-gray-700 font-bold uppercase tracking-wider text-xs">
                Cancelar
            </button>
        </td>
    `;
}

async function saveProductInline(id) {
    const newName = document.getElementById(`edit-name-${id}`).value.trim();
    const newCategory = document.getElementById(`edit-category-${id}`).value;
    const newPrice = document.getElementById(`edit-price-${id}`).value;

    if (!newName || !newCategory || !newPrice) {
        return showStatus("Todos los campos son obligatorios", false);
    }

    try {
        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(), // Inyección automatizada de Token
            body: JSON.stringify({
                name: newName,
                category_id: parseInt(newCategory),
                price: parseFloat(newPrice)
            })
        });

        if (response.ok) {
            showStatus("Producto actualizado con éxito", true);
            refreshView(); 
        } else {
            const err = await response.json();
            showStatus(err.error || "Error al actualizar el producto", false);
        }
    } catch (e) {
        showStatus("Error de conexión al actualizar", false);
    }
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        name: document.getElementById('name').value.trim(),
        price: parseFloat(document.getElementById('price').value),
        category_id: parseInt(document.getElementById('category_id').value),
        stock: 10
    };

    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: getAuthHeaders(), // Cabeceras con JWT Bearer
            body: JSON.stringify(data)
        });

        if (response.ok) {
            showStatus('¡Producto guardado con éxito!', true);
            e.target.reset();
            refreshView();
        } else {
            const err = await response.json();
            showStatus(err.error || 'Error al guardar el producto', false);
        }
    } catch (error) {
        showStatus('Error de conexión', false);
    }
});

async function deleteProduct(id) {
    if (!confirm('¿Eliminar producto?')) return;
    try {
        const response = await fetch(`${API_URL}/products/${id}`, { 
            method: 'DELETE',
            headers: getAuthHeaders() // Acción crítica protegida
        });
        if (response.ok) {
            showStatus('Producto eliminado', true);
            refreshView();
        } else {
            const err = await response.json();
            showStatus(err.error || 'No se puede eliminar el producto', false);
        }
    } catch (error) {
        showStatus('Error de red', false);
    }
}

// --- 4. GESTIÓN DE VENTAS ---

async function fetchSalesList() {
    try {
        const response = await fetch(`${API_URL}/analytics/top-selling`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('No autorizado o error de red');
        
        const sales = await response.json();
        const tbody = document.getElementById('sales-table-body');
        
        tbody.innerHTML = sales.map(s => `
            <tr class="hover:bg-gray-50 border-b text-sm">
                <td class="px-6 py-4 text-gray-800 font-medium">${s.name}</td>
                <td class="px-6 py-4">
                    <input type="number" value="${s.total_qty}" 
                           onchange="updateSaleQty(${s.sale_id}, ${s.product_id}, this.value)"
                           class="w-16 border rounded text-center shadow-sm p-1 focus:ring-2 focus:ring-blue-500 outline-none">
                </td>
                <td class="px-6 py-4 font-bold text-green-600">$${Number(s.total_revenue).toFixed(2)}</td>
                <td class="px-6 py-4 text-center">
                    <button onclick="deleteSale(${s.sale_id}, ${s.product_id})" 
                            class="text-red-500 hover:text-red-700 font-bold text-lg">✕</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { console.error('Error al cargar ventas:', e); }
}

async function addSale() {
    const product_id = document.getElementById('sale_product_id').value;
    const qty = document.getElementById('sale_qty').value;
    
    if (!product_id || !qty) return showStatus("Ingresa ID de producto y cantidad", false);

    try {
        const response = await fetch(`${API_URL}/sales`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ 
                product_id: parseInt(product_id), 
                quantity: parseInt(qty) 
            })
        });

        if (response.ok) {
            showStatus("Venta registrada con éxito", true);
            document.getElementById('sale_product_id').value = '';
            document.getElementById('sale_qty').value = '';
            refreshView(); 
        } else {
            const err = await response.json();
            showStatus(err.error || "Error al registrar", false);
        }
    } catch (e) { showStatus("Error de conexión", false); }
}

async function updateSaleQty(saleId, prodId, newQty) {
    if (newQty < 1) return;
    try {
        const response = await fetch(`${API_URL}/sales/${saleId}/${prodId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ quantity: parseInt(newQty) })
        });
        if (response.ok) {
            refreshView();
        } else {
            console.error("Fallo al actualizar cantidad en el servidor");
        }
    } catch (e) { console.error('Error al actualizar cantidad:', e); }
}

async function deleteSale(saleId, prodId) {
    if (!confirm('¿Eliminar esta venta?')) return;
    try {
        const response = await fetch(`${API_URL}/sales/${saleId}/${prodId}`, { 
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            showStatus("Venta eliminada", true);
            refreshView();
        }
    } catch (e) { console.error('Error al eliminar venta:', e); }
}

// --- 5. ANALÍTICA INTEGRADA (Chart.js) ---

async function renderAnalytics() {
    try {
        const response = await fetch(`${API_URL}/analytics/top-selling`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error('Error al solicitar datos analíticos');
        
        const data = await response.json();
        const ctx = document.getElementById('salesChart').getContext('2d');
        
        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.name),
                datasets: [{
                    label: 'Ingresos por Producto ($)',
                    data: data.map(item => item.total_revenue),
                    backgroundColor: '#3b82f6',
                    borderRadius: 5,
                    hoverBackgroundColor: '#2563eb'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: { enabled: true }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f3f4f6' } },
                    x: { grid: { display: false } }
                }
            }
        });
    } catch (error) { console.error('Error en el gráfico:', error); }
}

// --- 6. INTERFAZ DE USUARIO (UTILIDADES) ---

function showStatus(msg, isSuccess) {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.className = `mt-4 text-center font-bold p-3 rounded-lg shadow-sm transition-all duration-500 border ${
        isSuccess ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
    }`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 3500);
}

// --- 7. INTEGRACIÓN CON API EXTERNA (CONVERSIÓN DE DIVISAS) ---

async function updateCurrencyConversion() {
    const eurEl = document.getElementById('currency-eur');
    const gbpEl = document.getElementById('currency-gbp');
    
    try {
        // 1. Obtenemos las analíticas financieras desde nuestra API protegida por Token
        const responseLocal = await fetch(`${API_URL}/analytics/top-selling`, {
            headers: getAuthHeaders()
        });
        if (!responseLocal.ok) throw new Error("Error al obtener analíticas locales");
        
        const salesData = await responseLocal.json();
        
        if (!Array.isArray(salesData) || salesData.length === 0) {
            eurEl.textContent = "€0.00";
            gbpEl.textContent = "£0.00";
            return;
        }
        
        // Reducción segura de la data local para calcular el ingreso bruto en USD
        const totalUSD = salesData.reduce((sum, item) => {
            const rev = parseFloat(item.total_revenue);
            return sum + (isNaN(rev) ? 0 : rev);
        }, 0);
        
        if (totalUSD === 0) {
            eurEl.textContent = "€0.00";
            gbpEl.textContent = "£0.00";
            return;
        }

        // 2. Consulta externa asíncrona a Frankfurter (Nota: no requiere cabeceras de autorización internas)
        const responseExternal = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP');
        if (!responseExternal.ok) throw new Error("La API externa de divisas no respondió correctamente");
        
        const ratesData = await responseExternal.json();
        
        // 3. Multiplicación matemática cruzada (Datos locales × Tipos de cambio en tiempo real externos)
        const totalEUR = totalUSD * ratesData.rates.EUR;
        const totalGBP = totalUSD * ratesData.rates.GBP;

        // 4. Renderizado dinámico formateado en el DOM del Dashboard
        eurEl.textContent = `€${totalEUR.toFixed(2)}`;
        gbpEl.textContent = `£${totalGBP.toFixed(2)}`;

    } catch (error) {
        console.error("Fallo controlado en la API externa de divisas:", error);
        // Fallback robusto que demuestra resiliencia arquitectónica (Tolerancia a fallos)
        eurEl.textContent = "Servicio no disp.";
        gbpEl.textContent = "Servicio no disp.";
    }
}