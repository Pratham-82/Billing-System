import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatCurrency } from '../utils/format';

export default function Items() {
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | null
  const [editingItem, setEditingItem] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'quantity', defaultPrice: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Load catalog from database
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const data = await api.getItems();
        setCatalog(data);
      } catch (err) {
        console.error('Failed to load item types catalog:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  function triggerToast(message, type = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  }

  // Open add modal
  function openAddModal() {
    setError('');
    setForm({ name: '', type: 'quantity', defaultPrice: '' });
    setActiveModal('add');
  }

  // Open edit modal
  function openEditModal(item) {
    setError('');
    setEditingItem(item);
    setForm({ name: item.name, type: item.type, defaultPrice: item.defaultPrice ?? '' });
    setActiveModal('edit');
  }

  // Save changes (both Add and Edit)
  async function handleFormSubmit(e) {
    e.preventDefault();
    setError('');

    const nameClean = form.name.trim();

    if (!nameClean) {
      setError('Please provide a valid name.');
      return;
    }

    const payload = {
      name: nameClean,
      type: form.type,
      defaultPrice: form.defaultPrice ? Number(form.defaultPrice) : 0,
    };

    try {
      if (activeModal === 'add') {
        const newItem = await api.createItem(payload);
        setCatalog((prev) => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
        triggerToast(`Item "${nameClean}" added successfully!`);
      } else if (activeModal === 'edit') {
        const updatedItem = await api.updateItem(editingItem._id, payload);
        setCatalog((prev) =>
          prev.map((item) => (item._id === editingItem._id ? updatedItem : item)).sort((a, b) => a.name.localeCompare(b.name))
        );
        triggerToast(`Item "${nameClean}" updated successfully!`);
      }
      setActiveModal(null);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    }
  }

  // Delete item
  async function handleDelete(id, name) {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await api.deleteItem(id);
        setCatalog((prev) => prev.filter((item) => item._id !== id));
        triggerToast(`Item "${name}" deleted successfully!`);
      } catch (err) {
        triggerToast(err.message || 'Failed to delete item', 'error');
      }
    }
  }

  // Filtered catalog
  const filteredCatalog = catalog.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="card">
      {toast.show && (
        <div
          className={`alert alert-${toast.type} no-print`}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {toast.message}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>Item Type Catalog</h2>
        <button type="button" className="btn btn-primary" onClick={openAddModal}>
          + Add Item Type
        </button>
      </div>

      <div className="search-bar" style={{ marginBottom: 20 }}>
        <input
          placeholder="Search items by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="empty-state">Loading item catalog...</div>
      ) : filteredCatalog.length === 0 ? (
        <div className="empty-state">No items found in the catalog.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Type</th>
                <th>Default Price</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.map((item, index) => {
                return (
                  <tr key={item._id || index}>
                    <td>{index + 1}</td>
                    <td style={{ fontWeight: 'bold' }}>{item.name}</td>
                    <td>
                      {(() => {
                        if (item.type === 'sqft' || item.type === 'custom') return 'Square Feet';
                        if (item.type === 'running') return 'Running Feet';
                        return 'Quantity';
                      })()}
                    </td>
                    <td>{item.defaultPrice ? formatCurrency(item.defaultPrice) : '—'}</td>
                    <td>
                      <div className="btn-row" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => openEditModal(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDelete(item._id, item.name)}
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

      {/* modal overlay */}
      {activeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '20px',
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem' }}>
                {activeModal === 'add' ? 'Add Item Type' : 'Edit Item Type'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.4rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            <form onSubmit={handleFormSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div className="field">
                <label>Item Type Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Royal Damask Gold"
                  required
                />
              </div>
              <div className="field">
                <label>Item Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="quantity">Quantity</option>
                  <option value="sqft">In square feet</option>
                  <option value="running">In running feet</option>
                </select>
              </div>
              <div className="field">
                <label>Default Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.defaultPrice}
                  onChange={(e) => setForm({ ...form, defaultPrice: e.target.value })}
                  placeholder="e.g. 1500"
                />
              </div>

              <div className="btn-row" style={{ marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary">
                  {activeModal === 'add' ? 'Add to Catalog' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
