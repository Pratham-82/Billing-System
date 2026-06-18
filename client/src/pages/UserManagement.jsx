import { useState, useEffect } from 'react';
import { api } from '../api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('normal');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        console.error(e);
      }
    }
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.createUser({
        username: username.trim(),
        password: password.trim(),
        role
      });
      setSuccess(`User "${username}" created successfully.`);
      setUsername('');
      setPassword('');
      setRole('normal');
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete user "${name}"?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.deleteUser(id);
      setSuccess(`User "${name}" deleted successfully.`);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="card">
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", marginBottom: '8px' }}>User Account Management</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Create and manage access credentials for administrators and standard operators
        </p>

        {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>⚠️ {error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: '20px' }}>✅ {success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '32px' }}>
          
          {/* USER CREATION FORM */}
          <div>
            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: '600' }}>Add New User</h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label htmlFor="new-username">Username</label>
                <input
                  type="text"
                  id="new-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-password">Password</label>
                <input
                  type="password"
                  id="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={loading}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="new-role">Role</label>
                <select
                  id="new-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  disabled={loading}
                  style={{ width: '100%' }}
                >
                  <option value="normal">Normal User (Staff/Operator)</option>
                  <option value="superuser">Super User (Administrator)</option>
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ alignSelf: 'flex-start', padding: '10px 24px', fontWeight: '600' }}
              >
                {loading ? 'Adding...' : 'Add User'}
              </button>
            </form>
          </div>

          {/* USER LIST */}
          <div>
            <h3 style={{ marginBottom: '16px', fontSize: '1.2rem', fontWeight: '600' }}>Existing Users</h3>
            {users.length === 0 && !loading ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No registered users.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const isSelf = currentUser?.id === u._id || currentUser?.username === u.username;
                      return (
                        <tr key={u._id}>
                          <td style={{ fontWeight: '500' }}>
                            {u.username} {isSelf && <small style={{ color: 'var(--primary)' }}>(You)</small>}
                          </td>
                          <td>
                            <span 
                              className="badge"
                              style={{
                                background: u.role === 'superuser' ? '#ffe8d6' : '#e2eafc',
                                color: u.role === 'superuser' ? '#b0825e' : '#4a5568',
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                border: u.role === 'superuser' ? '1px solid #fcd2b4' : '1px solid #c7d2fe',
                                borderRadius: '4px',
                                fontWeight: '600',
                                textTransform: 'capitalize'
                              }}
                            >
                              {u.role === 'superuser' ? 'Super User' : 'Normal'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleDeleteUser(u._id, u.username)}
                              disabled={isSelf || loading}
                              style={{
                                background: 'transparent',
                                color: isSelf ? 'var(--text-muted)' : 'var(--danger)',
                                border: 'none',
                                padding: '0',
                                textDecoration: isSelf ? 'none' : 'underline',
                                cursor: isSelf ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem'
                              }}
                            >
                              {isSelf ? '—' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
