import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Bill from '../components/Bill';


export default function BillView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [customerAccount, setCustomerAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orientation, setOrientation] = useState('portrait');

  async function handleDelete() {
    if (window.confirm(`Are you sure you want to delete this bill (${order?.billNumber})?`)) {
      try {
        await api.deleteOrder(order._id);
        navigate('/orders');
      } catch (err) {
        setError(err.message || 'Failed to delete bill');
      }
    }
  }

  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const orderData = await api.getOrder(id);
      setOrder(orderData);
      if (orderData.customer?._id) {
        const accountData = await api.getCustomerAccount(orderData.customer._id);
        setCustomerAccount(accountData.account);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadData(true);
  }, [id]);

  useEffect(() => {
    if (order?.billNumber) {
      document.title = order.billNumber;
    }
    return () => {
      document.title = "Speaking Wall Interio Billing";
    };
  }, [order]);

  const downloadPDF = () => {
    const element = document.querySelector('.bill');
    if (!element) return Promise.resolve();

    element.classList.add('pdf-mode');

    const opt = {
      margin:       10,
      filename:     `${order.billNumber}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: orientation }
    };

    return window.html2pdf()
      .from(element)
      .set(opt)
      .save()
      .then(() => {
        element.classList.remove('pdf-mode');
      })
      .catch((err) => {
        console.error(err);
        element.classList.remove('pdf-mode');
      });
  };

  if (loading) {
    return <div className="card empty-state">Loading bill...</div>;
  }

  if (error && !order) {
    return <div className="card alert alert-error">{error}</div>;
  }

  return (
    <>
      {order.isDeleted && (
        <div className="alert alert-error no-print" style={{ marginBottom: 20, fontWeight: 'bold' }}>
          ⚠️ This bill has been deleted and is no longer active.
        </div>
      )}

      <style>
        {`
          @media print {
            @page {
              size: ${orientation} !important;
              margin: 0 !important;
            }
          }
        `}
      </style>

      <div className="btn-row no-print" style={{ marginBottom: 20, alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={downloadPDF}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => window.print()}
        >
          Print Bill
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Orientation:</span>
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </div>
        {!order.isDeleted && (
          <>
            <Link to={`/edit-bill/${order._id}`} className="btn btn-secondary">
              Edit Bill
            </Link>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
            >
              Delete Bill
            </button>
          </>
        )}
      </div>

      {error && <div className="alert alert-error no-print">{error}</div>}

      <div className="card">
        <Bill order={order} customerBalance={customerAccount?.balanceDue} />
      </div>
    </>
  );
}
