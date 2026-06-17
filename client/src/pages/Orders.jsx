import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatCurrency } from '../utils/format';
import Bill from '../components/Bill';

function getOrderTotalSqFt(order) {
  if (!order || !order.items || !Array.isArray(order.items)) return 0;
  return order.items.reduce((sum, item) => {
    if (item.type === 'sqft' || item.type === 'custom') {
      const qty = Number(item.quantity) || 1;
      const unit = item.measurementUnit || 'in';
      const h = Number(item.height) || Number(item.heightFt) || 0;
      const w = Number(item.width) || Number(item.widthFt) || 0;
      const area = item.areaSqFt || (unit === 'in' ? (h / 12) * (w / 12) : h * w);
      return sum + (area * qty);
    }
    return sum;
  }, 0);
}

export default function Orders() {
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfOrders, setPdfOrders] = useState([]);
  const [pdfBalances, setPdfBalances] = useState({});

  // Reset selection when search criteria changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, selectedCustomerId, startDate, endDate]);

  const toggleSelectOrder = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visibleActiveOrders = orders.filter(o => !o.isDeleted);
    const allSelected = visibleActiveOrders.length > 0 && visibleActiveOrders.every(o => selectedIds.has(o._id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      visibleActiveOrders.forEach(o => {
        if (allSelected) {
          next.delete(o._id);
        } else {
          next.add(o._id);
        }
      });
      return next;
    });
  };

  const downloadSelectedPDFs = async (consolidated = true) => {
    if (selectedIds.size === 0) return;
    setIsGeneratingPDF(true);
    try {
      const selectedOrders = orders.filter(o => selectedIds.has(o._id));
      
      // Fetch customer balances in parallel
      const customerIds = [...new Set(selectedOrders.map(o => o.customer?._id).filter(Boolean))];
      const balances = {};
      await Promise.all(customerIds.map(async (id) => {
        try {
          const accountData = await api.getCustomerAccount(id);
          balances[id] = accountData.account.balanceDue;
        } catch (e) {
          console.error('Failed to load balance for customer', id, e);
        }
      }));

      setPdfBalances(balances);
      setPdfOrders(selectedOrders);

      // Wait for state rendering in the DOM
      setTimeout(() => {
        if (consolidated) {
          const contents = document.getElementById('pdf-batch-contents');
          if (!contents) {
            setIsGeneratingPDF(false);
            return;
          }

          // Add pdf-mode to each bill
          const billElements = contents.querySelectorAll('.bill');
          billElements.forEach(el => el.classList.add('pdf-mode'));

          const opt = {
            margin:       0,
            filename:     `bills_export_${new Date().toISOString().split('T')[0]}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak:    { mode: ['css', 'legacy'], avoid: '.bill' }
          };

          window.html2pdf()
            .from(contents)
            .set(opt)
            .save()
            .then(() => {
              billElements.forEach(el => el.classList.remove('pdf-mode'));
              setIsGeneratingPDF(false);
              setPdfOrders([]);
            })
            .catch(err => {
              console.error(err);
              billElements.forEach(el => el.classList.remove('pdf-mode'));
              setIsGeneratingPDF(false);
              setPdfOrders([]);
            });
        } else {
          // Download individual files
          const runDownloads = async () => {
            for (let i = 0; i < selectedOrders.length; i++) {
              const order = selectedOrders[i];
              
              const tempDiv = document.createElement('div');
              tempDiv.style.position = 'fixed';
              tempDiv.style.top = '0';
              tempDiv.style.left = '0';
              tempDiv.style.width = '100vw';
              tempDiv.style.height = '100vh';
              tempDiv.style.zIndex = '99999';
              tempDiv.style.background = '#ffffff';
              tempDiv.style.overflowY = 'auto';
              
              const loaderHeader = document.createElement('div');
              loaderHeader.style.position = 'fixed';
              loaderHeader.style.top = '0';
              loaderHeader.style.left = '0';
              loaderHeader.style.width = '100%';
              loaderHeader.style.textAlign = 'center';
              loaderHeader.style.padding = '24px';
              loaderHeader.style.background = 'linear-gradient(135deg, var(--accent), var(--accent-hover, #a36f4c))';
              loaderHeader.style.color = '#ffffff';
              loaderHeader.style.fontSize = '1.2rem';
              loaderHeader.style.fontWeight = '600';
              loaderHeader.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
              loaderHeader.style.letterSpacing = '0.5px';
              loaderHeader.style.zIndex = '100000';
              loaderHeader.innerText = `⏳ Generating PDF ${i + 1} of ${selectedOrders.length} (${order.billNumber})... Please wait.`;
              tempDiv.appendChild(loaderHeader);

              const contentDiv = document.createElement('div');
              contentDiv.style.width = '1120px';
              contentDiv.style.margin = '0 auto';
              contentDiv.style.padding = '0';
              contentDiv.style.background = '#ffffff';
              tempDiv.appendChild(contentDiv);
              
              document.body.appendChild(tempDiv);
              
              const renderedBill = document.getElementById(`pdf-single-bill-${i}`);
              if (renderedBill) {
                const clonedBill = renderedBill.cloneNode(true);
                clonedBill.classList.add('pdf-mode');
                contentDiv.appendChild(clonedBill);

                const opt = {
                  margin:       0,
                  filename:     `${order.billNumber}.pdf`,
                  image:        { type: 'jpeg', quality: 0.98 },
                  html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
                  jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' },
                  pagebreak:    { mode: ['css', 'legacy'], avoid: '.bill' }
                };

                await new Promise((resolve) => {
                  window.html2pdf()
                    .from(contentDiv)
                    .set(opt)
                    .save()
                    .then(() => {
                      document.body.removeChild(tempDiv);
                      resolve();
                    })
                    .catch(err => {
                      console.error(err);
                      document.body.removeChild(tempDiv);
                      resolve();
                    });
                });

                await new Promise(resolve => setTimeout(resolve, 400));
              } else {
                document.body.removeChild(tempDiv);
              }
            }
          };

          runDownloads().finally(() => {
            setIsGeneratingPDF(false);
            setPdfOrders([]);
          });
        }
      }, 300);

    } catch (err) {
      alert(err.message || 'Failed to generate PDF files');
      setIsGeneratingPDF(false);
    }
  };

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await api.getCustomers('');
        setCustomers(data);
      } catch (err) {
        console.error('Failed to load customers:', err);
      }
    };
    loadCustomers();
  }, []);

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getOrders({
        search,
        customerId: selectedCustomerId || undefined,
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
  }, [search, selectedCustomerId, startDate, endDate]);



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
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            style={{ 
              width: '280px', 
              padding: '10px 14px', 
              borderRadius: '10px', 
              border: '1px solid var(--border)', 
              background: 'var(--surface-alt)', 
              color: 'var(--text)', 
              fontWeight: 500 
            }}
          >
            <option value="">-- All Customers --</option>
            {customers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} {c.phone ? `(${c.phone})` : ''}
              </option>
            ))}
          </select>
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

      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          background: 'var(--surface-alt)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <span style={{ fontWeight: 600 }}>
            Selected {selectedIds.size} {selectedIds.size === 1 ? 'bill' : 'bills'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadSelectedPDFs(true)}
              disabled={isGeneratingPDF}
              style={{ padding: '8px 16px', fontSize: '0.88rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              📄 {isGeneratingPDF ? 'Generating...' : 'Download Single PDF (All Bills)'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => downloadSelectedPDFs(false)}
              disabled={isGeneratingPDF}
              style={{ padding: '8px 16px', fontSize: '0.88rem', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              🗂️ {isGeneratingPDF ? 'Generating...' : 'Download Separate PDFs'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="empty-state">No orders found</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && orders.filter(o => !o.isDeleted).every(o => selectedIds.has(o._id))}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Bill No</th>
                <th>Customer</th>
                <th>Total Area</th>
                <th>Total</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                return (
                  <tr key={order._id} style={order.isDeleted ? { opacity: 0.6 } : {}}>
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(order._id)}
                        onChange={() => toggleSelectOrder(order._id)}
                        disabled={order.isDeleted}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{order.billNumber}</span>
                        {order.isDeleted && (
                          <span 
                            className="badge" 
                            style={{ 
                              background: '#ffebeb', 
                              color: 'var(--text-danger)', 
                              fontSize: '0.75rem', 
                              padding: '2px 8px', 
                              border: '1px solid #ffcdd2',
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}
                          >
                            Deleted
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>{order.customer?.name || order.customerName || 'Deleted Customer'}</div>
                      <small style={{ color: 'var(--text-muted)' }}>{order.customer?.phone || order.customerPhone || '—'}</small>
                    </td>
                    <td>
                      {(() => {
                        const totalSqFt = Math.round(getOrderTotalSqFt(order));
                        return totalSqFt > 0 ? `${totalSqFt} sq ft` : '—';
                      })()}
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pdfOrders.length > 0 && createPortal(
        <div 
          id="pdf-batch-container" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100vw', 
            height: '100vh', 
            overflowY: 'auto',
            background: '#ffffff', 
            zIndex: 99999
          }}
        >
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', textAlign: 'center', padding: '24px', background: 'linear-gradient(135deg, var(--accent), var(--accent-hover, #a36f4c))', color: '#ffffff', fontSize: '1.2rem', fontWeight: '600', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)', letterSpacing: '0.5px', zIndex: 100000 }}>
            ⏳ Generating Batch PDF... Please wait.
          </div>
          <div 
            id="pdf-batch-contents" 
            style={{ 
              background: '#ffffff', 
              width: '1120px', 
              margin: '0 auto'
            }}
          >
            {pdfOrders.map((order, idx) => (
              <div key={order._id}>
                <div 
                  id={`pdf-single-bill-${idx}`}
                  style={{ 
                    background: '#ffffff', 
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <Bill order={order} customerBalance={pdfBalances[order.customer?._id]} />
                </div>
                {idx < pdfOrders.length - 1 && <div className="html2pdf__page-break" />}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
