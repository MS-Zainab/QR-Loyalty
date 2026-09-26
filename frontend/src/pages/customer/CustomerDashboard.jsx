
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const CustomerDashboard = () => {
  const { session, profile, logout } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [stamps, setStamps] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [rewards, setRewards] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });

  const getDisplayValue = (
    value,
    fallback = '-'
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
        value?.full_name ||
        value?.name ||
        value?.business_name ||
        value?.title ||
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

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      setError('');

      const config = getConfig();

      const [
        customerResponse,
        stampsResponse,
        redemptionsResponse,
        rewardsResponse
      ] = await Promise.all([
        api.get('/customers/me', config),
        api.get('/customers/me/stamps', config),
        api.get(
          '/customers/me/redemptions',
          config
        ),
        api.get('/customers/me/rewards', config)
      ]);

      setCustomer(
        customerResponse.data || null
      );

      const stampData =
        stampsResponse.data?.stamps ||
        stampsResponse.data?.data ||
        stampsResponse.data ||
        [];

      setStamps(
        Array.isArray(stampData)
          ? stampData
          : []
      );

      const redemptionData =
        redemptionsResponse.data
          ?.redemptions ||
        redemptionsResponse.data?.data ||
        redemptionsResponse.data ||
        [];

      setRedemptions(
        Array.isArray(redemptionData)
          ? redemptionData
          : []
      );

      const rewardData =
        rewardsResponse.data?.rewards ||
        rewardsResponse.data?.data ||
        rewardsResponse.data ||
        [];

      setRewards(
        Array.isArray(rewardData)
          ? rewardData
          : []
      );
    } catch (err) {
      console.error(
        'Failed to load customer dashboard:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to load customer dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      loadCustomerData();
    }
  }, [session]);

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

  const getCustomerValue = (
    keys,
    fallback = 0
  ) => {
    if (!customer) {
      return fallback;
    }

    for (const key of keys) {
      if (
        customer[key] !== undefined &&
        customer[key] !== null
      ) {
        const value = customer[key];

        if (
          typeof value === 'object'
        ) {
          continue;
        }

        return value;
      }
    }

    return fallback;
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '40px',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        <h1>Customer Dashboard</h1>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const currentStamps = Number(
    getCustomerValue(
      [
        'current_stamps',
        'currentStamps',
        'stamps_collected',
        'stampsCollected',
        'stamp_count',
        'stampCount'
      ],
      0
    )
  );

  const stampTarget = Number(
    getCustomerValue(
      [
        'stamp_target',
        'stampTarget',
        'required_stamps',
        'requiredStamps',
        'loyalty_threshold',
        'loyaltyThreshold'
      ],
      10
    )
  );

  const remainingStamps = Math.max(
    stampTarget - currentStamps,
    0
  );

  const rewardsRedeemed = Number(
    getCustomerValue(
      [
        'rewards_redeemed',
        'rewardsRedeemed',
        'total_redemptions',
        'totalRedemptions'
      ],
      redemptions.length
    )
  );

  const progress = Math.min(
    Math.round(
      (currentStamps / stampTarget) *
        100
    ),
    100
  );

  const recentStamps = stamps.slice(
    0,
    5
  );

  const recentRedemptions =
    redemptions.slice(0, 5);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f7fb',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Header */}
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
            Customer Dashboard
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
              'Customer'
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
        {/* Error */}
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

        {/* Verify Visit */}
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
            Visit the Business
          </h2>

          <p
            style={{
              color: '#6b7280',
              lineHeight: 1.6
            }}
          >
            Scan the business QR code and
            enter the current 6-digit PIN
            provided by the staff to verify
            your visit.
          </p>

          <button
            onClick={() =>
              (window.location.href =
                '/customer/verify')
            }
            style={{
              padding: '12px 20px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor:
                '#2563eb',
              color: '#ffffff',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Verify Visit
          </button>
        </section>

        {/* Loyalty Card */}
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
            My Loyalty Card
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '18px',
              marginTop: '20px'
            }}
          >
            <div
              style={{
                padding: '20px',
                borderRadius: '10px',
                backgroundColor:
                  '#f8fafc'
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#6b7280'
                }}
              >
                Stamps Collected
              </p>

              <h3
                style={{
                  margin:
                    '10px 0 0',
                  fontSize: '30px'
                }}
              >
                {currentStamps} /{' '}
                {stampTarget}
              </h3>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '10px',
                backgroundColor:
                  '#f8fafc'
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#6b7280'
                }}
              >
                Remaining
              </p>

              <h3
                style={{
                  margin:
                    '10px 0 0',
                  fontSize: '30px'
                }}
              >
                {remainingStamps}
              </h3>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '10px',
                backgroundColor:
                  '#f8fafc'
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
                {rewardsRedeemed}
              </h3>
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '10px',
                backgroundColor:
                  '#f8fafc'
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: '#6b7280'
                }}
              >
                Progress
              </p>

              <h3
                style={{
                  margin:
                    '10px 0 0',
                  fontSize: '30px'
                }}
              >
                {progress}%
              </h3>
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              marginTop: '24px'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                marginBottom: '8px',
                fontSize: '14px'
              }}
            >
              <span>
                Loyalty Progress
              </span>

              <span>
                {progress}%
              </span>
            </div>

            <div
              style={{
                width: '100%',
                height: '12px',
                backgroundColor:
                  '#e5e7eb',
                borderRadius: '999px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  backgroundColor:
                    '#2563eb',
                  borderRadius:
                    '999px',
                  transition:
                    'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </section>

        {/* Available Rewards */}
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
            Available Rewards
          </h2>

          {rewards.length > 0 ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '18px',
                marginTop: '18px'
              }}
            >
              {rewards.map(
                (reward, index) => {
                  const title =
                    reward?.name ||
                    reward?.title ||
                    reward?.reward_name ||
                    'Reward';

                  const description =
                    reward?.description ||
                    '';

                  const requiredStamps =
                    reward?.required_stamps ??
                    reward?.requiredStamps ??
                    reward?.stamp_threshold ??
                    reward?.stampThreshold ??
                    stampTarget;

                  return (
                    <div
                      key={
                        reward?.id ||
                        `reward-${index}`
                      }
                      style={{
                        padding: '20px',
                        borderRadius:
                          '10px',
                        border:
                          '1px solid #e5e7eb',
                        backgroundColor:
                          '#ffffff'
                      }}
                    >
                      <h3
                        style={{
                          marginTop: 0
                        }}
                      >
                        {getDisplayValue(
                          title,
                          'Reward'
                        )}
                      </h3>

                      {description && (
                        <p
                          style={{
                            color:
                              '#6b7280',
                            lineHeight:
                              1.5
                          }}
                        >
                          {getDisplayValue(
                            description,
                            ''
                          )}
                        </p>
                      )}

                      <p
                        style={{
                          fontSize:
                            '14px',
                          fontWeight:
                            '600'
                        }}
                      >
                        Requires{' '}
                        {getDisplayValue(
                          requiredStamps,
                          stampTarget
                        )}{' '}
                        stamps
                      </p>

                      <p
                        style={{
                          marginBottom: 0,
                          color:
                            currentStamps >=
                            Number(
                              requiredStamps
                            )
                              ? '#166534'
                              : '#6b7280'
                        }}
                      >
                        {currentStamps >=
                        Number(
                          requiredStamps
                        )
                          ? 'Available to redeem'
                          : `${Math.max(
                              Number(
                                requiredStamps
                              ) -
                                currentStamps,
                              0
                            )} more stamp(s) needed`}
                      </p>
                    </div>
                  );
                }
              )}
            </div>
          ) : (
            <p
              style={{
                color: '#6b7280'
              }}
            >
              No rewards available yet.
            </p>
          )}
        </section>

        {/* Recent Stamp History */}
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
            Recent Stamp History
          </h2>

          {recentStamps.length > 0 ? (
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
                  minWidth: '600px'
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
                      Business
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
                      Date
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
                  {recentStamps.map(
                    (
                      stamp,
                      index
                    ) => {
                      const tenant =
                        stamp?.tenant;

                      const businessName =
                        stamp?.business_name ||
                        stamp?.businessName ||
                        tenant?.business_name ||
                        tenant?.name ||
                        'Business';

                      const stampDate =
                        stamp?.created_at ||
                        stamp?.createdAt ||
                        stamp?.issued_at ||
                        stamp?.issuedAt;

                      const status =
                        stamp?.status ||
                        'issued';

                      return (
                        <tr
                          key={
                            stamp?.id ||
                            `stamp-${index}`
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
                              businessName,
                              'Business'
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
                              stampDate
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
                              'issued'
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
              No stamp history yet.
            </p>
          )}
        </section>

        {/* Redemption History */}
        <section
          style={{
            backgroundColor: '#ffffff',
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
            Redemption History
          </h2>

          {recentRedemptions.length >
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
                  minWidth: '600px'
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
                      Reward
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
                      Date
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
                  {recentRedemptions.map(
                    (
                      redemption,
                      index
                    ) => {
                      const reward =
                        redemption?.reward;

                      const rewardName =
                        redemption?.reward_name ||
                        redemption?.rewardName ||
                        reward?.name ||
                        reward?.title ||
                        'Reward';

                      const redemptionDate =
                        redemption?.created_at ||
                        redemption?.createdAt ||
                        redemption?.redeemed_at ||
                        redemption?.redeemedAt;

                      const status =
                        redemption?.status ||
                        'redeemed';

                      return (
                        <tr
                          key={
                            redemption?.id ||
                            `redemption-${index}`
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
                              rewardName,
                              'Reward'
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
                              redemptionDate
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
                              'redeemed'
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
              No redemption history yet.
            </p>
          )}
        </section>

        {/* Refresh */}
        <div
          style={{
            marginTop: '24px',
            textAlign: 'right'
          }}
        >
          <button
            onClick={loadCustomerData}
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

export default CustomerDashboard;

