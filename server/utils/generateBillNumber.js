async function generateBillNumber(Order) {
  const year = new Date().getFullYear();
  const prefix = `WB-${year}-`;

  const lastOrder = await Order.findOne({ billNumber: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1 })
    .select('billNumber');

  let nextNumber = 1;
  if (lastOrder?.billNumber) {
    const parts = lastOrder.billNumber.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNumber).padStart(4, '0')}`;
}

module.exports = generateBillNumber;
