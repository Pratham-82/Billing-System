import { useEffect, useState } from 'react';
import { formatCurrency } from '../utils/format';

export default function Items() {
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState(null); // 'add' | 'edit' | null
  const [editingIndex, setEditingIndex] = useState(-1);
  const [form, setForm] = useState({ name: '', type: 'quantity', defaultPrice: '' });
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Load catalog from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('wallpaper_catalog') || '[]');
    setCatalog(stored);
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
  function openEditModal(index, item) {
    setError('');
    setEditingIndex(index);
    setForm({ name: item.name, type: item.type, defaultPrice: item.defaultPrice ?? '' });
    setActiveModal('edit');
  }

  // Save changes (both Add and Edit)
  function handleFormSubmit(e) {
    e.preventDefault();
    setError('');

    const nameClean = form.name.trim();

    if (!nameClean) {
      setError('Please provide a valid name.');
      return;
    }

    const updatedCatalog = [...catalog];

    // Check duplicate name (excluding currently edited item)
    const duplicate = updatedCatalog.some(
      (item, i) => i !== editingIndex && item.name.toLowerCase() === nameClean.toLowerCase()
    );

    if (duplicate) {
      setError('An item with this name already exists in the catalog.');
      return;
    }

    const newItem = {
      name: nameClean,
      type: form.type,
      defaultPrice: form.defaultPrice ? Number(form.defaultPrice) : '',
    };

    if (activeModal === 'add') {
      updatedCatalog.push(newItem);
      triggerToast(`Item "${nameClean}" added successfully!`);
    } else if (activeModal === 'edit') {
      updatedCatalog[editingIndex] = newItem;
      triggerToast(`Item "${nameClean}" updated successfully!`);
    }

    localStorage.setItem('wallpaper_catalog', JSON.stringify(updatedCatalog));
    setCatalog(updatedCatalog);
    setActiveModal(null);
  }

  // Delete item
  function handleDelete(index, name) {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      const updatedCatalog = catalog.filter((_, i) => i !== index);
      localStorage.setItem('wallpaper_catalog', JSON.stringify(updatedCatalog));
      setCatalog(updatedCatalog);
      triggerToast(`Item "${name}" deleted successfully!`);
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

      {filteredCatalog.length === 0 ? (
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
                // Find actual index in complete catalog (so editing matches target correctly)
                const actualIndex = catalog.findIndex((c) => c.name === item.name);
                
                return (
                  <tr key={index}>
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
                          onClick={() => openEditModal(actualIndex, item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => handleDelete(actualIndex, item.name)}
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
