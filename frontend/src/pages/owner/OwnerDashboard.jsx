
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import QRCode from 'qrcode';
import { logClientError } from '../../services/logging';

const OwnerDashboard = () => {
  const { session, profile, logout } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [qr, setQr] = useState(null);
  const [qrImage, setQrImage] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadedForUser = useRef(null);
  const [loadedForUserId, setLoadedForUserId] = useState(null);

  const [activeSection, setActiveSection] =
    useState('overview');

  // Staff Onboarding & Credentials Management state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingSuccess, setOnboardingSuccess] = useState('');

  // Staff Password Reset state
  const [resetMember, setResetMember] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);

  // Loyalty Program management state
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyNameInput, setLoyaltyNameInput] = useState('');
  const [loyaltyStampsInput, setLoyaltyStampsInput] = useState(10);
  const [loyaltyRewardInput, setLoyaltyRewardInput] = useState('');
  const [loyaltySaving, setLoyaltySaving] = useState(false);

  // Subscription state
  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subSuccess, setSubSuccess] = useState('');
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const getConfig = (signal) => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    },
    ...(signal ? { signal } : {})
  });

  const loadDashboard = async (signal) => {
    const response = await api.get(
      '/owner/dashboard',
      getConfig(signal)
    );

    if (signal?.aborted) return;

    const dashboardData =
      response.data?.dashboard ?? response.data;

    setDashboard({
      ...dashboardData,
      stats:
        dashboardData?.statistics ??
        dashboardData?.stats,
      staff_activity:
        dashboardData?.staff_activity?.map(
          (activity) => ({
            ...activity,
            name:
              activity.staff_name ??
              activity.name
          })
        ) ?? []
    });
  };

  const loadStaff = async (signal) => {
    const response = await api.get(
      '/owner/staff',
      getConfig(signal)
    );

    if (signal?.aborted) return;

    setStaff(
      response.data?.staff ||
        response.data ||
        []
    );
  };

  const loadLoyalty = async (signal) => {
    const response = await api.get(
      '/loyalty',
      getConfig(signal)
    );

    if (signal?.aborted) return;

    const data = response.data;
    const programData =
      data?.program ||
      data?.loyalty ||
      data?.loyalty_program ||
      (data && typeof data === 'object' && data.id ? data : null);

    setLoyalty(programData);
  };

  const loadRewards = async (signal) => {
    const response = await api.get(
      '/rewards',
      getConfig(signal)
    );

    if (signal?.aborted) return;

    setRewards(
      response.data?.rewards ||
        response.data ||
        []
    );
  };

  const loadSubscription = async (signal) => {
    try {
      setSubLoading(true);
      const response = await api.get('/owner/subscription', getConfig(signal));
      if (signal?.aborted) return;
      setSubscription(response.data?.subscription || null);
    } catch (err) {
      logClientError('Load subscription failed', err);
    } finally {
      if (!signal?.aborted) setSubLoading(false);
    }
  };

  const handleOpenCheckout = (planKey, planName, price) => {
    setError('');
    setSubSuccess('');
    setSelectedPlanForCheckout({ planKey, planName, price });
    setShowCheckoutModal(true);
  };

  const handleConfirmCheckout = async () => {
    if (!selectedPlanForCheckout) return;
    try {
      setSubLoading(true);
      setError('');
      setSubSuccess('');
      const response = await api.post('/owner/subscription/upgrade', {
        plan_type: selectedPlanForCheckout.planKey,
        billing_cycle: 'monthly'
      }, getConfig());
      setSubSuccess(response.data?.message || `Successfully subscribed to ${selectedPlanForCheckout.planName}!`);
      setShowCheckoutModal(false);
      setSelectedPlanForCheckout(null);
      await loadSubscription();
    } catch (err) {
      logClientError('Upgrade plan failed', err);
      setError(err?.response?.data?.message || 'Failed to update subscription plan.');
    } finally {
      setSubLoading(false);
    }
  };

  const loadQr = async (signal) => {
    try {
      let response = await api.get(
        '/qr',
        getConfig(signal)
      );

      if (signal?.aborted) return;

      let qrRecord =
        response.data?.qr_code ||
        response.data?.qr ||
        null;

      // Requirement 7: If QR code does not exist, safely create/associate one
      if (!qrRecord) {
        const createRes = await api.post(
          '/qr',
          {},
          getConfig(signal)
        );
        if (!signal?.aborted) {
          qrRecord = createRes.data?.qr_code || createRes.data?.qr || null;
        }
      }

      setQr(qrRecord);

      if (qrRecord?.code) {
        const verificationUrl =
          `${window.location.origin}/customer/verify?qr_code=${encodeURIComponent(
            qrRecord.code
          )}`;

        QRCode.toDataURL(verificationUrl, {
          width: 320,
          margin: 2
        }).then((image) => {
          if (!signal?.aborted) setQrImage(image);
        }).catch((err) => {
          if (signal?.aborted) return;
          logClientError('QR image generation failed', err);
        });
      } else {
        setQrImage('');
      }
    } catch (err) {
      if (signal?.aborted) return;
      logClientError('Load or generate QR failed', err);
    }
  };

  const loadAllData = async (signal) => {
    if (!session?.access_token) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const detailsRequest = Promise.all([
        loadStaff(signal),
        loadLoyalty(signal),
        loadRewards(signal),
        loadQr(signal),
        loadSubscription(signal)
      ]).catch((err) => {
        if (signal?.aborted) return;
        logClientError('Owner dashboard details failed', err);

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            'Some owner dashboard details could not be loaded.'
        );
      });

      // The overview and supporting sections read independent tenant data.
      // Start every request together, then let the overview end its loading state
      // without waiting for slower supporting sections.
      await loadDashboard(signal);
      void detailsRequest;
    } catch (err) {
      if (signal?.aborted) return;
      logClientError('Owner dashboard failed', err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to load owner dashboard.'
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const loadAllDataEffect = useEffectEvent(loadAllData);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || loadedForUser.current === userId) return;
    loadedForUser.current = userId;
    setDashboard(null);
    setStaff([]);
    setLoyalty(null);
    setRewards([]);
    setQr(null);
    setQrImage('');
    setLoadedForUserId(userId);
    const controller = new AbortController();
    loadAllDataEffect(controller.signal);

    return () => {
      controller.abort();
      if (loadedForUser.current === userId) {
        loadedForUser.current = null;
      }
    };
  }, [session?.user?.id]);

  const changeStaffStatus = async (
    staffMember
  ) => {
    try {
      setError('');

      const newStatus =
        staffMember.status === 'active'
          ? 'inactive'
          : 'active';

      await api.patch(
        `/owner/staff/${staffMember.id}/status`,
        {
          status: newStatus
        },
        getConfig()
      );

      await Promise.all([
        loadStaff(),
        loadDashboard()
      ]);
    } catch (err) {
      logClientError('Staff status update failed', err);

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to update staff status.'
      );
    }
  };

  const handleOnboardStaff = async (event) => {
    event.preventDefault();
    setError('');
    setOnboardingSuccess('');

    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword) {
      setError('Full name, email, and password are required.');
      return;
    }

    if (newStaffPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setOnboardingLoading(true);
      const tenantId = dashboard?.tenant?.id || profile?.tenant_id;

      if (!tenantId) {
        setError('Tenant ID not found.');
        return;
      }

      await api.post(
        `/tenants/${tenantId}/staff`,
        {
          full_name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          password: newStaffPassword
        },
        getConfig()
      );

      setOnboardingSuccess(`Staff member "${newStaffName}" onboarded successfully!`);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setShowAddStaffModal(false);

      await Promise.all([
        loadStaff(),
        loadDashboard()
      ]);
    } catch (err) {
      logClientError('Staff onboarding failed', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to onboard staff member.'
      );
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleUpdateStaffPassword = async (event) => {
    event.preventDefault();
    setError('');
    setOnboardingSuccess('');

    if (!resetMember?.staff_id && !resetMember?.id) {
      setError('No staff member selected for password reset.');
      return;
    }

    if (!resetPasswordValue || resetPasswordValue.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    try {
      setResetPasswordLoading(true);
      const targetStaffId = resetMember.staff_id || resetMember.id;

      await api.patch(
        `/owner/staff/${targetStaffId}/password`,
        { password: resetPasswordValue },
        getConfig()
      );

      setOnboardingSuccess(`Password updated successfully for ${resetMember.staff_name || resetMember.name || 'staff member'}.`);
      setResetMember(null);
      setResetPasswordValue('');
    } catch (err) {
      logClientError('Staff password update failed', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to update staff password.'
      );
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleSaveLoyalty = async (event) => {
    event.preventDefault();
    setError('');
    setOnboardingSuccess('');

    if (!loyaltyNameInput.trim()) {
      setError('Loyalty program name is required.');
      return;
    }

    const requiredStamps = Number(loyaltyStampsInput);
    if (!Number.isInteger(requiredStamps) || requiredStamps < 1) {
      setError('Required stamps must be a positive number.');
      return;
    }

    try {
      setLoyaltySaving(true);

      if (loyalty?.id) {
        await api.patch(
          `/loyalty/${loyalty.id}`,
          {
            name: loyaltyNameInput.trim(),
            stamps_required: requiredStamps,
            reward_description: loyaltyRewardInput.trim()
          },
          getConfig()
        );
      } else {
        await api.post(
          '/loyalty',
          {
            name: loyaltyNameInput.trim(),
            stamps_required: requiredStamps
          },
          getConfig()
        );
      }

      setOnboardingSuccess('Loyalty program saved successfully!');
      setShowLoyaltyModal(false);
      await Promise.all([loadLoyalty(), loadDashboard()]);
    } catch (err) {
      logClientError('Save loyalty program failed', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to save loyalty program.'
      );
    } finally {
      setLoyaltySaving(false);
    }
  };

  const handleToggleLoyaltyStatus = async () => {
    if (!loyalty?.id) return;
    setError('');
    setOnboardingSuccess('');

    try {
      const nextStatus = !loyalty.is_active;

      await api.patch(
        `/loyalty/${loyalty.id}`,
        { is_active: nextStatus },
        getConfig()
      );

      setOnboardingSuccess(
        `Loyalty program ${nextStatus ? 'activated' : 'deactivated'} successfully.`
      );
      await Promise.all([loadLoyalty(), loadDashboard()]);
    } catch (err) {
      logClientError('Toggle loyalty status failed', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to update loyalty program status.'
      );
    }
  };

  const formatDate = (date) => {
    if (!date) {
      return '-';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return String(date);
    }

    return parsedDate.toLocaleString();
  };

  const getQrUrl = () => {
    if (!qr?.code) {
      return '';
    }

    return (
      `${window.location.origin}` +
      `/customer/verify?qr_code=` +
      encodeURIComponent(qr.code)
    );
  };

  if (loading || loadedForUserId !== session?.user?.id) {
    return (
      <div style={styles.page}>
        <div style={styles.centerMessage}>
          <p>
            Loading owner dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>
            Owner Dashboard
          </h1>

          <p style={styles.subtitle}>
            {dashboard?.tenant?.business_name ||
              dashboard?.tenant?.name ||
              profile?.business_name ||
              'Your Business'}
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          style={styles.logoutButton}
        >
          Logout
        </button>
      </header>

      {/* Error */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* Navigation */}
      <nav style={styles.nav}>
        <button
          type="button"
          onClick={() =>
            setActiveSection('overview')
          }
          style={
            activeSection === 'overview'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection('loyalty')
          }
          style={
            activeSection === 'loyalty'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          Loyalty Program
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection('staff')
          }
          style={
            activeSection === 'staff'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          Staff
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection('rewards')
          }
          style={
            activeSection === 'rewards'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          Rewards
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection('qr')
          }
          style={
            activeSection === 'qr'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          QR Code
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection('analytics')
          }
          style={
            activeSection === 'analytics'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          Customer Analytics
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection('reports')
          }
          style={
            activeSection === 'reports'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          Reports
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection('subscription')
          }
          style={
            activeSection === 'subscription'
              ? styles.navButtonActive
              : styles.navButton
          }
        >
          Subscription & Plan
        </button>
      </nav>

      {/* Overview */}
      {activeSection === 'overview' && (
        <section>
          <div style={styles.grid}>
            <StatCard
              title="Active Customers"
              value={
                dashboard?.active_customers ??
                dashboard?.stats
                  ?.active_customers ??
                0
              }
            />

            <StatCard
              title="Total Stamps"
              value={
                dashboard?.total_stamps ??
                dashboard?.stats
                  ?.total_stamps ??
                0
              }
            />

            <StatCard
              title="Total Rewards"
              value={
                dashboard?.total_rewards ??
                dashboard?.stats
                  ?.total_rewards ??
                0
              }
            />

            <StatCard
              title="Active Rewards"
              value={
                dashboard?.active_rewards ??
                dashboard?.stats
                  ?.active_rewards ??
                0
              }
            />

            <StatCard
              title="Total Redemptions"
              value={
                dashboard?.total_redemptions ??
                dashboard?.stats
                  ?.total_redemptions ??
                0
              }
            />

            <StatCard
              title="Active Staff"
              value={
                dashboard?.active_staff ??
                dashboard?.stats
                  ?.active_staff ??
                0
              }
            />
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Business Information
            </h2>

            <div style={styles.infoGrid}>
              <InfoItem
                label="Business"
                value={
                  dashboard?.tenant
                    ?.business_name ||
                  dashboard?.tenant?.name ||
                  '-'
                }
              />

              <InfoItem
                label="Status"
                value={
                  dashboard?.tenant?.status ||
                  '-'
                }
              />

              <InfoItem
                label="Owner"
                value={
                  profile?.full_name ||
                  profile?.email ||
                  '-'
                }
              />
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>
              Staff Activity
            </h2>

            {dashboard?.staff_activity
              ?.length > 0 ? (
              <div
                style={
                  styles.tableWrapper
                }
              >
                <table
                  style={styles.table}
                >
                  <thead>
                    <tr>
                      <th style={styles.th}>
                        Staff
                      </th>

                      <th style={styles.th}>
                        Stamps Issued
                      </th>

                      <th style={styles.th}>
                        Rewards Redeemed
                      </th>

                      <th style={styles.th}>
                        Last Activity
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {dashboard.staff_activity.map(
                      (item) => (
                        <tr
                          key={
                            item.staff_id ||
                            item.id
                          }
                        >
                          <td
                            style={
                              styles.td
                            }
                          >
                            {item.name ||
                              item.email ||
                              '-'}
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            {item.stamps_issued ??
                              0}
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            {item.rewards_redeemed ??
                              0}
                          </td>

                          <td
                            style={
                              styles.td
                            }
                          >
                            {formatDate(
                              item.last_activity
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={styles.empty}>
                No staff activity available.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Loyalty */}
      {activeSection === 'loyalty' && (
        <section style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <h2 style={styles.sectionTitle}>
              Loyalty Program
            </h2>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setOnboardingSuccess('');
                  setLoyaltyNameInput(loyalty?.name || '');
                  setLoyaltyStampsInput(loyalty?.stamps_required ?? 10);
                  setLoyaltyRewardInput(loyalty?.reward_description || '');
                  setShowLoyaltyModal(true);
                }}
                style={styles.primaryButton}
              >
                {loyalty ? 'Edit Loyalty Program' : '+ Create Loyalty Program'}
              </button>

              {loyalty && (
                <button
                  type="button"
                  onClick={handleToggleLoyaltyStatus}
                  style={loyalty.is_active !== false ? styles.deactivateButton : styles.primaryButton}
                >
                  {loyalty.is_active !== false ? 'Deactivate Program' : 'Activate Program'}
                </button>
              )}
            </div>
          </div>

          {loyalty ? (
            <div>
              <div style={styles.infoGrid}>
                <InfoItem
                  label="Program Name"
                  value={
                    loyalty.name ||
                    loyalty.program_name ||
                    '-'
                  }
                />

                <InfoItem
                  label="Required Stamps"
                  value={
                    loyalty.stamps_required ??
                    loyalty.required_stamps ??
                    0
                  }
                />

                <InfoItem
                  label="Reward"
                  value={
                    loyalty.reward_description ||
                    loyalty.reward ||
                    '-'
                  }
                />

                <InfoItem
                  label="Status"
                  value={
                    <span style={loyalty.is_active !== false ? styles.activeBadge : styles.inactiveBadge}>
                      {loyalty.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  }
                />
              </div>
            </div>
          ) : (
            <p style={styles.empty}>
              No loyalty program found. Click "+ Create Loyalty Program" to configure your customer rewards rules.
            </p>
          )}

          {/* Loyalty Program Create/Edit Modal */}
          {showLoyaltyModal && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <h3 style={styles.modalTitle}>{loyalty ? 'Edit Loyalty Program' : 'Create Loyalty Program'}</h3>
                <p style={styles.modalSubtitle}>Configure your stamp target and reward rules for customers.</p>

                <form onSubmit={handleSaveLoyalty} style={styles.form}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Program Name</label>
                    <input
                      type="text"
                      value={loyaltyNameInput}
                      onChange={(e) => setLoyaltyNameInput(e.target.value)}
                      placeholder="e.g. Coffee Loyalty Rewards"
                      required
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Required Stamps</label>
                    <input
                      type="number"
                      min="1"
                      value={loyaltyStampsInput}
                      onChange={(e) => setLoyaltyStampsInput(e.target.value)}
                      placeholder="e.g. 10"
                      required
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Reward Description</label>
                    <input
                      type="text"
                      value={loyaltyRewardInput}
                      onChange={(e) => setLoyaltyRewardInput(e.target.value)}
                      placeholder="e.g. Free Coffee of Any Size"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.modalActions}>
                    <button
                      type="button"
                      onClick={() => setShowLoyaltyModal(false)}
                      style={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loyaltySaving}
                      style={styles.primaryButton}
                    >
                      {loyaltySaving ? 'Saving...' : 'Save Loyalty Program'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Staff */}
      {activeSection === 'staff' && (
        <section style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <h2 style={styles.sectionTitle}>
              Staff Management
            </h2>
            <button
              type="button"
              onClick={() => {
                setError('');
                setOnboardingSuccess('');
                setShowAddStaffModal(true);
              }}
              style={styles.primaryButton}
            >
              + Onboard Staff
            </button>
          </div>

          {onboardingSuccess && (
            <div style={styles.success}>
              {onboardingSuccess}
            </div>
          )}

          {staff.length > 0 ? (
            <div
              style={
                styles.tableWrapper
              }
            >
              <table
                style={styles.table}
              >
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Name
                    </th>

                    <th style={styles.th}>
                      Email
                    </th>

                    <th style={styles.th}>
                      Status
                    </th>

                    <th style={styles.th}>
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {staff.map(
                    (member) => (
                      <tr
                        key={
                          member.id || member.staff_id
                        }
                      >
                        <td
                          style={
                            styles.td
                          }
                        >
                          {member.full_name ||
                            member.staff_name ||
                            member.name ||
                            '-'}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {member.email ||
                            '-'}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <span style={member.status === 'active' ? styles.activeBadge : styles.inactiveBadge}>
                            {member.status || '-'}
                          </span>
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <div style={styles.actionRow}>
                            <button
                              type="button"
                              onClick={() =>
                                changeStaffStatus(
                                  member
                                )
                              }
                              style={
                                member.status === 'active'
                                  ? styles.deactivateButton
                                  : styles.actionButton
                              }
                            >
                              {member.status ===
                              'active'
                                ? 'Deactivate'
                                : 'Activate'}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setError('');
                                setResetPasswordValue('');
                                setResetMember(member);
                              }}
                              style={styles.secondaryButton}
                            >
                              Reset Password
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={styles.empty}>
              No staff members found. Click "+ Onboard Staff" to add your first staff member.
            </p>
          )}

          {/* Onboard Staff Modal */}
          {showAddStaffModal && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <h3 style={styles.modalTitle}>Onboard New Staff Member</h3>
                <p style={styles.modalSubtitle}>Create credentials and user profile for a staff member.</p>

                <form onSubmit={handleOnboardStaff} style={styles.form}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Full Name</label>
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      required
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email Address</label>
                    <input
                      type="email"
                      value={newStaffEmail}
                      onChange={(e) => setNewStaffEmail(e.target.value)}
                      placeholder="staff@yourbusiness.com"
                      required
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Initial Password</label>
                    <input
                      type="password"
                      value={newStaffPassword}
                      onChange={(e) => setNewStaffPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.modalActions}>
                    <button
                      type="button"
                      onClick={() => setShowAddStaffModal(false)}
                      style={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={onboardingLoading}
                      style={styles.primaryButton}
                    >
                      {onboardingLoading ? 'Onboarding...' : 'Create Staff Member'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Reset Staff Password Modal */}
          {resetMember && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <h3 style={styles.modalTitle}>Update Staff Password</h3>
                <p style={styles.modalSubtitle}>
                  Set a new password for <strong>{resetMember.full_name || resetMember.staff_name || resetMember.email}</strong>.
                </p>

                <form onSubmit={handleUpdateStaffPassword} style={styles.form}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>New Password</label>
                    <input
                      type="password"
                      value={resetPasswordValue}
                      onChange={(e) => setResetPasswordValue(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                      required
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.modalActions}>
                    <button
                      type="button"
                      onClick={() => setResetMember(null)}
                      style={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetPasswordLoading}
                      style={styles.primaryButton}
                    >
                      {resetPasswordLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Rewards */}
      {activeSection === 'rewards' && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Rewards
          </h2>

          {rewards.length > 0 ? (
            <div
              style={
                styles.tableWrapper
              }
            >
              <table
                style={styles.table}
              >
                <thead>
                  <tr>
                    <th style={styles.th}>
                      Reward
                    </th>

                    <th style={styles.th}>
                      Description
                    </th>

                    <th style={styles.th}>
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rewards.map(
                    (reward) => (
                      <tr
                        key={
                          reward.id
                        }
                      >
                        <td
                          style={
                            styles.td
                          }
                        >
                          {reward.name ||
                            reward.title ||
                            '-'}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {reward.description ||
                            '-'}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          {reward.is_active ===
                          false
                            ? 'Inactive'
                            : 'Active'}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={styles.empty}>
              No rewards found.
            </p>
          )}
        </section>
      )}

      {/* QR */}
      {activeSection === 'qr' && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Business QR Code
          </h2>

          {qr?.code ? (
            <div style={styles.qrSection}>
              {qrImage ? (
                <img
                  src={qrImage}
                  alt="Business QR Code"
                  style={styles.qrImage}
                />
              ) : (
                <p>
                  Generating QR code...
                </p>
              )}

              <p
                style={styles.qrText}
              >
                This is your permanent
                business QR code. Customers
                scan this QR code to start
                the verification process.
              </p>

              <div
                style={
                  styles.qrInfoBox
                }
              >
                <strong>
                  QR Code Identifier
                </strong>

                <p
                  style={
                    styles.qrCodeText
                  }
                >
                  {qr.code}
                </p>
              </div>

              <div
                style={
                  styles.qrInfoBox
                }
              >
                <strong>
                  Customer Verification URL
                </strong>

                <p
                  style={
                    styles.qrUrlText
                  }
                >
                  {getQrUrl()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!qrImage) {
                    return;
                  }

                  const link =
                    document.createElement(
                      'a'
                    );

                  link.href = qrImage;
                  link.download =
                    'business-qr-code.png';
                  link.click();
                }}
                style={
                  styles.downloadButton
                }
              >
                Download QR Code
              </button>
            </div>
          ) : (
            <p style={styles.empty}>
              No active QR code found.
            </p>
          )}
        </section>
      )}

      {/* Customer Analytics */}
      {activeSection === 'analytics' && (
        <section>
          <div style={styles.grid}>
            <StatCard
              title="Active Customers"
              value={dashboard?.active_customers ?? 0}
            />
            <StatCard
              title="Total Stamps Issued"
              value={dashboard?.total_stamps ?? 0}
            />
            <StatCard
              title="Rewards Redeemed"
              value={dashboard?.total_redemptions ?? 0}
            />
            <StatCard
              title="Active Staff Members"
              value={dashboard?.active_staff ?? 0}
            />
          </div>

          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Top & Repeat Customer Activity</h2>
            {dashboard?.staff_activity?.length > 0 ? (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Staff / Activity Node</th>
                      <th style={styles.th}>Stamps Issued</th>
                      <th style={styles.th}>Redemptions Processed</th>
                      <th style={styles.th}>Last Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.staff_activity.map((item) => (
                      <tr key={item.staff_id || item.id}>
                        <td style={styles.td}>{item.name || item.email || '-'}</td>
                        <td style={styles.td}>{item.stamps_issued ?? 0}</td>
                        <td style={styles.td}>{item.rewards_redeemed ?? 0}</td>
                        <td style={styles.td}>{formatDate(item.last_activity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={styles.empty}>No activity records recorded yet.</p>
            )}
          </div>
        </section>
      )}

      {/* Reports */}
      {activeSection === 'reports' && (
        <section style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <div>
              <h2 style={styles.sectionTitle}>Business Summary & Reports</h2>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                Monthly customer loyalty metrics for {dashboard?.tenant?.business_name || profile?.business_name || 'your business'}.
              </p>
            </div>
            <div style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '8px 14px', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '13px', fontWeight: '600' }}>
              ℹ️ Official Monthly Reports (CSV/PDF) are managed & issued by Platform Admin
            </div>
          </div>

          <div style={styles.infoGrid}>
            <InfoItem label="Business Name" value={dashboard?.tenant?.business_name || '-'} />
            <InfoItem label="Active Memberships" value={dashboard?.active_customers ?? 0} />
            <InfoItem label="Lifetime Stamps Issued" value={dashboard?.total_stamps ?? 0} />
            <InfoItem label="Total Rewards Redeemed" value={dashboard?.total_redemptions ?? 0} />
            <InfoItem label="Current Active Rewards" value={dashboard?.active_rewards ?? 0} />
            <InfoItem label="Active Counter Staff" value={dashboard?.active_staff ?? 0} />
          </div>
        </section>
      )}

      {/* Subscription & Plan */}
      {activeSection === 'subscription' && (
        <section style={styles.card}>
          <div style={styles.sectionHeaderRow}>
            <div>
              <h2 style={styles.sectionTitle}>Subscription & Plan Management</h2>
              <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                Manage your membership package, check trial status, and upgrade your plan.
              </p>
            </div>
          </div>

          {subSuccess && (
            <div style={{ padding: '12px 16px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '8px', marginBottom: '16px', fontWeight: '600' }}>
              {subSuccess}
            </div>
          )}

          {/* Current Subscription Card */}
          <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', tracking: '0.05em', color: '#64748b' }}>Current Plan</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>
                  {(subscription?.plan_type || 'TRIAL').toUpperCase()} PLAN
                </h3>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <span style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  backgroundColor: subscription?.status === 'active' ? '#dcfce7' : '#fee2e2',
                  color: subscription?.status === 'active' ? '#15803d' : '#b91c1c'
                }}>
                  ● {(subscription?.status || 'Active').toUpperCase()}
                </span>
                <span style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700',
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1'
                }}>
                  ⏳ {subscription?.days_left ?? 14} Days Remaining
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #cbd5e1' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Billing Cycle</div>
                <div style={{ fontWeight: '600', color: '#1e293b' }}>{(subscription?.billing_cycle || 'monthly').toUpperCase()}</div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Amount Paid</div>
                <div style={{ fontWeight: '600', color: '#1e293b' }}>${subscription?.amount_paid || 0}.00</div>
              </div>
              <div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Period End / Renewal Date</div>
                <div style={{ fontWeight: '600', color: '#1e293b' }}>{formatDate(subscription?.current_period_end || subscription?.trial_ends_at)}</div>
              </div>
            </div>
          </div>

          {/* Plan Options */}
          <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Available Plans & Packages</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {/* Basic Plan */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: subscription?.plan_type === 'basic' ? '2px solid #2563eb' : '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Basic Plan</h4>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>$19 <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>/ month</span></div>
              <ul style={{ paddingLeft: '18px', margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                <li>Up to 2 Counter Staff</li>
                <li>1 Active Loyalty Program</li>
                <li>Basic Customer Analytics</li>
              </ul>
              <button
                type="button"
                disabled={subLoading || subscription?.plan_type === 'basic'}
                onClick={() => handleOpenCheckout('basic', 'Basic Plan', 19)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: subscription?.plan_type === 'basic' ? '#cbd5e1' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: subscription?.plan_type === 'basic' ? 'default' : 'pointer'
                }}
              >
                {subscription?.plan_type === 'basic' ? 'Current Plan' : 'Select Basic'}
              </button>
            </div>

            {/* Pro Plan */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: subscription?.plan_type === 'pro' ? '2px solid #2563eb' : '2px solid #3b82f6', padding: '20px', boxShadow: '0 4px 12px rgba(37,99,235,0.08)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-12px', right: '16px', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>POPULAR</div>
              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Pro Plan</h4>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>$49 <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>/ month</span></div>
              <ul style={{ paddingLeft: '18px', margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                <li>Unlimited Counter Staff</li>
                <li>Multiple Loyalty Programs</li>
                <li>Full Customer Analytics</li>
                <li>Priority Support</li>
              </ul>
              <button
                type="button"
                disabled={subLoading || subscription?.plan_type === 'pro'}
                onClick={() => handleOpenCheckout('pro', 'Pro Plan', 49)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: subscription?.plan_type === 'pro' ? '#cbd5e1' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: subscription?.plan_type === 'pro' ? 'default' : 'pointer'
                }}
              >
                {subscription?.plan_type === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
              </button>
            </div>

            {/* Enterprise Plan */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: subscription?.plan_type === 'enterprise' ? '2px solid #2563eb' : '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>Enterprise</h4>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '12px' }}>$99 <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 'normal' }}>/ month</span></div>
              <ul style={{ paddingLeft: '18px', margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                <li>Multi-location Support</li>
                <li>Custom Branding & Domain</li>
                <li>Dedicated Account Manager</li>
              </ul>
              <button
                type="button"
                disabled={subLoading || subscription?.plan_type === 'enterprise'}
                onClick={() => handleOpenCheckout('enterprise', 'Enterprise Plan', 99)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: subscription?.plan_type === 'enterprise' ? '#cbd5e1' : '#2563eb',
                  color: '#ffffff',
                  fontWeight: '600',
                  cursor: subscription?.plan_type === 'enterprise' ? 'default' : 'pointer'
                }}
              >
                {subscription?.plan_type === 'enterprise' ? 'Current Plan' : 'Select Enterprise'}
              </button>
            </div>
          </div>

          {/* Test/Mock Checkout Modal */}
          {showCheckoutModal && selectedPlanForCheckout && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <h3 style={styles.modalTitle}>Review Plan & Checkout</h3>
                <p style={styles.modalSubtitle}>Review your order summary before completing subscription upgrade.</p>

                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Selected Package:</span>
                    <strong style={{ color: '#0f172a' }}>{selectedPlanForCheckout.planName}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#64748b' }}>Billing Cycle:</span>
                    <strong style={{ color: '#0f172a' }}>Monthly</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #cbd5e1' }}>
                    <span style={{ color: '#0f172a', fontWeight: '700' }}>Total Due:</span>
                    <strong style={{ color: '#2563eb', fontSize: '18px' }}>${selectedPlanForCheckout.price}.00 / mo</strong>
                  </div>
                </div>

                <div style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '12px', borderRadius: '6px', fontSize: '13px', marginBottom: '20px', border: '1px solid #fde68a' }}>
                  ⚙️ <strong>Development / Testing Mode:</strong> Real payment gateway integration (Stripe/JazzCash) is pending API credentials. Clicking "Confirm Subscription Update" will execute a controlled mock checkout and immediately update your subscription state.
                </div>

                <div style={styles.modalActions}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCheckoutModal(false);
                      setSelectedPlanForCheckout(null);
                    }}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={subLoading}
                    onClick={handleConfirmCheckout}
                    style={styles.primaryButton}
                  >
                    {subLoading ? 'Processing Checkout...' : 'Confirm Subscription Update'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value
}) => {
  return (
    <div style={styles.statCard}>
      <p style={styles.statTitle}>
        {title}
      </p>

      <h2 style={styles.statValue}>
        {value}
      </h2>
    </div>
  );
};

const InfoItem = ({
  label,
  value
}) => {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>
        {label}
      </span>

      <strong style={styles.infoValue}>
        {value}
      </strong>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    padding: '24px',
    background: '#f5f7fb',
    boxSizing: 'border-box',
    fontFamily:
      'Arial, sans-serif'
  },

  header: {
    display: 'flex',
    justifyContent:
      'space-between',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px'
  },

  title: {
    margin: 0,
    fontSize: '30px'
  },

  subtitle: {
    margin: '6px 0 0',
    color: '#666'
  },

  logoutButton: {
    border: 'none',
    background: '#222',
    color: '#fff',
    padding: '10px 18px',
    borderRadius: '8px',
    cursor: 'pointer'
  },

  error: {
    background: '#ffe5e5',
    color: '#a00000',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px'
  },

  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '24px'
  },

  navButton: {
    border: '1px solid #ddd',
    background: '#fff',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer'
  },

  navButtonActive: {
    border: '1px solid #222',
    background: '#222',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer'
  },

  grid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },

  statCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '20px',
    boxShadow:
      '0 2px 8px rgba(0,0,0,0.06)'
  },

  statTitle: {
    margin: 0,
    color: '#666',
    fontSize: '14px'
  },

  statValue: {
    margin: '8px 0 0',
    fontSize: '28px'
  },

  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow:
      '0 2px 8px rgba(0,0,0,0.06)'
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: '20px'
  },

  infoGrid: {
    display: 'grid',
    gridTemplateColumns:
      'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px'
  },

  infoItem: {
    padding: '14px',
    background: '#f7f8fa',
    borderRadius: '8px'
  },

  infoLabel: {
    display: 'block',
    color: '#666',
    fontSize: '13px',
    marginBottom: '6px'
  },

  infoValue: {
    display: 'block'
  },

  tableWrapper: {
    width: '100%',
    overflowX: 'auto'
  },

  table: {
    width: '100%',
    borderCollapse:
      'collapse'
  },

  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom:
      '2px solid #eee',
    whiteSpace: 'nowrap'
  },

  td: {
    padding: '12px',
    borderBottom:
      '1px solid #eee'
  },

  actionButton: {
    border: 'none',
    background: '#222',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer'
  },

  empty: {
    color: '#777'
  },

  qrSection: {
    textAlign: 'center'
  },

  qrImage: {
    width: '320px',
    maxWidth: '100%',
    height: 'auto',
    display: 'block',
    margin:
      '0 auto 20px'
  },

  qrText: {
    color: '#666',
    maxWidth: '600px',
    margin:
      '0 auto 20px',
    lineHeight: 1.6
  },

  qrInfoBox: {
    maxWidth: '700px',
    margin:
      '12px auto',
    padding: '14px',
    background: '#f7f8fa',
    borderRadius: '8px',
    textAlign: 'left',
    wordBreak:
      'break-all'
  },

  qrCodeText: {
    margin:
      '8px 0 0',
    fontFamily:
      'monospace',
    fontSize: '13px'
  },

  qrUrlText: {
    margin:
      '8px 0 0',
    fontSize: '13px',
    color: '#555'
  },

  downloadButton: {
    marginTop: '10px',
    border: 'none',
    background: '#222',
    color: '#fff',
    padding:
      '11px 18px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600'
  },

  centerMessage: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent:
      'center',
    alignItems: 'center'
  },

  sectionHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '20px'
  },

  primaryButton: {
    border: 'none',
    background: '#2563eb',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px'
  },

  secondaryButton: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#374151',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  },

  deactivateButton: {
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },

  actionRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    alignItems: 'center'
  },

  activeBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    backgroundColor: '#dcfce7',
    color: '#166534',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'capitalize'
  },

  inactiveBadge: {
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '999px',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'capitalize'
  },

  success: {
    background: '#dcfce7',
    color: '#166534',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px',
    border: '1px solid #bbf7d0'
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
    maxWidth: '460px',
    width: '100%',
    boxSizing: 'border-box'
  },

  modalTitle: {
    margin: '0 0 6px',
    fontSize: '20px',
    fontWeight: '700',
    color: '#111827'
  },

  modalSubtitle: {
    margin: '0 0 20px',
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.5
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },

  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },

  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151'
  },

  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '14px',
    width: '100%',
    boxSizing: 'border-box'
  },

  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '10px'
  },

  cancelButton: {
    border: '1px solid #d1d5db',
    background: '#ffffff',
    color: '#374151',
    padding: '10px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  }
};

export default OwnerDashboard;
