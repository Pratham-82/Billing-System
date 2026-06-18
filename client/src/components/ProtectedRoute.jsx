import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requireSuperUser = false }) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(userStr);
    
    if (requireSuperUser && user.role !== 'superuser') {
      // If superuser is required but user is not admin, redirect to Dashboard
      return <Navigate to="/" replace />;
    }
  } catch (err) {
    // If user object is corrupted, force login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  return children;
}
