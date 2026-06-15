import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { api } from '../api';
import PaymentBadge from '../components/PaymentBadge';
import { formatCurrency } from '../utils/format';
import { getAmountPaid, getBalanceDue } from '../utils/payment';

export default function Customers() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [accountData, setAccountData] = useState(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [paymentInput, setPaymentInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', email: '', address: '', customerType: 'retail' });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  function openEditModal(c) {
    setEditForm({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      customerType: c.customerType || 'retail',
    });
    setEditError('');
    setIsEditingCustomer(true);
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError('');
    setEditSaving(true);
    try {
      if (!editForm.name.trim()) {
        throw new Error('Name is required.');
      }
      if (editForm.phone && editForm.phone.length !== 10) {
        throw new Error('Phone number must be exactly 10 digits.');
      }
      await api.updateCustomer(customer._id, editForm);
      setIsEditingCustomer(false);
      await loadAccount(customer._id);
      const data = await api.getCustomers(search, typeFilter);
      setCustomers(data);
    } catch (err) {
      setEditError(err.message || 'Failed to update customer');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteCustomer(id, name) {
    if (window.confirm(`Are you sure you want to delete customer "${name}"? WARNING: This will also delete ALL bills/orders associated with this customer.`)) {
      try {
        await api.deleteCustomer(id);
        setAccountData(null);
        const data = await api.getCustomers(search, typeFilter);
        setCustomers(data);
      } catch (err) {
        alert(err.message || 'Failed to delete customer');
      }
    }
  }

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importedCustomers, setImportedCustomers] = useState([]);
  const [importResults, setImportResults] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const downloadTemplate = () => {
    const headers = [['Name', 'Phone', 'Email', 'Address', 'Customer Type', 'Opening Balance']];
    const data = [
      ...headers,
      ['John Doe', '9876543210', 'john@example.com', '123 Main St, Mumbai', 'retail', '0'],
      ['Jane Builder', '9123456789', 'jane@builder.com', 'Builder Corp HQ, Delhi', 'builder', '50000']
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers Template');
    XLSX.writeFile(workbook, 'customers_import_template.xlsx');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError('');
    setImportResults(null);
    setImportedCustomers([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (rawJson.length < 2) {
          throw new Error('Excel file must contain a header row and at least one data row.');
        }

        const headers = rawJson[0].map(h => h?.toString().trim().toLowerCase());
        
        const nameIdx = headers.findIndex(h => h.includes('name'));
        const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('mobile'));
        const emailIdx = headers.findIndex(h => h.includes('email'));
        const addressIdx = headers.findIndex(h => h === 'address' || h.includes('billing address'));
        const typeIdx = headers.findIndex(h => h.includes('type'));
        const balanceIdx = headers.findIndex(h => h.includes('balance') || h.includes('due') || h.includes('opening'));

        if (nameIdx === -1) {
          throw new Error('Could not find required column: "Name" (case-insensitive).');
        }

        const parsed = [];
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;
          
          const name = row[nameIdx]?.toString().trim();
          const phoneRaw = phoneIdx !== -1 ? row[phoneIdx]?.toString().trim() : '';
          
          if (!name) continue;

          const phone = phoneRaw ? phoneRaw.replace(/\D/g, '').slice(0, 10) : '';
          const email = emailIdx !== -1 ? row[emailIdx]?.toString().trim() || '' : '';
          const address = addressIdx !== -1 ? row[addressIdx]?.toString().trim() || '' : '';
          
          let customerType = 'retail';
          if (typeIdx !== -1 && row[typeIdx]) {
            const rawType = row[typeIdx].toString().trim().toLowerCase();
            if (['retail', 'builder', 'shopkeeper', 'reference'].includes(rawType)) {
              customerType = rawType;
            }
          }

          const openingBalance = balanceIdx !== -1 ? Number(row[balanceIdx]) || 0 : 0;

          parsed.push({
            name,
            phone,
            email,
            address,
            customerType,
            openingBalance,
          });
        }

        if (parsed.length === 0) {
          throw new Error('No valid customer rows found in the sheet.');
        }

        setImportedCustomers(parsed);
      } catch (err) {
        setImportError(err.message || 'Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBulkImportSubmit = async () => {
    if (importedCustomers.length === 0) return;
    setImporting(true);
    setImportError('');
    try {
      const results = await api.bulkCreateCustomers(importedCustomers);
      setImportResults(results);
      setImportedCustomers([]);
      
      const data = await api.getCustomers(search, typeFilter);
      setCustomers(data);
    } catch (err) {
      setImportError(err.message || 'Failed to import customers');
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoadingCustomers(true);
      setError('');
      try {
        const data = await api.getCustomers(search, typeFilter);
        setCustomers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingCustomers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, typeFilter]);

  async function loadAccount(customerId) {
    setLoadingAccount(true);
    setError('');
    try {
      const data = await api.getCustomerAccount(customerId);
      setAccountData(data);
    } catch (err) {
      setError(err.message);
      setAccountData(null);
    } finally {
      setLoadingAccount(false);
    }
  }

  async function selectCustomer(customer) {
    setPaymentInput('');
    setDiscountInput('');
    setPaymentError('');
    setPaymentSuccess('');
    await loadAccount(customer._id);
  }

  async function handleCustomerPaymentSubmit(e) {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');
    const amt = Number(paymentInput) || 0;
    const disc = Number(discountInput) || 0;
    if (isNaN(amt) || amt < 0) {
      setPaymentError('Please enter a valid payment amount.');
      return;
    }
    if (isNaN(disc) || disc < 0) {
      setPaymentError('Please enter a valid discount amount.');
      return;
    }
    if (amt === 0 && disc === 0) {
      setPaymentError('Please enter either a payment amount or a settlement discount.');
      return;
    }
    if (amt + disc > account.balanceDue) {
      setPaymentError(`Total of payment and discount (${formatCurrency(amt + disc)}) cannot exceed the balance due of ${formatCurrency(account.balanceDue)}.`);
      return;
    }
    setSubmittingPayment(true);
    try {
      await api.recordCustomerPayment(customer._id, amt, disc);
      setPaymentInput('');
      setDiscountInput('');
      if (amt > 0 && disc > 0) {
        setPaymentSuccess(`Successfully recorded payment of ${formatCurrency(amt)} with settlement discount of ${formatCurrency(disc)}!`);
      } else if (disc > 0) {
        setPaymentSuccess(`Successfully applied settlement discount of ${formatCurrency(disc)}!`);
      } else {
        setPaymentSuccess(`Successfully recorded payment of ${formatCurrency(amt)}!`);
      }
      await loadAccount(customer._id);
      const data = await api.getCustomers(search, typeFilter);
      setCustomers(data);
    } catch (err) {
      setPaymentError(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  }

  const { customer, account, orders } = accountData || {};

  return (
    <div className="grid-2">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 className="section-title" style={{ margin: 0 }}>Customer Accounts</h2>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.88rem', borderRadius: '10px' }}
            onClick={() => setIsImportOpen(true)}
          >
            📥 Bulk Import (Excel)
          </button>
        </div>
        <div className="search-bar">
          <input
            placeholder="Search by name, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="retail">Retail</option>
            <option value="builder">Builder</option>
            <option value="shopkeeper">Shopkeeper</option>
            <option value="reference">Reference</option>
          </select>
        </div>

        {error && !accountData && <div className="alert alert-error">{error}</div>}

        {loadingCustomers ? (
          <div className="empty-state">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="empty-state">No customers found</div>
        ) : (
          <div className="customer-list" style={{ maxHeight: 'none' }}>
            {customers.map((c) => (
              <button
                key={c._id}
                type="button"
                className={`customer-option ${customer?._id === c._id ? 'selected' : ''}`}
                onClick={() => selectCustomer(c)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong>{c.name}</strong>
                    {c.customerType && (
                      <span 
                        className="badge" 
                        style={{ 
                          fontSize: '0.65rem', 
                          padding: '1px 5px', 
                          background: 'var(--surface-alt)', 
                          border: '1px solid var(--border)', 
                          textTransform: 'capitalize',
                          color: 'var(--accent)',
                          borderRadius: '4px'
                        }}
                      >
                        {c.customerType}
                      </span>
                    )}
                  </div>
                  <div>{c.phone}</div>
                  {c.email && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.email}</div>}
                </div>
                {c.balanceDue !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <small className="bill-meta" style={{ fontSize: '0.75rem', display: 'block', marginBottom: 2 }}>Balance</small>
                    <strong className={c.balanceDue > 0 ? 'text-danger' : 'text-success'} style={{ fontSize: '1rem' }}>
                      {formatCurrency(c.balanceDue)}
                    </strong>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title">Manage Account</h2>
        {!customer ? (
          <div className="empty-state">Select a customer to manage their account</div>
        ) : loadingAccount ? (
          <div className="empty-state">Loading account...</div>
        ) : (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <strong style={{ fontSize: '1.2rem' }}>{customer.name}</strong>
                {customer.customerType && (
                  <span 
                    className="badge" 
                    style={{ 
                      fontSize: '0.75rem', 
                      padding: '2px 8px', 
                      background: 'var(--surface-alt)', 
                      border: '1px solid var(--border)', 
                      textTransform: 'capitalize',
                      color: 'var(--accent)'
                    }}
                  >
                    {customer.customerType}
                  </span>
                )}
              </div>
              <div className="bill-meta">{customer.phone}</div>
              {customer.email && <div className="bill-meta">{customer.email}</div>}
              {customer.address && <div className="bill-meta">{customer.address}</div>}
              
              <div className="btn-row" style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
                  onClick={() => openEditModal(customer)}
                >
                  ✏️ Edit Info
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
                  onClick={() => handleDeleteCustomer(customer._id, customer.name)}
                >
                  🗑️ Delete Account
                </button>
              </div>
            </div>

            <div className="account-summary">
              <div className="account-stat">
                <span>Total Billed</span>
                <strong>{formatCurrency(account.totalBilled)}</strong>
              </div>
              <div className="account-stat">
                <span>Total Paid</span>
                <strong className="text-success">{formatCurrency(account.totalPaid)}</strong>
              </div>
              <div className="account-stat">
                <span>Balance Due</span>
                <strong className={account.balanceDue > 0 ? 'text-danger' : 'text-success'}>
                  {formatCurrency(account.balanceDue)}
                </strong>
              </div>
              <div className="account-stat">
                <span>Pending Bills</span>
                <strong>{account.unpaidCount}</strong>
              </div>
            </div>

            {account.balanceDue > 0 && (
              <div className="card" style={{ marginTop: 20, padding: 20, background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Record Account Payment</h3>
                <form onSubmit={handleCustomerPaymentSubmit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                    <label>Amount to Pay</label>
                    <input
                      type="number"
                      min="0"
                      max={account.balanceDue - (Number(discountInput) || 0)}
                      value={paymentInput}
                      onChange={(e) => setPaymentInput(e.target.value)}
                      placeholder={`Max: ${account.balanceDue - (Number(discountInput) || 0)}`}
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                  <div className="field" style={{ margin: 0, flex: 1, minWidth: '150px' }}>
                    <label>Settlement Discount</label>
                    <input
                      type="number"
                      min="0"
                      max={account.balanceDue - (Number(paymentInput) || 0)}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder="e.g. 100"
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ height: '42px' }} disabled={submittingPayment}>
                    {submittingPayment ? 'Saving...' : 'Apply Payment'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '42px' }}
                    onClick={() => {
                      setPaymentInput(account.balanceDue);
                      setDiscountInput('');
                    }}
                  >
                    Pay Full
                  </button>
                </form>
                {paymentError && <div className="alert alert-error" style={{ marginTop: 10 }}>{paymentError}</div>}
                {paymentSuccess && <div className="alert alert-success" style={{ marginTop: 10 }}>{paymentSuccess}</div>}
              </div>
            )}

            {orders.length === 0 ? (
              <div className="empty-state">No orders for this customer</div>
            ) : (
              <div style={{ marginTop: 20, display: 'grid', gap: 12 }}>
                {orders.map((order) => {
                  const paid = getAmountPaid(order);
                  const balance = getBalanceDue(order);

                  return (
                    <div key={order._id} className="item-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                        <div>
                          <strong>{order.billNumber}</strong>
                          <div className="bill-meta">
                            {new Date(order.createdAt).toLocaleDateString('en-IN')}
                          </div>
                        </div>
                        <PaymentBadge order={order} />
                      </div>
                      <div className="payment-summary inline">
                        <div><span>Total</span><span>{formatCurrency(order.grandTotal)}</span></div>
                        <div><span>Paid</span><span className="text-success">{formatCurrency(paid)}</span></div>
                        <div><span>Due</span><span className={balance > 0 ? 'text-danger' : 'text-success'}>{formatCurrency(balance)}</span></div>
                      </div>
                      <div className="btn-row" style={{ marginTop: 12 }}>
                        <Link to={`/bill/${order._id}`} className="btn btn-primary">
                          View Bill
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {isEditingCustomer && (
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
        }} onClick={() => setIsEditingCustomer(false)}>
          <div className="card" style={{ 
            maxWidth: '500px', 
            width: '100%', 
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem' }}>Edit Customer Info</h3>
              <button 
                type="button" 
                onClick={() => setIsEditingCustomer(false)}
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

            {editError && <div className="alert alert-error">{editError}</div>}

            <form onSubmit={handleEditSubmit} style={{ display: 'grid', gap: '16px' }}>
              <div className="field">
                <label>Name *</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  pattern="[0-9]{10}"
                  title="Phone number must be exactly 10 digits"
                  maxLength={10}
                />
              </div>
              <div className="field">
                <label>Customer Type *</label>
                <select
                  value={editForm.customerType}
                  onChange={(e) => setEditForm({ ...editForm, customerType: e.target.value })}
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
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Address</label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  style={{ minHeight: '60px' }}
                />
              </div>
              <div className="btn-row" style={{ marginTop: '10px' }}>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditingCustomer(false)}>
                  Cancel
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {isImportOpen && (
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
        }} onClick={() => { if (!importing) setIsImportOpen(false); }}>
          <div className="card" style={{ 
            maxWidth: '650px', 
            width: '100%', 
            maxHeight: '90vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem' }}>Bulk Import Customers</h3>
              <button 
                type="button" 
                disabled={importing}
                onClick={() => setIsImportOpen(false)}
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

            <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '0.85rem' }}>
              <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--accent)' }}>Instructions:</strong>
              Upload an Excel (.xlsx, .xls) or CSV file with the following column headers:
              <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                <li><strong>Name</strong> * (Required)</li>
                <li><strong>Phone</strong> (Optional, 10-digit number)</li>
                <li><strong>Email</strong> (Optional)</li>
                <li><strong>Address</strong> (Optional, billing address)</li>
                <li><strong>Customer Type</strong> (Optional: retail, builder, shopkeeper, reference)</li>
                <li><strong>Balance Due</strong> or <strong>Opening Balance</strong> (Optional starting balance due)</li>
              </ul>
              <div style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  📥 Download Excel Template
                </button>
              </div>
            </div>

            {importError && <div className="alert alert-error" style={{ marginBottom: 20 }}>{importError}</div>}
            
            {importResults && (
              <div className="alert alert-success" style={{ display: 'block', marginBottom: 20 }}>
                <strong>{importResults.message}</strong>
                {importResults.errors && importResults.errors.length > 0 && (
                  <div style={{ marginTop: '10px', maxHeight: '150px', overflowY: 'auto', fontSize: '0.82rem', padding: '8px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Errors encountered:</div>
                    {importResults.errors.map((err, i) => (
                      <div key={i} style={{ color: 'var(--danger)', marginBottom: '2px' }}>
                        Row {i + 1} ({err.customer?.name || 'Unknown'}): {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!importResults && (
              <div className="field" style={{ marginBottom: 20 }}>
                <label>Select Excel / CSV File</label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  disabled={importing}
                  style={{ padding: '8px' }}
                />
              </div>
            )}

            {importedCustomers.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ fontSize: '1rem', marginBottom: 10 }}>Previewing {importedCustomers.length} Customer(s) to Import</h4>
                <div className="table-wrap" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Type</th>
                        <th>Balance Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedCustomers.slice(0, 10).map((c, i) => (
                        <tr key={i}>
                          <td>{c.name}</td>
                          <td>{c.phone}</td>
                          <td style={{ textTransform: 'capitalize' }}>{c.customerType}</td>
                          <td>{formatCurrency(c.openingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importedCustomers.length > 10 && (
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ...and {importedCustomers.length - 10} more row(s)
                  </div>
                )}
              </div>
            )}

            <div className="btn-row" style={{ marginTop: '10px' }}>
              {importedCustomers.length > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleBulkImportSubmit}
                  disabled={importing}
                >
                  {importing ? 'Importing...' : `Import ${importedCustomers.length} Customers`}
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                disabled={importing}
                onClick={() => {
                  setIsImportOpen(false);
                  setImportResults(null);
                  setImportedCustomers([]);
                  setImportError('');
                }}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
