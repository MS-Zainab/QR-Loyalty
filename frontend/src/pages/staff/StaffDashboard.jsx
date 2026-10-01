import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { logClientError } from '../../services/logging';

const StaffDashboard = () => {
  const { session, profile, logout } = useAuth();

  const [pin, setPin] = useState('');
  const [pinExpiresAt, setPinExpiresAt] = useState(null);

  const [activity, setActivity] = useState(null);
  const [verifiedVisits, setVerifiedVisits] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [selectedRewardByVisit, setSelectedRewardByVisit] = useState({});

  const [loading, setLoading] = useState(true);
  const loadedForUser = useRef(null);
  const [loadedForUserId, setLoadedForUserId] = useState(null);
  const [generatingPin, setGeneratingPin] = useState(false);
  const [stampingVisitId, setStampingVisitId] = useState(null);
  const [redeemingVisitId, setRedeemingVisitId] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getConfig = (signal) => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    },
    ...(signal ? { signal } : {})
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

  const loadStaffData = async (signal) => {
    try {
      setLoading(true);
      setError('');

      const config = getConfig(signal);

      const [
        activityResponse,
        visitsResponse,
        rewardsResponse
      ] = await Promise.all([
        api.get('/staff/activity', config),
        api.get(
          '/staff/verified-visits',
          config
        ),
        api.get('/rewards', config)
      ]);

      if (signal?.aborted) return;

      const activityData =
        activityResponse.data?.activity ||
        activityResponse.data ||
        null;
      const activityStatistics =
        activityData?.statistics ||
        activityData ||
        {};

      setActivity({
        ...activityData,
        stamps_issued:
          activityStatistics.total_stamps_issued ??
          activityStatistics.stamps_issued ??
          activityStatistics.stampsIssued ??
          0,
        rewards_redeemed:
          activityStatistics.total_rewards_redeemed ??
          activityStatistics.rewards_redeemed ??
          activityStatistics.rewardsRedeemed ??
          0
      });

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
      setRewards(
        rewardsResponse.data?.rewards || []
      );
    } catch (err) {
      if (signal?.aborted) return;
      logClientError('Failed to load staff dashboard', err);

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to load staff dashboard.'
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const loadStaffDataEffect = useEffectEvent(loadStaffData);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || loadedForUser.current === userId) return;
    loadedForUser.current = userId;
    setPin('');
    setPinExpiresAt(null);
    setActivity(null);
    setVerifiedVisits([]);
    setRewards([]);
    setSelectedRewardByVisit({});
    setLoadedForUserId(userId);
    const controller = new AbortController();
    loadStaffDataEffect(controller.signal);

    return () => {
      controller.abort();
      if (loadedForUser.current === userId) {
        loadedForUser.current = null;
      }
    };
  }, [session?.user?.id]);

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
      logClientError('Failed to generate PIN', err);

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to generate verification PIN.'
      );
    } finally {
      setGeneratingPin(false);
    }
  };

  const issueStamp = async (visit) => {
    if (!visit?.id || !visit?.customer_id) {
      setError('This visit is missing its customer or visit identifier.');
      return;
    }

    try {
      setStampingVisitId(visit.id);
      setError('');
      setSuccess('');

      const response = await api.post(
        '/stamps',
        {
          customer_id: visit.customer_id,
          visit_id: visit.id
        },
        getConfig()
      );

      setVerifiedVisits((currentVisits) =>
        currentVisits.map((currentVisit) => 
          currentVisit.id === visit.id ? { ...currentVisit, has_stamp: true } : currentVisit
        )
      );
      setActivity((currentActivity) => ({
        ...currentActivity,
        stamps_issued:
          Number(currentActivity?.stamps_issued || 0) + 1
      }));
      setSuccess(
        response.data?.message ||
          'Loyalty stamp issued successfully.'
      );
    } catch (err) {
      logClientError('Failed to issue stamp', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to issue loyalty stamp.'
      );
    } finally {
      setStampingVisitId(null);
    }
  };

  const redeemReward = async (visit) => {
    const rewardId = selectedRewardByVisit[visit?.id];

    if (!rewardId) {
      setError('Choose a reward before redeeming it.');
      return;
    }

    try {
      setRedeemingVisitId(visit.id);
      setError('');
      setSuccess('');

      const response = await api.post(
        `/rewards/${rewardId}/redeem`,
        { customer_id: visit.customer_id },
        getConfig()
      );

      setActivity((currentActivity) => ({
        ...currentActivity,
        rewards_redeemed:
          Number(currentActivity?.rewards_redeemed || 0) + 1
      }));
      setSuccess(
        response.data?.message ||
          'Reward redeemed successfully.'
      );
    } catch (err) {
      logClientError('Failed to redeem reward', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to redeem reward.'
      );
    } finally {
      setRedeemingVisitId(null);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      logClientError('Logout failed', err);
    }
  };

  if (loading || loadedForUserId !== session?.user?.id) {
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
                minWidth: '900px'
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
                      Stamps Collected
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

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                    >
                      Action
                    </th>

                    <th
                      style={{
                        textAlign: 'left',
                        padding: '12px',
                        borderBottom: '1px solid #e5e7eb'
                      }}
                    >
                      Redeem Reward
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
                        visit?.visited_at ||
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
                                '1px solid #f1f5f9',
                              fontWeight: '600',
                              textAlign: 'center'
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                backgroundColor: '#eff6ff',
                                color: '#2563eb',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: '700'
                              }}
                            >
                              {visit.total_stamps ?? '-'}
                            </span>
                          </td>

                          <td
                            style={{
                              padding: '12px',
                              borderBottom: '1px solid #f1f5f9'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => issueStamp(visit)}
                              disabled={
                                visit.has_stamp ||
                                stampingVisitId === visit.id ||
                                !visit.id ||
                                !visit.customer_id
                              }
                              style={{
                                padding: '8px 12px',
                                border: 'none',
                                borderRadius: '6px',
                                backgroundColor:
                                  (visit.has_stamp || stampingVisitId === visit.id)
                                    ? '#9ca3af'
                                    : '#2563eb',
                                color: '#ffffff',
                                cursor:
                                  (visit.has_stamp || stampingVisitId === visit.id)
                                    ? 'not-allowed'
                                    : 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              {visit.has_stamp 
                                ? 'Stamp Issued' 
                                : stampingVisitId === visit.id
                                ? 'Issuing...'
                                : 'Issue Stamp'}
                            </button>
                          </td>

                          <td
                            style={{
                              padding: '12px',
                              borderBottom: '1px solid #f1f5f9'
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <select
                                aria-label={`Choose reward for ${getDisplayValue(customerName, 'customer')}`}
                                value={selectedRewardByVisit[visit.id] || ''}
                                onChange={(event) =>
                                  setSelectedRewardByVisit((current) => ({
                                    ...current,
                                    [visit.id]: event.target.value
                                  }))
                                }
                                disabled={rewards.length === 0}
                              >
                                <option value="">
                                  Choose reward
                                </option>
                                {rewards.map((reward) => (
                                  <option key={reward.id} value={reward.id}>
                                    {reward.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => redeemReward(visit)}
                                disabled={
                                  !selectedRewardByVisit[visit.id] ||
                                  redeemingVisitId === visit.id
                                }
                              >
                                {redeemingVisitId === visit.id
                                  ? 'Redeeming...'
                                  : 'Redeem'}
                              </button>
                            </div>
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
