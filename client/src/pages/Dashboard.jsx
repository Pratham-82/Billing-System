import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { formatCurrency } from '../utils/format';

export default function Dashboard() {
  const navigate = useNavigate();

  // Catalog seeding is now handled by the backend server.
  
  // Modal states
  const [activeModal, setActiveModal] = useState(null); // 'customer' | 'item' | null
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Form states
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', address: '', customerType: 'retail' });
  const [itemForm, setItemForm] = useState({ name: '', type: 'quantity', defaultPrice: '' });
  
  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Show toast utility
  function triggerToast(message, type = 'success') {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  }

  // Handle New Customer submit
  async function handleCustomerSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!customerForm.name.trim() || !customerForm.phone.trim()) {
        throw new Error('Name and phone are required.');
      }
      const data = await api.createCustomer(customerForm);
      triggerToast(`Customer "${data.name}" registered successfully!`);
      setCustomerForm({ name: '', phone: '', email: '', address: '', customerType: 'retail' });
      setActiveModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  // Handle Add Item submit
  async function handleItemSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!itemForm.name.trim()) {
        throw new Error('Name is required.');
      }

      const newItem = {
        name: itemForm.name.trim(),
        type: itemForm.type,
        defaultPrice: itemForm.defaultPrice ? Number(itemForm.defaultPrice) : 0
      };

      const data = await api.createItem(newItem);
      triggerToast(`Item Type "${data.name}" added to catalog successfully!`);
      setItemForm({ name: '', type: 'quantity', defaultPrice: '' });
      setActiveModal(null);
    } catch (err) {
      setError(err.message || 'Failed to add item type');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '40px auto 0 auto' }}>
      
      {/* Toast Alert */}
      {toast.show && (
        <div className={`alert alert-${toast.type} no-print`} style={{ 
          position: 'fixed', 
          top: '20px', 
          right: '20px', 
          zIndex: 1000, 
          boxShadow: 'var(--shadow-lg)' 
        }}>
          {toast.message}
        </div>
      )}

      {/* Hero section */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontSize: '2.2rem', marginBottom: '10px' }}>Speaking Wall Interio Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '600px', margin: '0 auto' }}>
          Welcome back! Select an action below to manage customer accounts, browse past bills, create a new wallpaper invoice, or expand your pattern catalog.
        </p>
      </div>

      {/* Grid of 4 buttons */}
      <div className="grid-2" style={{ gap: '24px', marginBottom: '40px' }}>
        
        {/* 1. New Customer */}
        <button 
          type="button" 
          className="card" 
          onClick={() => { setError(''); setActiveModal('customer'); }}
          style={{ 
            textAlign: 'left', 
            cursor: 'pointer', 
            width: '100%', 
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
            background: 'var(--surface)'
          }}
        >
          <div style={{ 
            fontSize: '2rem', 
            background: 'rgba(176, 130, 94, 0.15)', 
            padding: '12px', 
            borderRadius: '12px', 
            lineHeight: 1 
          }}>
            👤⁺
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>New Customer</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4 }}>
              Register a new customer account with contact information in the database.
            </p>
          </div>
        </button>

        {/* 2. View Bill */}
        <button 
          type="button" 
          className="card" 
          onClick={() => navigate('/orders')}
          style={{ 
            textAlign: 'left', 
            cursor: 'pointer', 
            width: '100%', 
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
            background: 'var(--surface)'
          }}
        >
          <div style={{ 
            fontSize: '2rem', 
            background: 'rgba(176, 130, 94, 0.15)', 
            padding: '12px', 
            borderRadius: '12px', 
            lineHeight: 1 
          }}>
            📄🔍
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>View Bill</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4 }}>
              Browse and review all past orders, printed invoices, and payment statuses.
            </p>
          </div>
        </button>

        {/* 3. Generate New Bill */}
        <button 
          type="button" 
          className="card" 
          onClick={() => navigate('/generate-bill')}
          style={{ 
            textAlign: 'left', 
            cursor: 'pointer', 
            width: '100%', 
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
            background: 'var(--surface)'
          }}
        >
          <div style={{ 
            fontSize: '2rem', 
            background: 'rgba(176, 130, 94, 0.15)', 
            padding: '12px', 
            borderRadius: '12px', 
            lineHeight: 1 
          }}>
            📝⁺
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>Generate New Bill</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4 }}>
              Launch the invoice builder to calculate standard roll orders or custom sized prints.
            </p>
          </div>
        </button>

        {/* 4. Add new item */}
        <button 
          type="button" 
          className="card" 
          onClick={() => { setError(''); setActiveModal('item'); }}
          style={{ 
            textAlign: 'left', 
            cursor: 'pointer', 
            width: '100%', 
            padding: '30px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'flex-start',
            background: 'var(--surface)'
          }}
        >
          <div style={{ 
            fontSize: '2rem', 
            background: 'rgba(176, 130, 94, 0.15)', 
            padding: '12px', 
            borderRadius: '12px', 
            lineHeight: 1 
          }}>
            🏷️⁺
          </div>
          <div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '4px' }}>Add new item</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.4 }}>
              Register a new wallpaper template with defaults to auto-fill when billing.
            </p>
          </div>
        </button>

      </div>

      {/* ==================== MODALS ==================== */}

      {activeModal && (
        <div style={{
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
          padding: '20px'
        }} onClick={() => setActiveModal(null)}>
          <div className="card" style={{ 
            maxWidth: '500px', 
            width: '100%', 
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem' }}>
                {activeModal === 'customer' && 'Register New Customer'}
                {activeModal === 'item' && 'Add Item Type'}
              </h3>
              <button 
                type="button" 
                onClick={() => setActiveModal(null)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.4rem', 
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {/* --- Form 1: New Customer --- */}
            {activeModal === 'customer' && (
              <form onSubmit={handleCustomerSubmit} style={{ display: 'grid', gap: '16px' }}>
                <div className="field">
                  <label>Name *</label>
                  <input
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    required
                  />
                </div>
                 <div className="field">
                  <label>Phone *</label>
                  <input
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    placeholder="e.g. 9876543210"
                    required
                    pattern="[0-9]{10}"
                    title="Phone number must be exactly 10 digits"
                    maxLength={10}
                  />
                </div>
                <div className="field">
                  <label>Customer Type *</label>
                  <select
                    value={customerForm.customerType}
                    onChange={(e) => setCustomerForm({ ...customerForm, customerType: e.target.value })}
                    required
                  >
                    <option value="retail">Retail</option>
                    <option value="builder">Builder</option>
                    <option value="shopkeeper">Shopkeeper</option>
                    <option value="reference">Reference</option>
                  </select>
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                 <div className="field">
                  <label>Address</label>
                  <textarea
                    value={customerForm.address}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                    placeholder="Billing/delivery address details..."
                    style={{ minHeight: '60px' }}
                  />
                </div>
                <div className="btn-row" style={{ marginTop: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'Saving...' : 'Register Customer'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}


            {/* --- Form 3: Add new item --- */}
            {activeModal === 'item' && (
              <form onSubmit={handleItemSubmit} style={{ display: 'grid', gap: '16px' }}>
                <div className="field">
                  <label>Item Type Name *</label>
                  <input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    placeholder="e.g. Royal Damask Gold"
                    required
                  />
                </div>
                <div className="field">
                  <label>Item Type</label>
                  <select
                    value={itemForm.type}
                    onChange={(e) => setItemForm({ ...itemForm, type: e.target.value })}
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
                    value={itemForm.defaultPrice}
                    onChange={(e) => setItemForm({ ...itemForm, defaultPrice: e.target.value })}
                    placeholder="e.g. 1500"
                  />
                </div>

                <div className="btn-row" style={{ marginTop: '10px' }}>
                  <button type="submit" className="btn btn-primary">
                    Add to Catalog
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
