import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatCurrency } from '../utils/format';

export default function Orders() {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getOrders({
        search,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setOrders(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadOrders, 300);
    return () => clearTimeout(timer);
  }, [search, startDate, endDate]);

  async function handleDeleteOrder(id, billNumber) {
    if (window.confirm(`Are you sure you want to delete order "${billNumber}"?`)) {
      try {
        await api.deleteOrder(id);
        loadOrders();
      } catch (err) {
        alert(err.message || 'Failed to delete order');
      }
    }
  }

  return (
    <div className="card">
      <h2 className="section-title">Find Orders</h2>
      
      <div className="search-bar" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', width: '100%', flexWrap: 'wrap' }}>
          <input
            placeholder="Search by bill number (e.g. WB-2026-0001)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', background: 'var(--surface-alt)', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>Bill Date Filter:</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '160px', padding: '8px 12px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '160px', padding: '8px 12px' }}
            />
          </div>
          {(startDate || endDate) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              style={{ padding: '6px 14px', fontSize: '0.85rem', borderRadius: '8px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="empty-state">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">No orders found</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill No</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                return (
                  <tr key={order._id}>
                    <td>{order.billNumber}</td>
                    <td>
                      <div>{order.customer?.name || order.customerName || 'Deleted Customer'}</div>
                      <small style={{ color: 'var(--text-muted)' }}>{order.customer?.phone || order.customerPhone || '—'}</small>
                    </td>
                    <td>{formatCurrency(order.grandTotal)}</td>
                    <td>
                      {new Date(order.billDate || order.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <div className="btn-row">
                        <Link to={`/bill/${order._id}`} className="btn btn-primary">
                          View Bill
                        </Link>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDeleteOrder(order._id, order.billNumber)}
                          style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
