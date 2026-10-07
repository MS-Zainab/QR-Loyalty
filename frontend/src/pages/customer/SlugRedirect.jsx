import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';

/**
 * SlugRedirect — public page mounted at /v/:slug
 *
 * Resolves a tenant branded slug to its active QR code and immediately
 * redirects the user to /v/:slug/verify?qr_code=<code>.
 *
 * No authentication is required because GET /api/tenants/slug/:slug is public.
 */
const SlugRedirect = () => {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [businessName, setBusinessName] = useState('');

  useEffect(() => {
    let cancelled = false;

    const qrCodeFromUrl = searchParams.get('qr_code');

    const redirectTo = (qrCode) => {
      setTimeout(() => {
        if (!cancelled) {
          navigate(
            `/v/${encodeURIComponent(slug)}/verify?qr_code=${encodeURIComponent(qrCode)}`,
            { replace: true }
          );
        }
      }, 600);
    };

    const resolve = async () => {
      try {
        // QR codes encode /v/:slug?qr_code=<code>; reuse it when present.
        if (qrCodeFromUrl) {
          redirectTo(qrCodeFromUrl);
          return;
        }

        const response = await api.get(`/tenants/slug/${encodeURIComponent(slug)}`);
        if (cancelled) return;

        const { qr_code, business_name } = response.data;
        setBusinessName(business_name || '');
        redirectTo(qr_code);
      } catch (err) {
        if (cancelled) return;
        const msg =
          err?.response?.data?.message ||
          'Business not found or link is no longer active.';
        setError(msg);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [slug, navigate, searchParams]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fb',
        fontFamily: 'Arial, sans-serif',
        padding: '30px'
      }}
    >
      {error ? (
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center'
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔗</div>
          <h2 style={{ margin: '0 0 10px', color: '#111827' }}>Link Not Found</h2>
          <p style={{ color: '#6b7280', margin: '0 0 24px', lineHeight: 1.6 }}>{error}</p>
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            style={{
              padding: '11px 24px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '15px'
            }}
          >
            Go to Login
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px'
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 6px' }}>
            {businessName ? `Redirecting to ${businessName}…` : 'Loading business…'}
          </p>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
            You will be taken to the visit verification page shortly.
          </p>
        </div>
      )}
    </div>
  );
};

export default SlugRedirect;
