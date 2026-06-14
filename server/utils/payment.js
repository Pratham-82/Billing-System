function getEffectiveAmountPaid(order) {
  const stored = Number(order.amountPaid);
  if (!Number.isNaN(stored) && stored > 0) return stored;
  if (order.paymentStatus === 'paid') return order.grandTotal;
  return 0;
}

function normalizePayment(amountPaid, grandTotal) {
  const paid = Math.min(Math.max(0, Number(amountPaid) || 0), grandTotal);

  let paymentStatus = 'unpaid';
  if (paid >= grandTotal) paymentStatus = 'paid';
  else if (paid > 0) paymentStatus = 'partial';

  return {
    amountPaid: paid,
    paymentStatus,
    paidAt: paid > 0 ? new Date() : null,
    balanceDue: grandTotal - paid,
  };
}

module.exports = { getEffectiveAmountPaid, normalizePayment };
