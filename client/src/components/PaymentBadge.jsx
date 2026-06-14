import { useState } from 'react';
import { api } from '../api';
import { formatCurrency } from '../utils/format';
import { getAmountPaid, getBalanceDue } from '../utils/payment';


export default function PaymentBadge({ order, status }) {
  const paymentStatus = status || order?.paymentStatus || 'unpaid';

  const labels = {
    paid: 'Paid',
    partial: 'Partial',
    unpaid: 'Unpaid',
  };

  return (
    <span className={`badge badge-${paymentStatus}`}>
      {labels[paymentStatus] || 'Unpaid'}
    </span>
  );
}

export function PaymentSummary({ order }) {
  const paid = getAmountPaid(order);
  const balance = getBalanceDue(order);

  return (
    <div className="payment-summary">
      <div><span>Bill Total</span><strong>{formatCurrency(order.grandTotal)}</strong></div>
      <div><span>Amount Paid</span><strong className="text-success">{formatCurrency(paid)}</strong></div>
      <div><span>Balance Due</span><strong className={balance > 0 ? 'text-danger' : 'text-success'}>{formatCurrency(balance)}</strong></div>
    </div>
  );
}

export function RecordPayment({ order, onUpdated, compact = false }) {
  const [amountPaid, setAmountPaid] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const due = getBalanceDue(order);
  const alreadyPaid = getAmountPaid(order);
  const balance = Math.max(0, due - (Number(amountPaid) || 0));

  async function savePayment(paidValue) {
    if (paidValue < 0) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateOrderPayment(order._id, paidValue);
      setAmountPaid('');
      onUpdated?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const val = Number(amountPaid) || 0;
    if (val <= 0) {
      setError('Please enter an amount greater than 0.');
      return;
    }
    savePayment(val);
  }

  return (
    <form className={`record-payment ${compact ? 'record-payment-compact' : ''}`} onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="field">
        <label>Add Payment Amount</label>
        <input
          type="number"
          min="10"
          max={due}
          step="10"
          value={amountPaid}
          placeholder={`Max: ${formatCurrency(due)}`}
          onChange={(e) => setAmountPaid(e.target.value)}
          required
        />
      </div>

      {!compact && (
        <div className="payment-summary inline">
          <div><span>Amount Paid</span><span>{formatCurrency(alreadyPaid + (Number(amountPaid) || 0))}</span></div>
          <div><span>Remaining Due</span><span className={balance > 0 ? 'text-danger' : 'text-success'}>{formatCurrency(balance)}</span></div>
        </div>
      )}

      <div className="btn-row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Payment'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={() => {
            savePayment(due);
          }}
        >
          Mark Full Paid
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={() => {
            setAmountPaid('');
          }}
        >
          Clear Input
        </button>
        {/* {getAmountPaid(order) > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ color: 'var(--danger-color, red)', borderColor: 'var(--danger-color, red)' }}
            disabled={saving}
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all payment logs for this order?")) {
                savePayment(0);
              }
            }}
          >
            Reset All
          </button>
        )} */}
      </div>
    </form>
  );
}
