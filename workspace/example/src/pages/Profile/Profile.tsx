import React from 'react';
import { Link, Navigate } from 'react-router-dom';

type AuthUser = {
  id: string;
  name: string;
  email?: string;
};

type AuthState = {
  isAuthenticated: boolean;
  user: AuthUser | null;
  logout: () => void;
};

const useAuthStore = (): AuthState => {
  return {
    isAuthenticated: false,
    user: null,
    logout: () => {
      // placeholder
    },
  };
};

const Profile: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuthStore();

  const handleLogout = React.useCallback(() => {
    logout();
  }, [logout]);

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 12px' }}>Profile</h1>
        <p style={{ margin: '0 0 16px' }}>You are not logged in.</p>
        <Link to="/login">Go to Login</Link>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 12px' }}>Profile</h1>

      <section aria-label="User information" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', rowGap: 8 }}>
          <div>
            <strong>ID:</strong> {user.id}
          </div>
          <div>
            <strong>Name:</strong> {user.name}
          </div>
          <div>
            <strong>Email:</strong> {user.email ?? '—'}
          </div>
        </div>
      </section>

      <button type="button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
};

export default Profile;