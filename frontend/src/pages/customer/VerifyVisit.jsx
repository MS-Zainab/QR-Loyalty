
import { useState } from 'react';
import {
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const VerifyVisit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();

  const qrCode = searchParams.get('qr_code') || '';

  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });

  const getDisplayValue = (
    value,
    fallback = ''
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return fallback;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number'
    ) {
      return String(value);
    }

    if (typeof value === 'object') {
      return (
        value?.message ||
        value?.error ||
        value?.name ||
        value?.business_name ||
        fallback
      );
    }

    return fallback;
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!qrCode) {
      setError(
        'Business QR code is missing. Please scan the business QR code again.'
      );
      return;
    }

    if (!pin.trim()) {
      setError(
        'Please enter the 6-digit staff PIN.'
      );
      return;
    }

    if (!/^\d{6}$/.test(pin.trim())) {
      setError(
        'Staff PIN must be exactly 6 digits.'
      );
      return;
    }

    try {
      setVerifying(true);

      const response = await api.post(
        '/verification/verify',
        {
          qr_code: qrCode,
          pin: pin.trim()
        },
        getConfig()
      );

      const message =
        response.data?.message ||
        'Visit verified successfully.';

      setSuccess(
        getDisplayValue(
          message,
          'Visit verified successfully.'
        )
      );

      setPin('');

      setTimeout(() => {
        navigate('/customer');
      }, 1200);
    } catch (err) {
      console.error(
        'Visit verification failed:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Visit verification failed. Please check the QR code and PIN.'
      );
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f7fb',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom:
            '1px solid #e5e7eb',
          padding: '20px 30px',
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems: 'center',
          gap: '15px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '26px'
            }}
          >
            Verify Visit
          </h1>

          <p
            style={{
              margin: '6px 0 0',
              color: '#6b7280'
            }}
          >
            Verify your visit and receive
            your loyalty stamp.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate('/customer')
          }
          style={{
            padding: '10px 18px',
            border:
              '1px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor:
              '#ffffff',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Back to Dashboard
        </button>
      </header>

      <main
        style={{
          maxWidth: '650px',
          margin: '0 auto',
          padding: '30px'
        }}
      >
        <section
          style={{
            backgroundColor: '#ffffff',
            padding: '28px',
            borderRadius: '12px',
            border:
              '1px solid #e5e7eb'
          }}
        >
          <h2
            style={{
              marginTop: 0
            }}
          >
            Verify Your Visit
          </h2>

          <p
            style={{
              color: '#6b7280',
              lineHeight: 1.6
            }}
          >
            The business has a fixed QR
            code. Your staff member will
            provide you with a temporary
            6-digit verification PIN.
          </p>

          {!qrCode && (
            <div
              style={{
                marginTop: '20px',
                padding: '14px',
                backgroundColor:
                  '#fee2e2',
                color: '#991b1b',
                border:
                  '1px solid #fecaca',
                borderRadius: '8px'
              }}
            >
              Business QR code is missing.
              Please scan the business QR
              code again.
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: '20px',
                padding: '14px',
                backgroundColor:
                  '#fee2e2',
                color: '#991b1b',
                border:
                  '1px solid #fecaca',
                borderRadius: '8px'
              }}
            >
              {getDisplayValue(
                error,
                'Verification failed.'
              )}
            </div>
          )}

          {success && (
            <div
              style={{
                marginTop: '20px',
                padding: '14px',
                backgroundColor:
                  '#dcfce7',
                color: '#166534',
                border:
                  '1px solid #bbf7d0',
                borderRadius: '8px'
              }}
            >
              {getDisplayValue(
                success,
                'Visit verified successfully.'
              )}
            </div>
          )}

          <form
            onSubmit={handleVerify}
            style={{
              marginTop: '24px'
            }}
          >
            <label
              htmlFor="staff-pin"
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '600'
              }}
            >
              Staff Verification PIN
            </label>

            <input
              id="staff-pin"
              type="text"
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
              value={pin}
              onChange={(event) => {
                const value =
                  event.target.value.replace(
                    /\D/g,
                    ''
                  );

                setPin(value.slice(0, 6));
                setError('');
                setSuccess('');
              }}
              placeholder="Enter 6-digit PIN"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '13px 14px',
                border:
                  '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '18px',
                letterSpacing: '4px',
                textAlign: 'center'
              }}
            />

            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                marginTop: '8px'
              }}
            >
              Ask the shop staff for the
              current 6-digit PIN. It is
              valid for 60 seconds.
            </p>

            <button
              type="submit"
              disabled={
                verifying ||
                !qrCode
              }
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '13px 20px',
                border: 'none',
                borderRadius: '8px',
                backgroundColor:
                  verifying ||
                  !qrCode
                    ? '#9ca3af'
                    : '#2563eb',
                color: '#ffffff',
                cursor:
                  verifying ||
                  !qrCode
                    ? 'not-allowed'
                    : 'pointer',
                fontWeight: '600',
                fontSize: '16px'
              }}
            >
              {verifying
                ? 'Verifying...'
                : 'Verify Visit'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default VerifyVisit;

