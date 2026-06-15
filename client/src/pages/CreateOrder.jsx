import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { formatCurrency } from '../utils/format';


function getNormalizedType(type) {
  if (type === 'custom') return 'sqft';
  if (type === 'standard') return 'quantity';
  return type || 'quantity';
}

function getItemTypeLabel(type) {
  if (type === 'sqft' || type === 'custom') return 'Square Feet';
  if (type === 'running') return 'Running Feet';
  return 'Quantity';
}

const emptyItem = () => ({
  type: 'quantity',
  wallpaperName: '',
  quantity: 1,
  pricePerRoll: '',
  height: '',
  width: '',
  runningFt: '',
  measurementUnit: 'in',
  customization: '',
  isCustomName: false,
});

function getItemLineTotal(item) {
  const price = Number(item.pricePerRoll) || 0;
  const normType = getNormalizedType(item.type);

  if (normType === 'sqft') {
    const height = Number(item.height) || Number(item.heightFt) || 0;
    const width = Number(item.width) || Number(item.widthFt) || 0;
    const isLegacyInches = item.type === 'custom' && item.measurementUnit === 'in';
    const isNewSqFtInches = item.type === 'sqft';
    const isConvertRequired = isNewSqFtInches || isLegacyInches;

    const heightFt = isConvertRequired ? height / 12 : height;
    const widthFt = isConvertRequired ? width / 12 : width;
    const areaSqFt = heightFt * widthFt;

    return areaSqFt * price;
  } else if (normType === 'running') {
    const runningFt = Number(item.runningFt) || 0;
    return runningFt * price;
  }

  const qty = Number(item.quantity) || 0;
  return qty * price;
}

const emptyCustomer = {
  name: '',
  phone: '',
  email: '',
  address: '',
  customerType: 'retail',
  openingBalance: '',
};

