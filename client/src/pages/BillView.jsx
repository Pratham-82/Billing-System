import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import Bill from '../components/Bill';
import PaymentBadge, { RecordPayment } from '../components/PaymentBadge';
import { getBalanceDue } from '../utils/payment';


export default function BillView() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [customerAccount, setCustomerAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
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
      <div className="btn-row no-print" style={{ marginBottom: 20, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={downloadPDF}
        >
          Download PDF
        </button>
        <Link to={`/edit-bill/${order._id}`} className="btn btn-secondary">
          Edit Bill
        </Link>
        <PaymentBadge order={order} />
      </div>

      {error && <div className="alert alert-error no-print">{error}</div>}

      <div className="card">
        <Bill order={order} customerBalance={customerAccount?.balanceDue} />
      </div>
    </>
  );
}
