
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import QRCode from 'qrcode';

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

  const [activeSection, setActiveSection] =
    useState('overview');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });

  const loadDashboard = async () => {
    const response = await api.get(
      '/owner/dashboard',
      getConfig()
    );

    setDashboard(response.data);
  };

  const loadStaff = async () => {
    const response = await api.get(
      '/owner/staff',
      getConfig()
    );

    setStaff(
      response.data?.staff ||
        response.data ||
        []
    );
  };

  const loadLoyalty = async () => {
    const response = await api.get(
      '/loyalty',
      getConfig()
    );

    setLoyalty(
      response.data?.loyalty ||
        response.data ||
        null
    );
  };

  const loadRewards = async () => {
    const response = await api.get(
      '/rewards',
      getConfig()
    );

    setRewards(
      response.data?.rewards ||
        response.data ||
        []
    );
  };

  const loadQr = async () => {
    const response = await api.get(
      '/qr',
      getConfig()
    );

    const qrRecord =
      response.data?.qr_code ||
      response.data?.qr ||
      null;

    setQr(qrRecord);

    if (qrRecord?.code) {
      const verificationUrl =
        `${window.location.origin}/customer/verify?qr_code=${encodeURIComponent(
          qrRecord.code
        )}`;

      const generatedQr =
        await QRCode.toDataURL(
          verificationUrl,
          {
            width: 320,
            margin: 2
          }
        );

      setQrImage(generatedQr);
    } else {
      setQrImage('');
    }
  };

  const loadAllData = async () => {
    if (!session?.access_token) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await Promise.all([
        loadDashboard(),
        loadStaff(),
        loadLoyalty(),
        loadRewards(),
        loadQr()
      ]);
    } catch (err) {
      console.error(
        'Owner dashboard error:',
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to load owner dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [session]);

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

      await loadStaff();
      await loadDashboard();
    } catch (err) {
      console.error(
        'Staff status update error:',
        err
      );

      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          'Failed to update staff status.'
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

  if (loading) {
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
                  profile?.email || '-'
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
          <h2 style={styles.sectionTitle}>
            Loyalty Program
          </h2>

          {loyalty ? (
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
                  loyalty.is_active ===
                  false
                    ? 'Inactive'
                    : 'Active'
                }
              />
            </div>
          ) : (
            <p style={styles.empty}>
              No loyalty program found.
            </p>
          )}
        </section>
      )}

      {/* Staff */}
      {activeSection === 'staff' && (
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>
            Staff Management
          </h2>

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
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {staff.map(
                    (member) => (
                      <tr
                        key={
                          member.id
                        }
                      >
                        <td
                          style={
                            styles.td
                          }
                        >
                          {member.full_name ||
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
                          {member.status ||
                            '-'}
                        </td>

                        <td
                          style={
                            styles.td
                          }
                        >
                          <button
                            type="button"
                            onClick={() =>
                              changeStaffStatus(
                                member
                              )
                            }
                            style={
                              styles.actionButton
                            }
                          >
                            {member.status ===
                            'active'
                              ? 'Deactivate'
                              : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={styles.empty}>
              No staff members found.
            </p>
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
  }
};

export default OwnerDashboard;