export default function CreateOrder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [billNumber, setBillNumber] = useState('');
  const [customerType, setCustomerType] = useState('existing');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerData, setCustomerData] = useState(emptyCustomer);
  const [items, setItems] = useState([emptyItem()]);
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [notes, setNotes] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [shouldFocusLastItem, setShouldFocusLastItem] = useState(false);
  const [nextBillNo, setNextBillNo] = useState('');
  const [loadedCustomer, setLoadedCustomer] = useState(null);
  const [originalOrderBalance, setOriginalOrderBalance] = useState(0);

  useEffect(() => {
    const loadCatalogAndOrder = async () => {
      try {
        setLoading(true);
        const catalogData = await api.getItems();
        setCatalog(catalogData);

        if (isEdit) {
          const order = await api.getOrder(id);
          setBillNumber(order.billNumber);
          setBillDate(order.billDate ? order.billDate.split('T')[0] : '');
          setNotes(order.notes || '');
          setSiteAddress(order.siteAddress || '');
          setAmountPaid(order.amountPaid ? order.amountPaid.toString() : '');
          setDiscount(order.discount || 0);

          const oldPaid = order.amountPaid || 0;
          const oldDue = Math.max(0, order.grandTotal - oldPaid);
          setOriginalOrderBalance(oldDue);

          const base = order.subtotal - (order.discount || 0);
          const taxPct = base > 0 ? (order.tax / base) * 100 : 0;
          setTaxPercent(Number(taxPct.toFixed(2)));

          const mappedItems = order.items.map((item) => {
            const inCatalog = catalogData.some((c) => c.name === item.wallpaperName);
            return {
              type: item.type,
              wallpaperName: item.wallpaperName,
              quantity: item.quantity,
              pricePerRoll: item.pricePerRoll,
              height: item.height || '',
              width: item.width || '',
              runningFt: item.runningFt || '',
              measurementUnit: item.measurementUnit || 'in',
              customization: item.customization || '',
              isCustomName: !inCatalog,
            };
          });
          setItems(mappedItems);

          if (order.customer) {
            setCustomerType('existing');
            setSelectedCustomerId(order.customer._id || order.customer);
            setLoadedCustomer(order.customer);
          }
        } else {
          const { nextBillNumber } = await api.getNextBillNumber();
          setNextBillNo(nextBillNumber);
        }
      } catch (err) {
        setError(err.message || 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };
    loadCatalogAndOrder();
  }, [id, isEdit]);

  const isBuilder = useMemo(() => {
    if (customerType === 'new') {
      return customerData.customerType === 'builder';
    } else {
      const selected = customers.find(c => c._id === selectedCustomerId) || (loadedCustomer?._id === selectedCustomerId ? loadedCustomer : null);
      return selected?.customerType === 'builder';
    }
  }, [customerType, customerData.customerType, selectedCustomerId, customers, loadedCustomer]);

  useEffect(() => {
    if (shouldFocusLastItem && items.length > 0) {
      const lastIndex = items.length - 1;
      const selectEl = document.getElementById(`item-select-${lastIndex}`);
      if (selectEl) {
        selectEl.focus();
      }
      setShouldFocusLastItem(false);
    }
  }, [items.length, shouldFocusLastItem]);

  function handleWallpaperSelectChange(index, val) {
    if (val === 'custom') {
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? { 
                ...item, 
                wallpaperName: '', 
                isCustomName: true, 
                type: 'quantity', 
                pricePerRoll: '',
                height: '',
                width: '',
                runningFt: '',
                measurementUnit: 'in',
                customization: ''
              }
            : item
        )
      );
    } else {
      const matchedItem = catalog.find(item => item.name === val);
      setItems((prev) =>
        prev.map((item, i) =>
          i === index
            ? {
                ...item,
                wallpaperName: val,
                isCustomName: false,
                type: matchedItem ? matchedItem.type : 'quantity',
                pricePerRoll: matchedItem?.defaultPrice ?? '',
                height: '',
                width: '',
                runningFt: '',
                measurementUnit: 'in',
                customization: ''
              }
            : item
        )
      );
    }
  }

  useEffect(() => {
    if (customerType !== 'existing') return;

    const loadCustomers = async () => {
      try {
        const data = await api.getCustomers('');
        setCustomers(data);
      } catch {
        setCustomers([]);
      }
    };
    loadCustomers();
  }, [customerType]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + getItemLineTotal(item), 0),
    [items]
  );

  const taxAmount = useMemo(() => {
    const base = Math.max(0, subtotal - (Number(discount) || 0));
    return base * ((Number(taxPercent) || 0) / 100);
  }, [subtotal, discount, taxPercent]);

  const grandTotal = Math.round(Math.max(0, subtotal - (Number(discount) || 0) + taxAmount));
  const balanceDue = Math.max(0, grandTotal - (Number(amountPaid) || 0));

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setShouldFocusLastItem(true);
    setItems((prev) => {
      if (prev.length === 0) {
        return [...prev, emptyItem()];
      }
      const lastItem = prev[prev.length - 1];

      // Retrieve default price if inheriting catalog item
      let defaultPrice = '';
      if (lastItem.wallpaperName && !lastItem.isCustomName) {
        const matchedItem = catalog.find(item => item.name === lastItem.wallpaperName);
        if (matchedItem) {
          defaultPrice = matchedItem.defaultPrice ?? '';
        }
      }

      const inheritedItem = {
        type: lastItem.type || 'quantity',
        wallpaperName: lastItem.wallpaperName || '',
        isCustomName: lastItem.isCustomName || false,
        measurementUnit: lastItem.measurementUnit || 'in',
        quantity: 1,
        pricePerRoll: defaultPrice,
        height: '',
        width: '',
        runningFt: '',
        customization: '',
      };
      return [...prev, inheritedItem];
    });
  }

  function removeItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const preparedItems = items.map((item) => {
        const normType = getNormalizedType(item.type);
        if (normType === 'sqft' || normType === 'running') {
          return { ...item, quantity: 1 };
        }
        return item;
      });

      const payload = {
        customerType,
        customerId: customerType === 'existing' ? selectedCustomerId : undefined,
        customerData: customerType === 'new' ? customerData : undefined,
        items: preparedItems,
        discount,
        tax: taxAmount,
        notes,
        amountPaid: Number(amountPaid) || 0,
        billDate,
        siteAddress: isBuilder ? siteAddress : undefined,
      };

      let order;
      if (isEdit) {
        order = await api.updateOrder(id, payload);
        setSuccess(`Bill ${order.billNumber} updated successfully.`);
      } else {
        order = await api.createOrder(payload);
        setSuccess(`Bill ${order.billNumber} created successfully.`);
      }
      navigate(`/bill/${order._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '1.6rem', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>
          {isEdit ? `Edit Bill: ${billNumber}` : 'Generate New Invoice'}
        </h2>
        {!isEdit && nextBillNo && (
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--surface-alt)', padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            Bill No: {nextBillNo}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', marginBottom: 20 }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 8 }}>Customer</h2>
            <div className="toggle-group">
              <button
                type="button"
                className={customerType === 'new' ? 'active' : ''}
                onClick={() => setCustomerType('new')}
              >
                New Customer
              </button>
              <button
                type="button"
                className={customerType === 'existing' ? 'active' : ''}
                onClick={() => setCustomerType('existing')}
              >
                Existing Customer
              </button>
            </div>
          </div>
          <div className="field" style={{ width: '180px' }}>
            <label>Bill Date *</label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              required
            />
          </div>
        </div>

        {customerType === 'new' ? (
          <div className="grid-2">
            <div className="field">
              <label>Name *</label>
              <input
                value={customerData.name}
                onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Phone</label>
              <input
                value={customerData.phone}
                onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                pattern="[0-9]{10}"
                title="Phone number must be exactly 10 digits"
                maxLength={10}
                placeholder="10-digit mobile number"
              />
            </div>
            <div className="field">
              <label>Opening Balance Due</label>
              <input
                type="number"
                min="0"
                value={customerData.openingBalance}
                onChange={(e) => setCustomerData({ ...customerData, openingBalance: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label>Customer Type *</label>
              <select
                value={customerData.customerType}
                onChange={(e) => setCustomerData({ ...customerData, customerType: e.target.value })}
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
                value={customerData.email}
                onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Address</label>
              <input
                value={customerData.address}
                onChange={(e) => setCustomerData({ ...customerData, address: e.target.value })}
                placeholder="Enter address details"
              />
            </div>
          </div>
        ) : (
          <div className="field">
            <label>Select Existing Customer *</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              required
            >
              <option value="" disabled>-- Choose Existing Customer --</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.name} — {customer.phone} {customer.email ? `(${customer.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {isBuilder && (
          <div className="field" style={{ marginTop: '16px' }}>
            <label>Site Address</label>
            <textarea
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="Enter site address details for builder..."
              style={{ minHeight: '60px' }}
            />
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="section-title" style={{ marginBottom: 16 }}>Order Items</h2>

        {items.map((item, index) => {
          const lineTotal = getItemLineTotal(item);
          const normType = getNormalizedType(item.type);

          return (
            <div 
              className="item-card" 
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: normType === 'sqft' 
                  ? '2fr 1fr 1fr 1fr 2fr 120px auto' 
                  : '2fr 1fr 1fr 2fr 120px auto',
                gap: '16px',
                alignItems: 'flex-start',
                padding: '16px 20px',
              }}
            >
              {(() => {
                return (
                  <>
                    <div className="field">
                      <label>Item Type *</label>
                      <select
                        id={`item-select-${index}`}
                        value={catalog.some(c => c.name === item.wallpaperName) ? item.wallpaperName : (item.isCustomName ? 'custom' : '')}
                        onChange={(e) => handleWallpaperSelectChange(index, e.target.value)}
                        required
                      >
                        <option value="" disabled>-- Select Item Type --</option>
                        {catalog.map((c, i) => (
                          <option key={i} value={c.name}>
                            {c.name} ({getItemTypeLabel(c.type)})
                          </option>
                        ))}
                        <option value="custom">Other / Custom Item Type...</option>
                      </select>
                      {item.isCustomName && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                          <input
                            style={{ flex: 1 }}
                            value={item.wallpaperName}
                            onChange={(e) => updateItem(index, 'wallpaperName', e.target.value)}
                            placeholder="Enter custom name"
                            required
                          />
                          <select
                            value={item.type}
                            onChange={(e) => updateItem(index, 'type', e.target.value)}
                            style={{ width: '120px' }}
                          >
                            <option value="quantity">Quantity</option>
                            <option value="sqft">Square Feet</option>
                            <option value="running">Running Feet</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {normType === 'sqft' && (
                      <>
                        <div className="field">
                          <label>Height (in) *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.height ?? ''}
                            onChange={(e) => updateItem(index, 'height', e.target.value)}
                            placeholder="e.g. 96"
                            required
                          />
                        </div>
                        <div className="field">
                          <label>Width (in) *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.width ?? ''}
                            onChange={(e) => updateItem(index, 'width', e.target.value)}
                            placeholder="e.g. 144"
                            required
                          />
                        </div>
                      </>
                    )}

                    {normType === 'running' && (
                      <div className="field">
                        <label>Running Feet (ft) *</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.runningFt ?? ''}
                          onChange={(e) => updateItem(index, 'runningFt', e.target.value)}
                          placeholder="e.g. 15"
                          required
                        />
                      </div>
                    )}

                    {normType === 'quantity' && (
                      <div className="field">
                        <label>Quantity *</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div className="field">
                      <label>
                        {normType === 'sqft' && 'Price per sq ft *'}
                        {normType === 'running' && 'Price per running ft *'}
                        {normType === 'quantity' && 'Price per unit *'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.pricePerRoll}
                        onChange={(e) => updateItem(index, 'pricePerRoll', e.target.value)}
                        required
                      />
                      {(normType === 'sqft' || normType === 'running') && (
                        <small className="bill-meta" style={{ display: 'block', marginTop: 4 }}>
                          {(() => {
                            if (normType === 'sqft') {
                              const h = Number(item.height) || 0;
                              const w = Number(item.width) || 0;
                              const areaSingle = (h / 12) * (w / 12);
                              return (
                                <>
                                  Dimensions: {h.toFixed(2)} in × {w.toFixed(2)} in
                                  <br />
                                  Area: {areaSingle.toFixed(2)} sq ft
                                </>
                              );
                            } else {
                              const runningFt = Number(item.runningFt) || 0;
                              return (
                                <>
                                  Length: {runningFt.toFixed(2)} ft
                                </>
                              );
                            }
                          })()}
                        </small>
                      )}
                    </div>

                    <div className="field">
                      <label>Customization / Notes</label>
                      <input
                        value={item.customization}
                        onChange={(e) => updateItem(index, 'customization', e.target.value)}
                        placeholder="Color, batch no..."
                      />
                    </div>

                    <div className="field" style={{ textAlign: 'right' }}>
                      <label style={{ textAlign: 'right', display: 'block' }}>Line Total</label>
                      <strong style={{ fontSize: '1.2rem', color: 'var(--text)', display: 'block', padding: '10px 0' }}>
                        {formatCurrency(lineTotal)}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {items.length > 1 ? (
                        <button 
                          type="button" 
                          className="btn btn-danger" 
                          onClick={() => removeItem(index)}
                          style={{ 
                            padding: '10px', 
                            width: '40px', 
                            height: '40px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontSize: '1.1rem',
                            marginTop: '24px', 
                            borderRadius: '12px' 
                          }}
                          title="Remove Item"
                        >
                          🗑️
                        </button>
                      ) : (
                        <div style={{ width: '40px', height: '40px', marginTop: '24px' }} />
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })}

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-start' }}>
          <button type="button" className="btn btn-secondary" onClick={addItem}>
            + Add Item
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">Billing Summary</h2>
        <div className="grid-3">
          <div className="field">
            <label>Discount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Tax (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={taxPercent}
              onChange={(e) => setTaxPercent(e.target.value)}
            />
            {Number(taxPercent) > 0 && (
              <small className="bill-meta" style={{ display: 'block', marginTop: 4 }}>
                Tax: {formatCurrency(taxAmount)}
              </small>
            )}
          </div>
          <div className="field">
            <label>Grand Total</label>
            <input value={grandTotal.toFixed(2)} readOnly />
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div style={{ marginTop: 20 }}>
          <h3 className="section-title" style={{ fontSize: '1.1rem' }}>Payment</h3>
          <div className="grid-2">
            <div className="field">
              <label>Amount Paid</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="field">
              <label>Balance Due</label>
              <input value={balanceDue.toFixed(2)} readOnly />
            </div>
          </div>
          <p className="bill-meta" style={{ marginTop: 8 }}>
            Enter partial payment if customer paid only part of the bill (e.g. ₹10,000 of ₹50,000).
          </p>
          {(() => {
            const selectedCustomer = customers.find(c => c._id === selectedCustomerId) || (loadedCustomer?._id === selectedCustomerId ? loadedCustomer : null);
            if (!selectedCustomer) return null;
            const prevBalance = isEdit 
              ? (selectedCustomer.balanceDue || 0) - originalOrderBalance 
              : (selectedCustomer.balanceDue || 0);
            const newTotalBalance = prevBalance + balanceDue;

            return (
              <div 
                style={{ 
                  marginTop: 16, 
                  padding: '16px', 
                  background: 'var(--surface-alt)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div>
                  <span className="bill-meta" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 2 }}>Previous Customer Balance</span>
                  <strong className={prevBalance > 0 ? 'text-danger' : 'text-success'} style={{ fontSize: '1.1rem' }}>
                    {formatCurrency(prevBalance)}
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="bill-meta" style={{ display: 'block', fontSize: '0.8rem', marginBottom: 2 }}>New Total Outstanding Balance</span>
                  <strong className={newTotalBalance > 0 ? 'text-danger' : 'text-success'} style={{ fontSize: '1.1rem' }}>
                    {formatCurrency(newTotalBalance)}
                  </strong>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {isEdit 
            ? (loading ? 'Updating Bill...' : 'Update Bill') 
            : (loading ? 'Creating Bill...' : 'Create Bill')}
        </button>
      </div>
    </form>
    </>
  );
}
