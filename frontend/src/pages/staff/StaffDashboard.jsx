import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const StaffDashboard = () => {
  const { session, profile, logout } = useAuth();

  const [pin, setPin] = useState('');
  const [pinExpiresAt, setPinExpiresAt] = useState(null);

  const [activity, setActivity] = useState(null);
  const [verifiedVisits, setVerifiedVisits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [generatingPin, setGeneratingPin] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });

  const getDisplayValue = (value, fallback = '-') => {
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
        value?.full_name ||
        value?.name ||
        value?.business_name ||
        value?.email ||
        fallback
      );
    }

    return fallback;
  };

  const formatDate = (dateValue) => {
    if (!dateValue) {
      return '-';
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleString();
  };

  const getActivityValue = (
    keys,
    fallback = 0
  ) => {
    if (!activity) {
      return fallback;
    }

    for (const key of keys) {
      if (
        activity[key] !== undefined &&
        activity[key] !== null
      ) {
        const value = activity[key];

        if (
          typeof value === 'object'
        ) {
          return fallback;
        }

        return value;
      }
    }

    return fallback;
  };

  const loadStaffData = async () => {
    try {
      setLoading(true);
      setError('');

      const config = getConfig();

      const [
        activityResponse,
        visitsResponse
      ] = await Promise.all([
        api.get('/staff/activity', config),
        api.get(
          '/staff/verified-visits',
          config
        )
      ]);

      setActivity(
        activityResponse.data || null
      );

      const visitsData =
        visitsResponse.data?.visits ||
        visitsResponse.data?.data ||
        visitsResponse.data ||
        [];

      setVerifiedVisits(
        Array.isArray(visitsData)
          ? visitsData
          : []
      );
    } catch (err) {
      console.error(
        'Failed to load staff dashboard:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to load staff dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      loadStaffData();
    }
  }, [session]);

  const generatePin = async () => {
    try {
      setGeneratingPin(true);
      setError('');
      setSuccess('');

      const response = await api.post(
        '/verification/generate',
        {},
        getConfig()
      );

      console.log(
        'Verification PIN response:',
        response.data
      );

      const findPin = (data) => {
        if (!data) {
          return '';
        }

        if (typeof data === 'string') {
          const trimmed = data.trim();

          if (/^\d{6}$/.test(trimmed)) {
            return trimmed;
          }

          return '';
        }

        if (typeof data !== 'object') {
          return '';
        }

        const pinKeys = [
          'pin',
          'verification_pin',
          'verificationPin',
          'code',
          'verification_code',
          'verificationCode'
        ];

        for (const key of pinKeys) {
          const value = data[key];

          if (
            value !== undefined &&
            value !== null
          ) {
            const stringValue =
              String(value);

            if (
              /^\d{6}$/.test(
                stringValue
              )
            ) {
              return stringValue;
            }
          }
        }

        for (const value of Object.values(
          data
        )) {
          const nestedPin =
            findPin(value);

          if (nestedPin) {
            return nestedPin;
          }
        }

        return '';
      };

      const findExpiry = (data) => {
        if (!data) {
          return null;
        }

        if (
          typeof data !== 'object'
        ) {
          return null;
        }

        const expiryKeys = [
          'expires_at',
          'expiresAt',
          'expires',
          'expiry'
        ];

        for (const key of expiryKeys) {
          if (
            data[key] !== undefined &&
            data[key] !== null
          ) {
            return data[key];
          }
        }

        for (const value of Object.values(
          data
        )) {
          const nestedExpiry =
            findExpiry(value);

          if (nestedExpiry) {
            return nestedExpiry;
          }
        }

        return null;
      };

      const generatedPin = findPin(
        response.data
      );

      const expiresAt = findExpiry(
        response.data
      );

      if (!generatedPin) {
        console.error(
          'PIN was not found in response:',
          response.data
        );

        setError(
          'PIN was generated, but its value was not found in the server response.'
        );

        return;
      }

      setPin(generatedPin);
      setPinExpiresAt(expiresAt);

      setSuccess(
        'Verification PIN generated successfully. It is valid for 60 seconds.'
      );
    } catch (err) {
      console.error(
        'Failed to generate PIN:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to generate verification PIN.'
      );
    } finally {
      setGeneratingPin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error(
        'Logout failed:',
        err
      );
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '40px',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <h1>Staff Dashboard</h1>
        <p>Loading dashboard...</p>
      </div>
    );
  }

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
          gap: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '28px'
            }}
          >
            Staff Dashboard
          </h1>

          <p
            style={{
              margin: '6px 0 0',
              color: '#6b7280'
            }}
          >
            Welcome,{' '}
            {getDisplayValue(
              profile?.full_name ||
                profile?.name,
              'Staff'
            )}
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: '10px 18px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Logout
        </button>
      </header>

      <main
        style={{
          padding: '30px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}
      >
        {error && (
          <div
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              border:
                '1px solid #fecaca'
            }}
          >
            {getDisplayValue(
              error,
              'An error occurred.'
            )}
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: '#dcfce7',
              color: '#166534',
              border:
                '1px solid #bbf7d0'
            }}
          >
            {getDisplayValue(
              success,
              'Success.'
            )}
          </div>
        )}

        <section
          style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '12px',
            border:
              '1px solid #e5e7eb',
            marginBottom: '24px'
          }}
        >
          <h2
            style={{
              marginTop: 0
            }}
          >
            Customer Verification PIN
          </h2>

          <p
            style={{
              color: '#6b7280'
            }}
          >
            Generate a temporary 6-digit
            PIN for customer visit
            verification. The PIN remains
            valid for 60 seconds.
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              flexWrap: 'wrap',
              marginTop: '20px'
            }}
          >
            <div
              style={{
                minWidth: '220px',
                padding: '20px',
                borderRadius: '10px',
                backgroundColor: '#f3f4f6',
                textAlign: 'center'
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  marginBottom: '8px'
                }}
              >
                Current PIN
              </div>

              <div
                style={{
                  fontSize: '34px',
                  fontWeight: '700',
                  letterSpacing: '6px'
                }}
              >
                {pin || '------'}
              </div>
            </div>

            <div>
              <button
                onClick={generatePin}
                disabled={generatingPin}
                style={{
                  padding:
                    '12px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor:
                    generatingPin
                      ? '#9ca3af'
                      : '#2563eb',
                  color: '#ffffff',
                  cursor: generatingPin
                    ? 'not-allowed'
                    : 'pointer',
                  fontWeight: '600'
                }}
              >
                {generatingPin
                  ? 'Generating...'
                  : 'Generate PIN'}
              </button>

              {pinExpiresAt && (
                <p
                  style={{
                    marginTop: '10px',
                    color: '#6b7280',
                    fontSize: '14px'
                  }}
                >
                  Expires:{' '}
                  {formatDate(
                    pinExpiresAt
                  )}
                </p>
              )}
            </div>
          </div>
        </section>

        <section>
          <h2>Staff Activity</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '18px',
              marginTop: '18px'
            }}
          >
            <div
              style={{
                backgroundColor:
                  '#ffffff',
                padding: '20px',
                borderRadius: '12px',
                border:
                  '1px solid #e5e7eb'
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#6b7280'
                }}
              >
                Stamps Issued
              </p>

              <h3
                style={{
                  margin:
                    '10px 0 0',
                  fontSize: '30px'
                }}
              >
                {String(
                  getActivityValue([
                    'stamps_issued',
                    'stampsIssued'
                  ])
                )}
              </h3>
            </div>

            <div
              style={{
                backgroundColor:
                  '#ffffff',
                padding: '20px',
                borderRadius: '12px',
                border:
                  '1px solid #e5e7eb'
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#6b7280'
                }}
              >
                Rewards Redeemed
              </p>

              <h3
                style={{
                  margin:
                    '10px 0 0',
                  fontSize: '30px'
                }}
              >
                {String(
                  getActivityValue([
                    'rewards_redeemed',
                    'rewardsRedeemed'
                  ])
                )}
              </h3>
            </div>

            <div
              style={{
                backgroundColor:
                  '#ffffff',
                padding: '20px',
                borderRadius: '12px',
                border:
                  '1px solid #e5e7eb'
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#6b7280'
                }}
              >
                Verified Visits
              </p>

              <h3
                style={{
                  margin:
                    '10px 0 0',
                  fontSize: '30px'
                }}
              >
                {String(
                  verifiedVisits.length
                )}
              </h3>
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: '30px',
            backgroundColor:
              '#ffffff',
            padding: '24px',
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
            Verified Visits
          </h2>

          {verifiedVisits.length >
          0 ? (
            <div
              style={{
                overflowX: 'auto'
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse:
                    'collapse',
                  minWidth: '650px'
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign:
                          'left',
                        padding:
                          '12px',
                        borderBottom:
                          '1px solid #e5e7eb'
                      }}
                    >
                      Customer
                    </th>

                    <th
                      style={{
                        textAlign:
                          'left',
                        padding:
                          '12px',
                        borderBottom:
                          '1px solid #e5e7eb'
                      }}
                    >
                      Verified At
                    </th>

                    <th
                      style={{
                        textAlign:
                          'left',
                        padding:
                          '12px',
                        borderBottom:
                          '1px solid #e5e7eb'
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {verifiedVisits.map(
                    (
                      visit,
                      index
                    ) => {
                      const customer =
                        visit?.customer;

                      const customerName =
                        visit?.customer_name ||
                        visit?.customerName ||
                        customer?.full_name ||
                        customer?.name ||
                        visit?.customer_email ||
                        visit?.customerEmail ||
                        'Customer';

                      const verifiedAt =
                        visit?.verified_at ||
                        visit?.verifiedAt ||
                        visit?.created_at ||
                        visit?.createdAt ||
                        null;

                      const status =
                        visit?.status ||
                        'verified';

                      return (
                        <tr
                          key={
                            visit?.id ||
                            `visit-${index}`
                          }
                        >
                          <td
                            style={{
                              padding:
                                '12px',
                              borderBottom:
                                '1px solid #f1f5f9'
                            }}
                          >
                            {getDisplayValue(
                              customerName,
                              'Customer'
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '12px',
                              borderBottom:
                                '1px solid #f1f5f9'
                            }}
                          >
                            {formatDate(
                              verifiedAt
                            )}
                          </td>

                          <td
                            style={{
                              padding:
                                '12px',
                              borderBottom:
                                '1px solid #f1f5f9'
                            }}
                          >
                            {getDisplayValue(
                              status,
                              'verified'
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p
              style={{
                color: '#6b7280'
              }}
            >
              No verified visits yet.
            </p>
          )}
        </section>

        <div
          style={{
            marginTop: '24px',
            textAlign: 'right'
          }}
        >
          <button
            onClick={loadStaffData}
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
            Refresh Dashboard
          </button>
        </div>
      </main>
    </div>
  );
};

export default StaffDashboard;