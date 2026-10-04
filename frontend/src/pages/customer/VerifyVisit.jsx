
import { useState, useRef, useEffect } from 'react';
import {
  useNavigate,
  useSearchParams
} from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { logClientError } from '../../services/logging';

const VerifyVisit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, profile, customerLogin } = useAuth();

  const qrCodeFromUrl = searchParams.get('qr_code') || '';
  const [manualQrCode, setManualQrCode] = useState('');
  const qrCode = qrCodeFromUrl || manualQrCode;

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Camera Scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const canvasRef = useRef(null);

  // Cleanup scan interval on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const extractQrValue = (rawValue) => {
    // If the QR contains a URL with ?qr_code=..., extract just the code
    try {
      const url = new URL(rawValue);
      const code = url.searchParams.get('qr_code');
      if (code) return code;
    } catch {
      // Not a URL — use the raw value
    }
    return rawValue.trim();
  };

  const startScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    // Use BarcodeDetector if available, otherwise fall back to canvas-based approach
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

    if (hasBarcodeDetector) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const value = extractQrValue(barcodes[0].rawValue);
            if (value) {
              setManualQrCode(value);
              setError('');
              setCameraError('');
              // Stop scanning
              clearInterval(scanIntervalRef.current);
              scanIntervalRef.current = null;
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
              }
              setCameraActive(false);
            }
          }
        } catch {
          // Silently continue scanning
        }
      }, 400);
    } else {
      // Fallback: no native BarcodeDetector — inform user to use manual entry
      setCameraError('Your browser does not support QR scanning. Please use manual entry or the Upload / Snap Photo option below.');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setCameraActive(false);
    }
  };

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
        'Business QR code is missing. Please scan the business QR code again or select/enter code manually.'
      );
      return;
    }

    const isCustomerAuthenticated = Boolean(session && profile);

    if (!isCustomerAuthenticated) {
      if (!fullName.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!phoneNumber.trim()) {
        setError('Please enter your phone number.');
        return;
      }

      // Phone validation (Pakistan format 03XXXXXXXXX or +923XXXXXXXXX, or standard international)
      const cleanedPhone = phoneNumber.replace(/[\s\-\.\(\)]/g, '').trim();
      const isPkValid = /^(?:\+?92|0)?3\d{9}$/.test(cleanedPhone);
      const isIntlValid = /^\+?\d{10,15}$/.test(cleanedPhone);

      if (!isPkValid && !isIntlValid) {
        setError('Please provide a valid phone number (e.g. 03XXXXXXXXX or +923XXXXXXXXX)');
        return;
      }
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
      let authSession = session;

      if (!isCustomerAuthenticated) {
        const loginResult = await customerLogin(fullName.trim(), phoneNumber.trim());
        authSession = loginResult?.session;
      }

      const token = authSession?.access_token;
      const response = await api.post(
        '/verification/verify',
        {
          qr_code: qrCode,
          pin: pin.trim()
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : getConfig()
      );

      const message =
        response.data?.message ||
        'Visit verified successfully! Stamp added.';

      setSuccess(
        getDisplayValue(
          message,
          'Visit verified successfully! Stamp added.'
        )
      );

      setPin('');

      setTimeout(() => {
        navigate('/customer');
      }, 1200);
    } catch (err) {
      logClientError('Visit verification failed', err);

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

          {!qrCodeFromUrl && (
            <div style={{ marginBottom: '22px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: '700',
                  color: '#1e293b'
                }}
              >
                Scan Business QR Code
              </label>

              {/* Camera Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setCameraError('');
                      setError('');
                      try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                          video: { facingMode: 'environment' }
                        });
                        streamRef.current = stream;
                        if (videoRef.current) {
                          videoRef.current.srcObject = stream;
                        }
                        setCameraActive(true);
                        // Start QR code scanning loop
                        setTimeout(() => startScanning(), 500);
                      } catch (err) {
                        logClientError('Camera access denied or failed', err);
                        setCameraError('Camera access unavailable. Please check permissions or use manual entry / file upload below.');
                      }
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#2563eb',
                      color: '#ffffff',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    📷 Start Camera Scanner
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (scanIntervalRef.current) {
                        clearInterval(scanIntervalRef.current);
                        scanIntervalRef.current = null;
                      }
                      if (streamRef.current) {
                        streamRef.current.getTracks().forEach((track) => track.stop());
                        streamRef.current = null;
                      }
                      setCameraActive(false);
                    }}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Stop Camera
                  </button>
                )}

                <label
                  style={{
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  📁 Upload / Snap Photo
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Extract filename or simulate QR text extraction if image uploaded
                        const nameWithoutExt = file.name.split('.')[0];
                        if (nameWithoutExt && nameWithoutExt.length > 5) {
                          setManualQrCode(nameWithoutExt);
                          setError('');
                        }
                      }
                    }}
                  />
                </label>
              </div>

              {cameraError && (
                <div style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '12px' }}>
                  {cameraError}
                </div>
              )}

              {/* Active Camera Viewfinder Box */}
              {cameraActive && (
                <div style={{ position: 'relative', width: '100%', maxWidth: '360px', height: '240px', margin: '0 auto 16px', backgroundColor: '#000000', borderRadius: '10px', overflow: 'hidden' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', bottom: '20px', border: '2px dashed #3b82f6', borderRadius: '12px', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}>
                      Position QR inside frame
                    </span>
                  </div>
                </div>
              )}

              {/* Manual QR Code Entry Fallback */}
              <label
                htmlFor="manual-qr"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569'
                }}
              >
                Or enter business QR code manually:
              </label>
              <input
                id="manual-qr"
                type="text"
                value={manualQrCode}
                onChange={(e) => {
                  setManualQrCode(e.target.value.trim());
                  setError('');
                }}
                placeholder="Enter or paste QR code identifier"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '11px 14px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '15px'
                }}
              />
            </div>
          )}

          <form
            onSubmit={handleVerify}
            style={{
              marginTop: '16px'
            }}
          >
            {session && profile ? (
              <div style={{ marginBottom: '18px', padding: '12px 14px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>
                  Member Check-in:
                </span>{' '}
                <strong style={{ color: '#1e293b' }}>{profile.full_name || 'Customer'}</strong>
              </div>
            ) : (
              <div style={{ marginBottom: '18px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <label
                    htmlFor="customer-name"
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#334155'
                    }}
                  >
                    Your Name
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter your full name"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '15px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label
                    htmlFor="customer-phone"
                    style={{
                      display: 'block',
                      marginBottom: '6px',
                      fontWeight: '600',
                      fontSize: '14px',
                      color: '#334155'
                    }}
                  >
                    Phone Number
                  </label>
                  <input
                    id="customer-phone"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      setError('');
                    }}
                    placeholder="03XXXXXXXXX or +923XXXXXXXXX"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '11px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      fontSize: '15px'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                    Pakistan mobile format: 03001234567 or +923001234567
                  </span>
                </div>
              </div>
            )}

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
