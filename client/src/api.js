const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers,
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

export const api = {
  getCustomers: (search = '', customerType = '', all = false) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (customerType) params.set('customerType', customerType);
    if (all) params.set('all', 'true');
    const qs = params.toString();
    return request(`/customers${qs ? `?${qs}` : ''}`);
  },

  getCustomer: (id) => request(`/customers/${id}`),

  createCustomer: (data) =>
    request('/customers', { method: 'POST', body: JSON.stringify(data) }),

  updateCustomer: (id, data) =>
    request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteCustomer: (id) =>
    request(`/customers/${id}`, { method: 'DELETE' }),

  bulkCreateCustomers: (customers) =>
    request('/customers/bulk', { method: 'POST', body: JSON.stringify({ customers }) }),

  getOrders: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.customerId) query.set('customerId', params.customerId);
    if (params.paymentStatus) query.set('paymentStatus', params.paymentStatus);
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return request(`/orders${qs ? `?${qs}` : ''}`);
  },

  getOrderReport: (params = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    const qs = query.toString();
    return request(`/orders/report${qs ? `?${qs}` : ''}`);
  },

  getOrder: (id) => request(`/orders/${id}`),

  getNextBillNumber: () => request('/orders/next-bill'),

  createOrder: (data) =>
    request('/orders', { method: 'POST', body: JSON.stringify(data) }),

  updateOrder: (id, data) =>
    request(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteOrder: (id) =>
    request(`/orders/${id}`, { method: 'DELETE' }),

  updateOrderPayment: (id, amountPaid) =>
    request(`/orders/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ amountPaid }),
    }),

  getCustomerAccount: (id) => request(`/customers/${id}/account`),

  recordCustomerPayment: (id, amount, discount = 0) =>
    request(`/customers/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify({ amount, discount }),
    }),

  getItems: () => request('/items'),
  createItem: (data) =>
    request('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id, data) =>
    request(`/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteItem: (id) =>
    request(`/items/${id}`, { method: 'DELETE' }),

  login: (username, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getCurrentUser: () =>
    request('/auth/me'),
  getUsers: () =>
    request('/auth/users'),
  createUser: (data) =>
    request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id) =>
    request(`/auth/users/${id}`, { method: 'DELETE' }),
};
