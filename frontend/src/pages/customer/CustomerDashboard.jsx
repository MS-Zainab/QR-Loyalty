
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { logClientError } from '../../services/logging';
import { theme } from '../../theme';
import DigitalLoyaltyCard from '../../components/DigitalLoyaltyCard';
import './CustomerDashboard.css';

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const { session, profile, logout } = useAuth();

  const [customer, setCustomer] = useState(null);
  const [stamps, setStamps] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [activePrograms, setActivePrograms] = useState([]);
  const [expiredPrograms, setExpiredPrograms] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedForUser = useRef(null);
  const [loadedForUserId, setLoadedForUserId] = useState(null);

  const getConfig = (signal) => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    },
    ...(signal ? { signal } : {})
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

  const formatExpiryDate = (dateValue) => {
    if (!dateValue) return 'No expiration date';
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const renderBlockProgress = (current, total) => {
    const safeTotal = Math.max(1, Math.min(30, total));
    const safeCurrent = Math.max(0, Math.min(safeTotal, current));
    const filled = '█'.repeat(safeCurrent);
    const empty = '░'.repeat(safeTotal - safeCurrent);
    return filled + empty;
  };

  const loadCustomerData = async (signal) => {
    try {
      setLoading(true);
      setError('');

      const config = getConfig(signal);

      const [
        stampsResponse,
        redemptionsResponse,
        rewardsResponse,
        meResponse
      ] = await Promise.all([
        api.get('/customers/me/stamps', config),
        api.get('/customers/me/redemptions', config),
        api.get('/customers/me/rewards', config),
        api.get('/customers/me', config).catch(() => ({ data: {} }))
      ]);

      if (signal?.aborted) return;

      const progressData = rewardsResponse.data?.progress || {};

      const stampHistory = stampsResponse.data?.stamp_history;
      const stampData = Array.isArray(stampHistory)
        ? stampHistory.flatMap((group) =>
            (group?.stamps || []).map((stamp) => ({
              ...stamp,
              customer_id: group.customer_id,
              customer_name: group.customer_name,
              tenant_id: group.tenant_id
            }))
          )
        : stampsResponse.data?.stamps ||
          stampsResponse.data?.data ||
          stampsResponse.data ||
          [];
      const normalizedStamps = Array.isArray(stampData)
        ? stampData.sort((a, b) =>
            new Date(b?.created_at || 0) -
            new Date(a?.created_at || 0)
          )
        : [];

      const redemptionHistory = redemptionsResponse.data?.redemption_history;
      const redemptionData = Array.isArray(redemptionHistory)
        ? redemptionHistory.flatMap((group) =>
            (group?.redemptions || []).map((redemption) => ({
              ...redemption,
              customer_id: group.customer_id,
              customer_name: group.customer_name,
              tenant_id: group.tenant_id
            }))
          )
        : redemptionsResponse.data?.redemptions ||
          redemptionsResponse.data?.data ||
          redemptionsResponse.data ||
          [];
      const normalizedRedemptions = Array.isArray(redemptionData)
        ? redemptionData.sort((a, b) =>
            new Date(b?.redeemed_at || b?.created_at || 0) -
            new Date(a?.redeemed_at || a?.created_at || 0)
          )
        : [];

      setCustomer({
        current_stamps: progressData.current_progress ?? 0,
        stamp_target: progressData.stamps_required ?? 10,
        rewards_redeemed: normalizedRedemptions.length
      });
      setStamps(normalizedStamps);
      setRedemptions(normalizedRedemptions);

      const rewardData =
        rewardsResponse.data?.rewards ||
        rewardsResponse.data?.data ||
        rewardsResponse.data ||
        [];

      setRewards(Array.isArray(rewardData) ? rewardData : []);

      // Active and Expired Programs parsing — no fabricated fallback: if the
      // API returns none, the dashboard renders its real empty state.
      const activeProgs =
        rewardsResponse.data?.active_programs ||
        meResponse.data?.memberships?.flatMap((m) => m.active_programs || []) ||
        [];

      const expiredProgs =
        rewardsResponse.data?.expired_programs ||
        meResponse.data?.memberships?.flatMap((m) => m.expired_programs || []) ||
        [];

      setActivePrograms(activeProgs);
      setExpiredPrograms(expiredProgs);
    } catch (err) {
      if (signal?.aborted) return;
      logClientError('Failed to load customer dashboard', err);

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to load customer dashboard.'
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const loadCustomerDataEffect = useEffectEvent(loadCustomerData);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    // Always reload data when component mounts to ensure fresh state after visit verification
    setCustomer(null);
    setStamps([]);
    setRedemptions([]);
    setRewards([]);
    setActivePrograms([]);
    setExpiredPrograms([]);
    setLoadedForUserId(userId);
    const controller = new AbortController();
    loadCustomerDataEffect(controller.signal);

    return () => {
      controller.abort();
    };
  }, [session?.user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      logClientError('Logout failed', err);
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

  if (loading || loadedForUserId !== session?.user?.id) {
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
      className="customer-dashboard"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f7fb',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Responsive styles */}
      <style>{`
        @media (max-width: 768px) {
          .responsive-container {
            padding: 20px !important;
          }
          .responsive-card {
            padding: 16px !important;
          }
          .responsive-header {
            font-size: 24px !important;
          }
          .responsive-stat-value {
            font-size: 24px !important;
          }
          .responsive-flex {
            flex-direction: column !important;
          }
          .responsive-table-wrapper {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .responsive-code {
            font-size: 12px !important;
            word-break: break-all !important;
          }
          .responsive-button {
            width: 100% !important;
            margin-top: 8px !important;
          }
        }

        @media (max-width: 480px) {
          .responsive-container {
            padding: 12px !important;
          }
          .responsive-card {
            padding: 12px !important;
          }
          .responsive-header {
            font-size: 20px !important;
          }
        }
      `}</style>
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
        className="responsive-container"
        style={{
          padding: '30px',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box'
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

        {/* Active Loyalty Programs */}
        <section
          style={{
            backgroundColor: '#ffffff',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            marginBottom: '24px'
          }}
        >
          <h2
            style={{
              marginTop: 0,
              fontSize: '22px',
              color: '#111827'
            }}
          >
            Active Loyalty Programs
          </h2>

          {activePrograms.length > 0 ? (
            <>
              {/* Primary Digital Loyalty Card - Show first program prominently */}
              {(() => {
                const primaryProgram = activePrograms[0];
                const current = Number(primaryProgram.current_stamps ?? primaryProgram.current_progress ?? 0);
                const required = Number(primaryProgram.stamps_required ?? 10);
                const isUnlocked = current >= required;
                
                // Get business name from first stamp or profile
                const businessName = stamps[0]?.business_name || 
                                   stamps[0]?.tenant?.business_name || 
                                   stamps[0]?.tenant?.name ||
                                   profile?.full_name || 
                                   'Your Business';

                return (
                  <div style={{ marginBottom: '32px' }}>
                    <DigitalLoyaltyCard
                      businessName={businessName}
                      programName={primaryProgram.name || 'Loyalty Program'}
                      requiredStamps={required}
                      currentStamps={current}
                      rewardDescription={primaryProgram.reward_description || primaryProgram.reward_title || primaryProgram.name}
                      isUnlocked={isUnlocked}
                      isRedeemed={false}
                    />
                  </div>
                );
              })()}

              {/* Additional Programs List (if more than one) */}
              {activePrograms.length > 1 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '20px',
                    marginTop: '16px'
                  }}
                >
                  {activePrograms.slice(1).map((program, idx) => {
                    const current = Number(program.current_stamps ?? program.current_progress ?? 0);
                    const required = Number(program.stamps_required ?? 10);
                    const remaining = Math.max(0, required - current);
                    const isUnlocked = current >= required;
                    const progressPct = Math.min(100, Math.round((current / required) * 100));

                    return (
                      <div
                        key={program.id || `active-prog-${idx}`}
                        style={{
                          padding: '22px',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', fontWeight: '700' }}>
                            {program.name || 'Loyalty Offer'}
                          </h3>
                          <span style={{ fontSize: '13px', fontWeight: '700', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px' }}>
                            {current} / {required} visits
                          </span>
                        </div>

                        {/* Visual block progress */}
                        <div style={{ fontFamily: 'monospace', fontSize: '17px', letterSpacing: '2px', color: '#2563eb', margin: '14px 0 10px', wordBreak: 'break-all' }}>
                          {renderBlockProgress(current, required)}
                        </div>

                        {/* Progress Bar */}
                        <div style={{ width: '100%', height: '10px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden', marginBottom: '14px' }}>
                          <div style={{ width: `${progressPct}%`, height: '100%', backgroundColor: isUnlocked ? '#16a34a' : '#2563eb', borderRadius: '999px', transition: 'width 0.3s ease' }} />
                        </div>

                        {/* Remaining Visits / Unlock status */}
                        <div style={{ fontWeight: '700', fontSize: '15px', color: isUnlocked ? '#166534' : '#1e293b', marginBottom: '16px' }}>
                          {isUnlocked
                            ? 'Reward Unlocked 🎉'
                            : remaining === 1
                            ? '1 more visit to unlock'
                            : `${remaining} more visits to unlock`}
                        </div>

                        {/* Reward & Expiry */}
                        <div style={{ paddingTop: '14px', borderTop: '1px dashed #e2e8f0', fontSize: '14px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div>
                            <strong>Reward:</strong> {program.reward_title || program.reward_description || program.name}
                          </div>
                          {program.reward_description && program.reward_description !== program.reward_title && (
                            <div style={{ fontSize: '13px', color: '#64748b' }}>
                              {program.reward_description}
                            </div>
                          )}
                          <div style={{ fontSize: '13px', color: '#64748b' }}>
                            <strong>Valid until:</strong> {formatExpiryDate(program.end_date)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: '#6b7280' }}>No active loyalty programs available at this time.</p>
          )}
        </section>

        {/* Expired Loyalty Programs */}
        {expiredPrograms.length > 0 && (
          <section
            style={{
              backgroundColor: '#ffffff',
              padding: '24px',
              borderRadius: '12px',
              border: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}
          >
            <h2
              style={{
                marginTop: 0,
                fontSize: '18px',
                color: '#6b7280'
              }}
            >
              Expired Loyalty Programs
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
                marginTop: '14px'
              }}
            >
              {expiredPrograms.map((program, idx) => (
                <div
                  key={program.id || `expired-prog-${idx}`}
                  style={{
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #f3f4f6',
                    backgroundColor: '#f9fafb',
                    color: '#6b7280'
                  }}
                >
                  <h4 style={{ margin: '0 0 6px', color: '#374151', fontSize: '15px' }}>
                    {program.name}
                  </h4>
                  <p style={{ margin: '0 0 4px', fontSize: '13px' }}>
                    Final Progress: {program.current_stamps} / {program.stamps_required} visits
                  </p>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                    Expired: {formatExpiryDate(program.end_date)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

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
