import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CreateOrder from './pages/CreateOrder';
import Orders from './pages/Orders';
import Customers from './pages/Customers';
import BillView from './pages/BillView';
import Items from './pages/Items';
import Reports from './pages/Reports';
import Login from './pages/Login';
import UserManagement from './pages/UserManagement';
import ProtectedRoute from './components/ProtectedRoute';
import logo from './logo.png';

function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const loadUserFromStorage = () => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setUser(JSON.parse(userStr));
      } catch (err) {
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    loadUserFromStorage();
    
    // Listen for storage changes (e.g. login/logout)
    const handleStorageChange = () => {
      loadUserFromStorage();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    navigate('/login');
  };

  const isSuperUser = user?.role === 'superuser';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {user && (
            <nav className="nav">
              <NavLink to="/" end>Dashboard</NavLink>
              <NavLink to="/generate-bill">New Bill</NavLink>
              <NavLink to="/orders">Orders</NavLink>
              <NavLink to="/customers">Accounts</NavLink>
              <NavLink to="/items">Items</NavLink>
              {isSuperUser && <NavLink to="/reports">Reports</NavLink>}
              {isSuperUser && <NavLink to="/users">Users</NavLink>}
            </nav>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  👤 <strong>{user.username}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="btn"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                >
                  Logout
                </button>
              </div>
            )}
            <button
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle theme"
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '8px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                fontSize: '1.2rem',
                transition: 'all 0.2s ease',
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/generate-bill" element={<ProtectedRoute><CreateOrder /></ProtectedRoute>} />
        <Route path="/edit-bill/:id" element={<ProtectedRoute requireSuperUser={true}><CreateOrder /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
        <Route path="/bill/:id" element={<ProtectedRoute><BillView /></ProtectedRoute>} />
        <Route path="/items" element={<ProtectedRoute><Items /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute requireSuperUser={true}><Reports /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute requireSuperUser={true}><UserManagement /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}

export default App;
