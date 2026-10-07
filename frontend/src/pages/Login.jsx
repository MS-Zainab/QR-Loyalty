import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { logClientError } from '../services/logging';

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { slug: slugFromUrl } = useParams(); // Extract tenant slug from URL param
  const qrCodeFromUrl = searchParams.get('qr_code');

  // Resolve slug: URL param takes priority, then sessionStorage fallback
  const slug = slugFromUrl || sessionStorage.getItem('tenant_slug') || null;

  const { login, customerLogin, resetPassword } = useAuth();

  const [loginTab, setLoginTab] = useState(qrCodeFromUrl ? 'customer' : 'business'); // 'business' | 'customer'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Tenant branding state
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(false);

  // Fetch tenant info whenever slug is known
  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    const fetchTenantInfo = async () => {
      try {
        setTenantLoading(true);
        const response = await api.get(`/tenants/info/${encodeURIComponent(slug)}`);
        if (!cancelled && response.data?.success) {
          setTenantInfo(response.data.tenant);
        }
      } catch (err) {
        console.error('Failed to fetch tenant info:', err);
        // Fall back to default branding silently
      } finally {
        if (!cancelled) setTenantLoading(false);
      }
    };
    fetchTenantInfo();
    return () => { cancelled = true; };
  }, [slug]);

  // Update document title to reflect tenant name
  useEffect(() => {
    if (tenantInfo?.business_name) {
      document.title = `${tenantInfo.business_name} — Login`;
    } else {
      document.title = 'QR Loyalty — Login';
    }
    return () => { document.title = 'QR Loyalty'; };
  }, [tenantInfo]);

  // Determine display name for login page
  const displayTitle = tenantInfo?.business_name || 'QR Loyalty';
  const displaySubtitle = tenantInfo 
    ? `Sign in to ${tenantInfo.business_name}` 
    : 'Sign in to your account';
  // Badge shows first letter of tenant name (or "QR" for default)
  const badgeLabel = tenantInfo?.business_name
    ? tenantInfo.business_name.charAt(0).toUpperCase()
    : 'QR';

  // Password Recovery state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      const data = await login(email, password);
      const role = data?.profile?.role;

      // Navigate with tenant slug if present
      const basePath = slug ? `/v/${slug}` : '';
      
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'vendor_owner') {
        navigate(`${basePath}/owner`);
      } else if (role === 'vendor_staff') {
        navigate(`${basePath}/staff`);
      } else if (role === 'customer') {
        navigate(`${basePath}/customer`);
      } else {
        setError('User role could not be determined.');
      }
    } catch (err) {
      logClientError('Login failed', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setLoading(true);

    try {
      await customerLogin(customerName, customerPhone);
      
      const basePath = slug ? `/v/${slug}` : '';
      
      if (qrCodeFromUrl) {
        await api.post('/customers/register', {
          qr_code: qrCodeFromUrl,
          phone: customerPhone
        });
        navigate(`${basePath}/verify?qr_code=${encodeURIComponent(qrCodeFromUrl)}`);
      } else {
        navigate(`${basePath}/customer`);
      }
    } catch (err) {
      logClientError('Customer login failed', err);
      setError(err.message || 'Customer login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setResetError('');
    setResetMessage('');

    if (!resetEmail.trim()) {
      setResetError('Please enter your email address.');
      return;
    }

    setResetLoading(true);

    try {
      await resetPassword(resetEmail.trim());
      setResetMessage('Password reset link sent to your email. Check your inbox!');
      setResetEmail('');
    } catch (err) {
      logClientError('Password reset failed', err);
      setResetError(err.message || 'Failed to send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>{badgeLabel}</div>
          <h1 style={styles.title}>
            {tenantLoading ? 'Loading...' : displayTitle}
          </h1>
          <p style={styles.subtitle}>{displaySubtitle}</p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => { setLoginTab('business'); setError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: loginTab === 'business' ? '#ffffff' : 'transparent',
                color: loginTab === 'business' ? '#2563eb' : '#6b7280',
                boxShadow: loginTab === 'business' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Business / Staff
            </button>
            <button
              type="button"
              onClick={() => { setLoginTab('customer'); setError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                backgroundColor: loginTab === 'customer' ? '#ffffff' : 'transparent',
                color: loginTab === 'customer' ? '#2563eb' : '#6b7280',
                boxShadow: loginTab === 'customer' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Customer Quick Sign-in
            </button>
          </div>
        </div>

        {error && <div style={styles.errorAlert} role="alert">{error}</div>}

        {loginTab === 'business' ? (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label htmlFor="login-email" style={styles.label}>Email Address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="name@example.com"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <div style={styles.labelRow}>
                <label htmlFor="login-password" style={styles.label}>Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetError('');
                    setResetMessage('');
                    setShowForgotModal(true);
                  }}
                  style={styles.forgotLink}
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
                style={styles.input}
              />
            </div>

            <button type="submit" disabled={loading} style={styles.submitButton}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCustomerSubmit} style={styles.form}>
            <div style={styles.formGroup}>
              <label htmlFor="customer-name" style={styles.label}>Full Name</label>
              <input
                id="customer-name"
                name="customerName"
                type="text"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                required
                placeholder="John Doe"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label htmlFor="customer-phone" style={styles.label}>Phone Number</label>
              <input
                id="customer-phone"
                name="customerPhone"
                type="tel"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                required
                placeholder="+1 234 567 8900"
                style={styles.input}
              />
            </div>

            <button type="submit" disabled={loading} style={styles.submitButton}>
              {loading ? 'Logging in...' : 'Start Earning Rewards'}
            </button>
          </form>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Reset Your Password</h3>
            <p style={styles.modalSubtitle}>
              Enter your email address and we will send you instructions to reset your password.
            </p>

            {resetError && <div style={styles.errorAlert}>{resetError}</div>}
            {resetMessage && <div style={styles.successAlert}>{resetMessage}</div>}

            <form onSubmit={handleResetPassword} style={styles.form}>
              <div style={styles.formGroup}>
                <label htmlFor="reset-email" style={styles.label}>Email Address</label>
                <input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  style={styles.cancelButton}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  style={styles.submitButton}
                >
                  {resetLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f7fb',
    padding: '20px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, sans-serif'
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.06)',
    padding: '36px 32px',
    boxSizing: 'border-box'
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px'
  },
  logoBadge: {
    width: '52px',
    height: '52px',
    borderRadius: '14px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '22px',
    fontWeight: 'bold',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px'
  },
  title: {
    margin: 0,
    fontSize: '26px',
    fontWeight: '700',
    color: '#111827'
  },
  subtitle: {
    margin: '6px 0 0',
    fontSize: '14px',
    color: '#6b7280'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  forgotLink: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    fontWeight: '500'
  },
  input: {
    padding: '12px 14px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
    width: '100%'
  },
  submitButton: {
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%',
    transition: 'background-color 0.2s'
  },
  errorAlert: {
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    fontSize: '14px',
    marginBottom: '16px'
  },
  successAlert: {
    padding: '12px 14px',
    borderRadius: '8px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
    fontSize: '14px',
    marginBottom: '16px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '28px',
    maxWidth: '440px',
    width: '100%',
    boxSizing: 'border-box'
  },
  modalTitle: {
    margin: '0 0 8px',
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827'
  },
  modalSubtitle: {
    margin: '0 0 20px',
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: '1.5'
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '10px'
  },
  cancelButton: {
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    backgroundColor: '#ffffff',
    color: '#374151',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%'
  }
};

export default Login;
