export function getAmountPaid(order) {
  const stored = Number(order.amountPaid);
  if (!Number.isNaN(stored) && stored > 0) return stored;
  if (order.paymentStatus === 'paid') return order.grandTotal;
  return 0;
}

export function getBalanceDue(order) {
  return Math.max(0, order.grandTotal - getAmountPaid(order));
}

export function getPaymentStatus(order) {
  const paid = getAmountPaid(order);
  if (paid >= order.grandTotal) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}
