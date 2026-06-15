import { formatCurrency } from '../utils/format';
import logo from '../logo.png';

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatItemDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return dateStr;
}

export default function Bill({ order, shopName = 'Speaking Wall Interio', customerBalance }) {
  if (!order) return null;

  const customer = order.customer;

  return (
    <div className="bill">
      <div className="bill-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src={logo} alt="Logo" style={{ height: '60px', width: 'auto', objectFit: 'contain' }} />
          <div>
            <h2>{shopName}</h2>
            <p className="bill-meta">Custom wallpaper rolls & designs</p>
          </div>
        </div>
        <div className="bill-meta" style={{ textAlign: 'right' }}>
          <div><strong>Bill No:</strong> {order.billNumber}</div>
          <div><strong>Date:</strong> {formatDate(order.billDate || order.createdAt)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="section-title">Customer Details</h3>
        <div className="grid-2">
          <div><strong>Name:</strong> {customer?.name}</div>
          <div><strong>Phone:</strong> {customer?.phone}</div>
          <div><strong>Email:</strong> {customer?.email || '—'}</div>
          <div><strong>Address:</strong> {customer?.address || '—'}</div>
          {order.siteAddress && <div><strong>Site Address:</strong> {order.siteAddress}</div>}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Details</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => {
              const isDuplicate = index > 0 && item.wallpaperName?.trim() === order.items[index - 1].wallpaperName?.trim();
              return (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <div>{isDuplicate ? '' : item.wallpaperName}</div>
                    {item.customization && (
                      <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                        {item.customization}
                      </small>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const t = item.type;
                      const qty = item.quantity || 1;
                      if (t === 'sqft' || t === 'custom') {
                        const unit = item.measurementUnit || 'in';
                        const h = item.height || item.heightFt || 0;
                        const w = item.width || item.widthFt || 0;
                        const singleArea = item.areaSqFt || (unit === 'in' ? (h / 12) * (w / 12) : h * w);
                        const totalArea = singleArea * qty;

                        return qty > 1
                          ? `${qty} pcs × ${h} ${unit} × ${w} ${unit} = ${Math.round(totalArea)} sq ft`
                          : `${h} ${unit} × ${w} ${unit} = ${Math.round(singleArea)} sq ft`;
                      } else if (t === 'running') {
                        const runningFt = item.runningFt || 0;
                        const totalLength = runningFt * qty;
                        return qty > 1
                          ? `${qty} pcs × ${runningFt} ft = ${totalLength.toFixed(2)} ft`
                          : `${runningFt} ft`;
                      } else {
                        return `${qty}`;
                      }
                    })()}
                  </td>
                  <td>{formatCurrency(item.lineTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(() => {
        const currentBillTotal = order.grandTotal;
        const totalOutstanding = customerBalance !== undefined ? customerBalance : currentBillTotal;

        return (
          <div className="totals">
            <div><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div><span>Discount</span><span>- {formatCurrency(order.discount)}</span></div>
            <div><span>Tax</span><span>{formatCurrency(order.tax)}</span></div>
            
            <div className="grand" style={{ borderTop: '1.5px solid var(--border)', marginTop: '4px', paddingTop: '4px' }}>
              <span>Total</span>
              <span>{formatCurrency(currentBillTotal)}</span>
            </div>
            
            {customerBalance !== undefined && (
              <div className="grand" style={{ borderTop: '2px double var(--border)', marginTop: '8px', paddingTop: '8px' }}>
                <span>Account Balance Due</span>
                <span className={totalOutstanding > 0 ? 'text-danger' : 'text-success'} style={{ fontWeight: 'bold' }}>
                  {formatCurrency(totalOutstanding)}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {order.notes && (
        <div style={{ marginTop: 20 }}>
          <strong>Notes:</strong> {order.notes}
        </div>
      )}
    </div>
  );
}
