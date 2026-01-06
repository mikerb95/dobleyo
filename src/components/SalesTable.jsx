import React, { useState, useEffect } from 'react';
import '../../../public/assets/css/sales-table.css';

export default function SalesTable() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    city: '',
    state: '',
    dateFrom: '',
    dateTo: ''
  });

  // Fetch sales data
  const fetchSales = async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit,
        offset: (pageNum - 1) * limit,
        ...(filters.city && { city: filters.city }),
        ...(filters.state && { state: filters.state }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });

      const response = await fetch(`/api/mercadolibre/sales?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sales');
      }

      const data = await response.json();
      setSales(data.data || []);
      setTotal(data.pagination.total);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching sales:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/mercadolibre/stats', {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Sync sales from MercadoLibre
  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await fetch('/api/mercadolibre/sync', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Sync failed');
      }

      const data = await response.json();
      alert(`Sincronización completada: ${data.saved} nuevas ventas guardadas`);
      fetchSales(1);
      fetchStats();
    } catch (err) {
      alert('Error durante sincronización: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
    setPage(1);
  };

  // Apply filters
  const handleApplyFilters = () => {
    fetchSales(1);
  };

  const handleResetFilters = () => {
    setFilters({
      city: '',
      state: '',
      dateFrom: '',
      dateTo: ''
    });
    setPage(1);
  };

  useEffect(() => {
    fetchSales(1);
    fetchStats();
  }, []);

  const totalPages = Math.ceil(total / limit);
  const currency = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS'
  });

  return (
    <div className="sales-table-container">
      {/* Header with stats */}
      {stats && (
        <div className="sales-stats">
          <div className="stat-card">
            <div className="stat-label">Total de órdenes</div>
            <div className="stat-value">{stats.overview.total_orders}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ingresos totales</div>
            <div className="stat-value">
              {currency.format(stats.overview.total_revenue || 0)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Valor promedio</div>
            <div className="stat-value">
              {currency.format(stats.overview.avg_order_value || 0)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ciudades</div>
            <div className="stat-value">{stats.overview.unique_cities}</div>
          </div>
        </div>
      )}

      {/* Sync button */}
      <div className="sales-actions">
        <button
          className="btn btn-primary"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? 'Sincronizando...' : '🔄 Sincronizar ventas'}
        </button>
      </div>

      {/* Filters */}
      <div className="sales-filters">
        <h3>Filtros</h3>
        <div className="filter-row">
          <div className="filter-group">
            <label>Ciudad</label>
            <input
              type="text"
              name="city"
              value={filters.city}
              onChange={handleFilterChange}
              placeholder="Ej: Buenos Aires"
            />
          </div>
          <div className="filter-group">
            <label>Provincia</label>
            <input
              type="text"
              name="state"
              value={filters.state}
              onChange={handleFilterChange}
              placeholder="Ej: Buenos Aires"
            />
          </div>
          <div className="filter-group">
            <label>Desde</label>
            <input
              type="date"
              name="dateFrom"
              value={filters.dateFrom}
              onChange={handleFilterChange}
            />
          </div>
          <div className="filter-group">
            <label>Hasta</label>
            <input
              type="date"
              name="dateTo"
              value={filters.dateTo}
              onChange={handleFilterChange}
            />
          </div>
        </div>
        <div className="filter-buttons">
          <button className="btn btn-small" onClick={handleApplyFilters}>
            Aplicar filtros
          </button>
          <button className="btn btn-small btn-secondary" onClick={handleResetFilters}>
            Limpiar
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && <div className="error-message">{error}</div>}

      {/* Sales table */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading">Cargando ventas...</div>
        ) : sales.length === 0 ? (
          <div className="no-data">No hay ventas registradas</div>
        ) : (
          <table className="sales-table">
            <thead>
              <tr>
                <th>ID Orden</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Ciudad</th>
                <th>Provincia</th>
                <th>Método Envío</th>
                <th>Productos</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => (
                <tr key={sale.id}>
                  <td className="order-id">{sale.ml_order_id}</td>
                  <td>{new Date(sale.purchase_date).toLocaleDateString('es-AR')}</td>
                  <td className="amount">
                    {currency.format(sale.total_amount)}
                  </td>
                  <td>
                    <span className={`badge badge-${sale.order_status}`}>
                      {sale.order_status}
                    </span>
                  </td>
                  <td>{sale.recipient_city}</td>
                  <td>{sale.recipient_state}</td>
                  <td>{sale.shipping_method}</td>
                  <td>
                    <details>
                      <summary>Ver ({sale.products?.length || 0})</summary>
                      {sale.products && sale.products.map((product, idx) => (
                        <div key={idx} className="product-item">
                          <strong>{product.title}</strong> x{product.quantity}
                          ({currency.format(product.unit_price)})
                        </div>
                      ))}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => fetchSales(page - 1)}
            disabled={page === 1}
            className="btn btn-small"
          >
            ← Anterior
          </button>
          <span className="page-info">
            Página {page} de {totalPages}
          </span>
          <button
            onClick={() => fetchSales(page + 1)}
            disabled={page === totalPages}
            className="btn btn-small"
          >
            Siguiente →
          </button>
        </div>
      )}

      {/* Top cities */}
      {stats && stats.top_cities && stats.top_cities.length > 0 && (
        <div className="top-cities">
          <h3>Ciudades con más pedidos</h3>
          <div className="cities-list">
            {stats.top_cities.map((city, idx) => (
              <div key={idx} className="city-card">
                <div className="city-rank">#{idx + 1}</div>
                <div className="city-name">{city.recipient_city}</div>
                <div className="city-stats">
                  <span>{city.order_count} pedidos</span>
                  <span>{currency.format(city.total_sales)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
