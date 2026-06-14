import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CreateOrder from './pages/CreateOrder';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import BillView from './pages/BillView';
import Items from './pages/Items';
import Reports from './pages/Reports';
import logo from './logo.png';

function App() {
  return (
    <div className="app-shell">
      <header className="topbar no-print">
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src={logo} alt="Speaking Wall Interio Logo" style={{ height: '48px', objectFit: 'contain' }} />
          <div>
            <h1 style={{ margin: 0 }}>Speaking Wall Interio</h1>
            <p style={{ margin: '4px 0 0' }}>Billing & customer management</p>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/generate-bill">New Bill</NavLink>
          <NavLink to="/orders">Orders</NavLink>
          <NavLink to="/customers">Accounts</NavLink>
          <NavLink to="/items">Items</NavLink>
          <NavLink to="/reports">Reports</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/generate-bill" element={<CreateOrder />} />
        <Route path="/edit-bill/:id" element={<CreateOrder />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/bill/:id" element={<BillView />} />
        <Route path="/items" element={<Items />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </div>
  );
}

export default App;
