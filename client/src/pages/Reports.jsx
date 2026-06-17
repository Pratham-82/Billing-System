import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx-js-style';
import { api } from '../api';
// PaymentBadge import removed as order-level payment status is deprecated
import { formatCurrency } from '../utils/format';

export default function Reports() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({
    totalSale: 0,
    totalOrders: 0,
    totalSqFt: 0,
    totalRolls: 0,
    totalRunningFt: 0
  });
  const [loading, setLoading] = useState(false);
  const [activeRange, setActiveRange] = useState('month');

  // Helper to format Date as YYYY-MM-DD in local time
  const formatLocal = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const setQuickRange = (rangeKey) => {
    setActiveRange(rangeKey);
    const today = new Date();

    if (rangeKey === 'today') {
      const todayStr = formatLocal(today);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (rangeKey === 'yesterday') {
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      const yesterdayStr = formatLocal(yesterday);
      setStartDate(yesterdayStr);
      setEndDate(yesterdayStr);
    } else if (rangeKey === 'week') {
      const currentDay = today.getDay(); // 0 is Sunday, 1 is Monday...
      const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      setStartDate(formatLocal(monday));
      setEndDate(formatLocal(new Date()));
    } else if (rangeKey === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(formatLocal(firstDay));
      setEndDate(formatLocal(new Date()));
    } else if (rangeKey === 'last30') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setStartDate(formatLocal(past));
      setEndDate(formatLocal(new Date()));
    }
  };

  // Set default range to 'month' on mount
  useEffect(() => {
    setQuickRange('month');
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchReport = async () => {
      setLoading(true);
      try {
        const data = await api.getOrderReport({ startDate, endDate });
        setOrders(data.orders || []);
        setSummary(data.summary || {
          totalSale: 0,
          totalOrders: 0,
          totalSqFt: 0,
          totalRolls: 0,
          totalRunningFt: 0
        });
      } catch (err) {
        console.error('Failed to load report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [startDate, endDate]);

  const handleStartDateChange = (e) => {
    setActiveRange('custom');
    setStartDate(e.target.value);
  };

  const handleEndDateChange = (e) => {
    setActiveRange('custom');
    setEndDate(e.target.value);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getItemSummaryString = (items) => {
    if (!items || items.length === 0) return '—';
    const grouped = {};
    items.forEach(item => {
      const name = (item.wallpaperName || 'Unknown').trim();
      const type = item.type || 'quantity';
      const unit = item.measurementUnit || 'in';
      const h = item.height || item.heightFt || 0;
      const w = item.width || item.widthFt || 0;
      const runFt = item.runningFt || 0;
      const key = `${name}|${type}|${unit}|${h}|${w}|${runFt}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          wallpaperName: name,
          type: type,
          runningFt: runFt,
          quantity: 0,
          areaSqFt: 0
        };
      }
      const qty = Number(item.quantity) || 1;
      grouped[key].quantity += qty;
      const singleArea = item.areaSqFt || (unit === 'in' ? (h / 12) * (w / 12) : h * w);
      grouped[key].areaSqFt += singleArea * qty;
    });

    return Object.values(grouped).map(group => {
      const qty = group.quantity;
      if (group.type === 'sqft' || group.type === 'custom') {
        const singleArea = group.areaSqFt / qty;
        return `${group.wallpaperName} (${qty}x ${singleArea.toFixed(1)} sq ft)`;
      } else if (group.type === 'running') {
        return `${group.wallpaperName} (${qty}x ${group.runningFt} ft)`;
      } else {
        return `${group.wallpaperName} (x${qty})`;
      }
    }).join(', ');
  };

  const exportToExcel = () => {
    if (orders.length === 0) return;

    // Sheet 1: Report Summary
    const summaryData = [
      ['Speaking Wall Interio - Sales Report Summary'],
      ['Date Range', `${formatDate(startDate)} to ${formatDate(endDate)}`],
      [],
      ['Metric', 'Value'],
      ['Total Sales (INR)', summary.totalSale],
      ['Total Orders', summary.totalOrders],
      ['Total Area (Sq Ft)', summary.totalSqFt],
      ['Total Rolls / Qty', summary.totalRolls],
      ['Total Running Feet', summary.totalRunningFt]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [
      { wch: 30 },
      { wch: 20 }
    ];

    // Style Summary Sheet
    Object.keys(wsSummary).forEach(key => {
      if (key.startsWith('!')) return;
      const cell = wsSummary[key];
      const row = parseInt(key.replace(/[^0-9]/g, ''), 10);
      
      cell.s = {
        font: { name: 'Arial', size: 10 },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E5E5' } },
          bottom: { style: 'thin', color: { rgb: 'E5E5E5' } },
          left: { style: 'thin', color: { rgb: 'E5E5E5' } },
          right: { style: 'thin', color: { rgb: 'E5E5E5' } }
        }
      };

      if (row === 1) {
        cell.s = {
          font: { name: 'Arial', size: 14, bold: true, color: { rgb: '1A202C' } },
          border: {}
        };
      } else if (row === 2) {
        cell.s = {
          font: { name: 'Arial', size: 10, italic: true, color: { rgb: '718096' } },
          border: {}
        };
      } else if (row === 4) {
        cell.s = {
          font: { name: 'Arial', size: 11, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '2D3748' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '1A202C' } },
            bottom: { style: 'medium', color: { rgb: '1A202C' } }
          }
        };
      } else if (row > 4) {
        cell.s.font = { name: 'Arial', size: 11, bold: true, color: { rgb: '2D3748' } };
      }
    });

    // Sheet 2: Order Details (Grouped Tabular Layout)
    const orderHeaders = [[
      'Bill Number',
      'Date',
      'Customer Name',
      'Customer Phone',
      'Site Address',
      'Item Name',
      'Item Type',
      'Quantity',
      'Dimensions',
      'Rate (INR)',
      'Rounded Area/Length',
      'Item Total (INR)'
    ]];

    const orderRows = [];
    orders.forEach(order => {
      const items = order.items && order.items.length > 0 ? order.items : [{}];
      items.forEach((item, index) => {
        let dims = '—';
        let roundedMeasure = '—';
        
        if (item.type === 'sqft' || item.type === 'custom') {
          const unit = item.measurementUnit || 'in';
          const h = item.height || item.heightFt || 0;
          const w = item.width || item.widthFt || 0;
          dims = `${h}X${w} ${unit}`;
          const singleArea = item.areaSqFt || (unit === 'in' ? (h / 12) * (w / 12) : h * w);
          roundedMeasure = `${Math.round((item.quantity || 1) * singleArea)} sq ft`;
        } else if (item.type === 'running') {
          const runFt = item.runningFt || 0;
          dims = `${runFt} ft`;
          roundedMeasure = `${(item.quantity || 1) * runFt} ft`;
        } else if (item.type) {
          dims = '—';
          roundedMeasure = `${item.quantity || 1} qty`;
        }

        const isFirst = index === 0;

        orderRows.push([
          isFirst ? (order.billNumber || '—') : '',
          isFirst ? formatDate(order.billDate || order.createdAt) : '',
          isFirst ? (order.customer?.name || order.customerName || 'Deleted Customer') : '',
          isFirst ? (order.customer?.phone || order.customerPhone || '—') : '',
          isFirst ? (order.siteAddress || '—') : '',
          item.wallpaperName || '—',
          item.type || '—',
          item.quantity !== undefined ? item.quantity : '—',
          dims,
          item.pricePerRoll !== undefined ? item.pricePerRoll : '—',
          roundedMeasure,
          item.lineTotal !== undefined ? item.lineTotal : '—'
        ]);
      });

      // Add summary totals for this order
      orderRows.push([
        '', '', '', '', '', '', '', '', '',
        'Subtotal:', '', order.subtotal || 0
      ]);
      if (order.discount > 0) {
        orderRows.push([
          '', '', '', '', '', '', '', '', '',
          'Discount:', '', -order.discount
        ]);
      }
      if (order.tax > 0) {
        orderRows.push([
          '', '', '', '', '', '', '', '', '',
          'Tax:', '', order.tax
        ]);
      }
      orderRows.push([
        '', '', '', '', '', '', '', '', '',
        'Grand Total:', '', order.grandTotal || 0
      ]);

      // Add a blank separator row
      orderRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    });

    const wsOrders = XLSX.utils.aoa_to_sheet([...orderHeaders, ...orderRows]);

    // Style Order Details Sheet
    Object.keys(wsOrders).forEach(key => {
      if (key.startsWith('!')) return;
      
      const cell = wsOrders[key];
      const col = key.replace(/[0-9]/g, '');
      const row = parseInt(key.replace(/[^0-9]/g, ''), 10);
      
      // Default cell styles
      cell.s = {
        font: { name: 'Arial', size: 10 },
        border: {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } }
        }
      };

      if (row === 1) {
        // Headers row
        cell.s = {
          font: { name: 'Arial', size: 10, bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '2D3748' } }, // Dark charcoal/slate
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: '1A202C' } },
            bottom: { style: 'medium', color: { rgb: '1A202C' } },
            left: { style: 'thin', color: { rgb: '4A5568' } },
            right: { style: 'thin', color: { rgb: '4A5568' } }
          }
        };
      } else {
        const rowData = orderRows[row - 2];
        if (rowData) {
          const isTotalRow = rowData[9] === 'Subtotal:' || rowData[9] === 'Discount:' || rowData[9] === 'Tax:' || rowData[9] === 'Grand Total:';
          const isBlankRow = rowData.every(c => c === '');
          
          if (isBlankRow) {
            // Remove borders for blank separators
            cell.s = { border: {} };
          } else if (isTotalRow) {
            const label = rowData[9];
            if (label === 'Grand Total:') {
              cell.s = {
                font: { name: 'Arial', size: 10, bold: true, color: { rgb: '000000' } },
                fill: { fgColor: { rgb: 'F7FAFC' } },
                border: {
                  top: { style: 'thin', color: { rgb: '1A202C' } },
                  bottom: { style: 'double', color: { rgb: '000000' } }
                }
              };
            } else {
              cell.s = {
                font: { name: 'Arial', size: 10, bold: true, color: { rgb: '4A5568' } },
                border: {
                  top: { style: 'thin', color: { rgb: 'CBD5E0' } },
                  bottom: { style: 'thin', color: { rgb: 'CBD5E0' } }
                }
              };
            }
          } else {
            // Check if it's the first row of an order to add separating border
            const hasBillNumber = rowData[0] !== '';
            if (hasBillNumber) {
              cell.s.border.top = { style: 'medium', color: { rgb: '718096' } };
            }
          }
        }
      }
    });

    // Calculate maximum lengths for column auto-fitting
    const maxCols = orderHeaders[0].map(h => h.length);
    orderRows.forEach(row => {
      row.forEach((val, i) => {
        if (i < maxCols.length) {
          const len = val !== null && val !== undefined ? val.toString().length : 0;
          if (len > maxCols[i]) {
            maxCols[i] = len;
          }
        }
      });
    });
    wsOrders['!cols'] = maxCols.map(w => ({ wch: Math.min(45, Math.max(w + 3, 10)) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(workbook, wsOrders, 'Order Details');

    XLSX.writeFile(workbook, `sales_report_${startDate}_to_${endDate}.xlsx`);
  };

  const getQuickRangeStyle = (key) => ({
    padding: '8px 14px',
    fontSize: '0.85rem',
    borderRadius: '8px',
    border: '1px solid',
    cursor: 'pointer',
    fontWeight: '600',
    backgroundColor: activeRange === key ? 'var(--primary)' : 'var(--surface-alt)',
    color: activeRange === key ? 'white' : 'var(--text)',
    borderColor: activeRange === key ? 'var(--primary)' : 'var(--border)',
    transition: 'all 0.2s ease'
  });

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
      
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontFamily: 'Playfair Display, Georgia, serif', margin: 0 }}>Reports & Analytics</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Analyze sales performance, items volume, and date-range metrics.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={exportToExcel}
          disabled={orders.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
        >
          📥 Export Report (Excel)
        </button>
      </div>

      {/* Date Range Selector Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: 1 }}>
            <div className="field" style={{ minWidth: '160px', flex: 1 }}>
              <label>Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={handleStartDateChange}
              />
            </div>
            <div className="field" style={{ minWidth: '160px', flex: 1 }}>
              <label>End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={handleEndDateChange}
              />
            </div>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button type="button" style={getQuickRangeStyle('today')} onClick={() => setQuickRange('today')}>Today</button>
            <button type="button" style={getQuickRangeStyle('yesterday')} onClick={() => setQuickRange('yesterday')}>Yesterday</button>
            <button type="button" style={getQuickRangeStyle('week')} onClick={() => setQuickRange('week')}>This Week</button>
            <button type="button" style={getQuickRangeStyle('month')} onClick={() => setQuickRange('month')}>This Month</button>
            <button type="button" style={getQuickRangeStyle('last30')} onClick={() => setQuickRange('last30')}>Last 30 Days</button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '4px solid var(--primary)', marginTop: 0 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total Sales</span>
          <strong style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>{formatCurrency(summary.totalSale)}</strong>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '4px solid var(--success)', marginTop: 0 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total Orders</span>
          <strong style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>{summary.totalOrders}</strong>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '4px solid #4a90e2', marginTop: 0 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Area (Sq Ft)</span>
          <strong style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>{summary.totalSqFt.toLocaleString()} sq ft</strong>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '4px solid #dfa23b', marginTop: 0 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Rolls / Qty</span>
          <strong style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>{summary.totalRolls}</strong>
        </div>
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', borderLeft: '4px solid #b05e95', marginTop: 0 }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Running Feet</span>
          <strong style={{ fontSize: '1.4rem', color: 'var(--accent)' }}>{summary.totalRunningFt} ft</strong>
        </div>
      </div>

      {/* Orders Breakdown */}
      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="section-title" style={{ margin: 0 }}>Orders Breakdown</h3>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportToExcel}
            disabled={orders.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.85rem', marginTop: 0 }}
          >
            📥 Export to Excel
          </button>
        </div>
        
        {loading ? (
          <div className="empty-state">Loading report data...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">No orders found for the selected date range.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bill No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Items Summary</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td>
                      <Link to={`/bill/${order._id}`} style={{ fontWeight: 'bold', color: 'var(--primary)', textDecoration: 'underline' }}>
                        {order.billNumber}
                      </Link>
                    </td>
                    <td>{formatDate(order.billDate || order.createdAt)}</td>
                    <td>
                      {order.customer ? (
                        <Link to="/customers" style={{ fontWeight: '500' }}>
                          {order.customer.name}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {order.customerName || 'Deleted Customer'}
                        </span>
                      )}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>
                      {order.customer?.customerType || 'retail'}
                    </td>
                    <td style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getItemSummaryString(order.items)}>
                      {getItemSummaryString(order.items)}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{formatCurrency(order.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
