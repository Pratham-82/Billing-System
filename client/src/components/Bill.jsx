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

  const customerName = order.customer?.name || order.customerName || 'Deleted Customer';
  const customerPhone = order.customer?.phone || order.customerPhone || '—';
  const customerEmail = order.customer?.email || order.customerEmail || '—';
  const customerAddress = order.customer?.address || order.customerAddress || '—';

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
          <div><strong>Name:</strong> {customerName}</div>
          <div><strong>Phone:</strong> {customerPhone}</div>
          <div><strong>Email:</strong> {customerEmail}</div>
          <div><strong>Address:</strong> {customerAddress}</div>
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
              
              // consecutive run total area calculation
              const isLastOfRun = index === order.items.length - 1 || 
                                  order.items[index + 1].wallpaperName?.trim() !== item.wallpaperName?.trim();
              
              let runItems = [];
              let runIndex = index;
              while (runIndex >= 0 && order.items[runIndex].wallpaperName?.trim() === item.wallpaperName?.trim()) {
                runItems.push(order.items[runIndex]);
                runIndex--;
              }
              
              const showRunTotal = isLastOfRun && runItems.length > 1;
              const totalRunArea = showRunTotal ? runItems.reduce((sum, runItem) => {
                if (runItem.type === 'sqft' || runItem.type === 'custom') {
                  const qty = runItem.quantity || 1;
                  const unit = runItem.measurementUnit || 'in';
                  const h = runItem.height || runItem.heightFt || 0;
                  const w = runItem.width || runItem.widthFt || 0;
                  const area = runItem.areaSqFt || (unit === 'in' ? (h / 12) * (w / 12) : h * w);
                  return sum + (area * qty);
                }
                return sum;
              }, 0) : 0;

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
                      const priceStr = ` @ ${formatCurrency(item.pricePerRoll)}`;
                      let detailText = '';

                      if (t === 'sqft' || t === 'custom') {
                        const unit = item.measurementUnit || 'in';
                        const h = item.height || item.heightFt || 0;
                        const w = item.width || item.widthFt || 0;
                        const singleArea = item.areaSqFt || (unit === 'in' ? (h / 12) * (w / 12) : h * w);
                        const totalArea = singleArea * qty;

                        detailText = qty > 1
                          ? `${qty} pcs × ${w}X${h} = ${Math.round(totalArea)} sq ft${priceStr}`
                          : `${w}X${h} = ${Math.round(singleArea)} sq ft${priceStr}`;
                      } else if (t === 'running') {
                        const runningFt = item.runningFt || 0;
                        const totalLength = runningFt * qty;
                        detailText = qty > 1
                          ? `${qty} pcs × ${runningFt} ft = ${totalLength.toFixed(2)} ft${priceStr}`
                          : `${runningFt} ft${priceStr}`;
                      } else {
                        detailText = `${qty}${priceStr}`;
                      }

                      return (
                        <div>
                          <div>{detailText}</div>
                          {showRunTotal && totalRunArea > 0 && (
                            <div style={{ 
                              marginTop: '4px', 
                              fontWeight: '600', 
                              color: 'var(--text-muted)',
                              fontSize: '0.82rem',
                              borderTop: '1px dashed var(--border)',
                              paddingTop: '2px',
                              display: 'inline-block'
                            }}>
                              Total {item.wallpaperName} Area: {Math.round(totalRunArea)} sq ft
                            </div>
                          )}
                        </div>
                      );
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
        const currentAmountPaid = order.amountPaid || 0;
        const totalOutstanding = customerBalance !== undefined ? customerBalance : currentBillTotal;
        const oldDues = customerBalance !== undefined ? totalOutstanding - (currentBillTotal - currentAmountPaid) : 0;

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
              <>
                <div style={{ marginTop: '8px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                  <span>Balance Due</span>
                  <span>{formatCurrency(oldDues)}</span>
                </div>
                <div>
                  <span>Amount Paid</span>
                  <span>{formatCurrency(currentAmountPaid)}</span>
                </div>
                <div className="grand" style={{ borderTop: '2px double var(--border)', marginTop: '8px', paddingTop: '8px' }}>
                  <span>Account Balance Due</span>
                  <span className={totalOutstanding > 0 ? 'text-danger' : 'text-success'} style={{ fontWeight: 'bold' }}>
                    {formatCurrency(totalOutstanding)}
                  </span>
                </div>
              </>
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
