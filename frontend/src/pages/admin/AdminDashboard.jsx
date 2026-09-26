import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const AdminDashboard = () => {
  const { session, profile, logout } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [reports, setReports] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');

  const getConfig = () => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    }
  });

  const getValue = (object, keys, fallback = 0) => {
    if (!object) {
      return fallback;
    }

    for (const key of keys) {
      if (
        object[key] !== undefined &&
        object[key] !== null
      ) {
        return object[key];
      }
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

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      const config = getConfig();

      const [
        dashboardResponse,
        vendorsResponse,
        reportsResponse
      ] = await Promise.all([
        api.get('/admin/dashboard', config),
        api.get('/admin/vendors', config),
        api.get('/admin/reports', config)
      ]);

      setDashboard(dashboardResponse.data);

      /*
       * Admin vendors response can be either:
       *
       * {
       *   vendors: [...]
       * }
       *
       * or
       *
       * [...]
       *
       * Normalize it to an array.
       */
      const vendorData =
        dashboardResponse.data?.vendors ||
        vendorsResponse.data?.vendors ||
        vendorsResponse.data ||
        [];

      setVendors(
        Array.isArray(vendorData)
          ? vendorData
          : []
      );

      /*
       * Normalize reports response to an array.
       */
      const reportData =
        reportsResponse.data?.reports ||
        reportsResponse.data ||
        [];

      setReports(
        Array.isArray(reportData)
          ? reportData
          : []
      );
    } catch (err) {
      console.error(
        'Failed to load admin dashboard:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to load admin dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      loadDashboard();
    }
  }, [session]);

  const updateVendorStatus = async (
    vendorId,
    status
  ) => {
    try {
      setError('');

      await api.patch(
        `/tenants/${vendorId}/status`,
        { status },
        getConfig()
      );

      await loadDashboard();
    } catch (err) {
      console.error(
        'Failed to update vendor status:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to update vendor status.'
      );
    }
  };

  const downloadReports = async () => {
    try {
      setError('');

      const response = await api.get(
        '/admin/reports/export',
        {
          ...getConfig(),
          responseType: 'blob'
        }
      );

      const blob = new Blob(
        [response.data],
        {
          type:
            response.headers?.['content-type'] ||
            'text/csv'
        }
      );

      const url = window.URL.createObjectURL(blob);

      const link =
        document.createElement('a');

      link.href = url;
      link.download = 'qr-loyalty-reports.csv';

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(
        'Failed to export reports:',
        err
      );

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to export reports.'
      );
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
        <h1>Admin Dashboard</h1>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const overview =
    dashboard?.overview ||
    dashboard?.stats ||
    dashboard ||
    {};

  const totalVendors = getValue(
    overview,
    ['total_vendors', 'totalVendors'],
    vendors.length
  );

  const activeVendors = getValue(
    overview,
    ['active_vendors', 'activeVendors'],
    0
  );

  const holdVendors = getValue(
    overview,
    [
      'vendors_on_hold',
      'hold_vendors',
      'holdVendors'
    ],
    0
  );

  const removedVendors = getValue(
    overview,
    [
      'removed_vendors',
      'removedVendors'
    ],
    0
  );

  const totalCustomers = getValue(
    overview,
    [
      'total_customers',
      'totalCustomers'
    ],
    0
  );

  const totalStamps = getValue(
    overview,
    [
      'total_stamps',
      'totalStamps'
    ],
    0
  );

  const totalRewards = getValue(
    overview,
    [
      'total_rewards',
      'totalRewards'
    ],
    0
  );

  const totalRedemptions = getValue(
    overview,
    [
      'total_redemptions',
      'totalRedemptions'
    ],
    0
  );

  const vendorStatusSummary =
    dashboard?.vendor_status_summary ||
    dashboard?.vendorStatusSummary ||
    [];

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
          borderBottom: '1px solid #e5e7eb',
          padding: '20px 30px',
          display: 'flex',
          justifyContent: 'space-between',
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
            Admin Dashboard
          </h1>

          <p
            style={{
              margin: '6px 0 0',
              color: '#6b7280'
            }}
          >
            Welcome,{' '}
            {profile?.full_name ||
              profile?.name ||
              'QR Loyalty Admin'}
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

      {/* Navigation */}
      <nav
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          padding: '0 30px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap'
        }}
      >
        {[
          ['overview', 'Overview'],
          ['vendors', 'Vendors'],
          ['reports', 'Reports']
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() =>
              setActiveSection(key)
            }
            style={{
              padding: '14px 18px',
              border: 'none',
              borderBottom:
                activeSection === key
                  ? '3px solid #2563eb'
                  : '3px solid transparent',
              backgroundColor: 'transparent',
              color:
                activeSection === key
                  ? '#2563eb'
                  : '#4b5563',
              cursor: 'pointer',
              fontWeight:
                activeSection === key
                  ? '600'
                  : '500'
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main
        style={{
          padding: '30px',
          maxWidth: '1400px',
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
              border: '1px solid #fecaca'
            }}
          >
            {error}
          </div>
        )}

        {/* OVERVIEW */}
        {activeSection === 'overview' && (
          <section>
            <h2>Platform Overview</h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '18px',
                marginTop: '20px'
              }}
            >
              {[
                [
                  'Total Vendors',
                  totalVendors
                ],
                [
                  'Active Vendors',
                  activeVendors
                ],
                [
                  'Vendors on Hold',
                  holdVendors
                ],
                [
                  'Removed Vendors',
                  removedVendors
                ],
                [
                  'Total Customers',
                  totalCustomers
                ],
                [
                  'Total Stamps',
                  totalStamps
                ],
                [
                  'Total Rewards',
                  totalRewards
                ],
                [
                  'Total Redemptions',
                  totalRedemptions
                ]
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '20px',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow:
                      '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: '#6b7280',
                      fontSize: '14px'
                    }}
                  >
                    {label}
                  </p>

                  <h3
                    style={{
                      margin: '10px 0 0',
                      fontSize: '28px'
                    }}
                  >
                    {String(value)}
                  </h3>
                </div>
              ))}
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                marginTop: '30px',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb'
              }}
            >
              <h3>
                Vendor Status Summary
              </h3>

              {Array.isArray(
                vendorStatusSummary
              ) &&
              vendorStatusSummary.length > 0 ? (
                <div
                  style={{
                    overflowX: 'auto'
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse:
                        'collapse'
                    }}
                  >
                    <thead>
                      <tr>
                        <th
                          style={{
                            textAlign: 'left',
                            padding: '12px',
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
                            borderBottom:
                              '1px solid #e5e7eb'
                          }}
                        >
                          Count
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {vendorStatusSummary.map(
                        (item, index) => {
                          const status =
                            typeof item ===
                            'object'
                              ? item?.status ||
                                item?.name ||
                                '-'
                              : item;

                          const count =
                            typeof item ===
                            'object'
                              ? item?.count ??
                                item?.total ??
                                0
                              : 0;

                          return (
                            <tr
                              key={
                                item?.id ||
                                `${status}-${index}`
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
                                {String(
                                  status
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
                                {String(
                                  count
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
                  No vendor status data available.
                </p>
              )}
            </div>
          </section>
        )}

        {/* VENDORS */}
        {activeSection === 'vendors' && (
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap'
              }}
            >
              <h2>Vendors</h2>

              <button
                onClick={loadDashboard}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor:
                    '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                Refresh
              </button>
            </div>

            <div
              style={{
                marginTop: '20px',
                backgroundColor:
                  '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                overflowX: 'auto'
              }}
            >
              {vendors.length > 0 ? (
                <table
                  style={{
                    width: '100%',
                    borderCollapse:
                      'collapse',
                    minWidth: '700px'
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Business Name
                      </th>

                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Status
                      </th>

                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Created
                      </th>

                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {vendors.map(
                      (vendor, index) => {
                        /*
                         * IMPORTANT:
                         * Never render {vendor}
                         * directly.
                         *
                         * Vendor is an object.
                         * We render its individual
                         * properties instead.
                         */

                        const vendorId =
                          vendor?.id;

                        const businessName =
                          vendor?.business_name ||
                          vendor?.businessName ||
                          vendor?.name ||
                          'Unnamed Vendor';

                        const status =
                          vendor?.status ||
                          'unknown';

                        const createdAt =
                          vendor?.created_at ||
                          vendor?.createdAt ||
                          null;

                        return (
                          <tr
                            key={
                              vendorId ||
                              `vendor-${index}`
                            }
                          >
                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9',
                                fontWeight:
                                  '600'
                              }}
                            >
                              {String(
                                businessName
                              )}
                            </td>

                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              <span
                                style={{
                                  display:
                                    'inline-block',
                                  padding:
                                    '5px 10px',
                                  borderRadius:
                                    '999px',
                                  backgroundColor:
                                    status ===
                                    'active'
                                      ? '#dcfce7'
                                      : status ===
                                        'hold'
                                      ? '#fef3c7'
                                      : status ===
                                        'removed'
                                      ? '#fee2e2'
                                      : '#f3f4f6',
                                  color:
                                    status ===
                                    'active'
                                      ? '#166534'
                                      : status ===
                                        'hold'
                                      ? '#92400e'
                                      : status ===
                                        'removed'
                                      ? '#991b1b'
                                      : '#374151'
                                }}
                              >
                                {String(
                                  status
                                )}
                              </span>
                            </td>

                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              {formatDate(
                                createdAt
                              )}
                            </td>

                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              {vendorId ? (
                                <div
                                  style={{
                                    display:
                                      'flex',
                                    gap: '8px',
                                    flexWrap:
                                      'wrap'
                                  }}
                                >
                                  {status !==
                                    'active' && (
                                    <button
                                      onClick={() =>
                                        updateVendorStatus(
                                          vendorId,
                                          'active'
                                        )
                                      }
                                      style={{
                                        padding:
                                          '7px 12px',
                                        border:
                                          'none',
                                        borderRadius:
                                          '6px',
                                        backgroundColor:
                                          '#16a34a',
                                        color:
                                          '#ffffff',
                                        cursor:
                                          'pointer'
                                      }}
                                    >
                                      Activate
                                    </button>
                                  )}

                                  {status !==
                                    'hold' && (
                                    <button
                                      onClick={() =>
                                        updateVendorStatus(
                                          vendorId,
                                          'hold'
                                        )
                                      }
                                      style={{
                                        padding:
                                          '7px 12px',
                                        border:
                                          'none',
                                        borderRadius:
                                          '6px',
                                        backgroundColor:
                                          '#d97706',
                                        color:
                                          '#ffffff',
                                        cursor:
                                          'pointer'
                                      }}
                                    >
                                      Hold
                                    </button>
                                  )}

                                  {status !==
                                    'removed' && (
                                    <button
                                      onClick={() =>
                                        updateVendorStatus(
                                          vendorId,
                                          'removed'
                                        )
                                      }
                                      style={{
                                        padding:
                                          '7px 12px',
                                        border:
                                          'none',
                                        borderRadius:
                                          '6px',
                                        backgroundColor:
                                          '#dc2626',
                                        color:
                                          '#ffffff',
                                        cursor:
                                          'pointer'
                                      }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              ) : (
                <div
                  style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}
                >
                  No vendors found.
                </div>
              )}
            </div>
          </section>
        )}

        {/* REPORTS */}
        {activeSection === 'reports' && (
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent:
                  'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap'
              }}
            >
              <h2>Reports</h2>

              <button
                onClick={downloadReports}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  backgroundColor:
                    '#2563eb',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Download Reports
              </button>
            </div>

            <div
              style={{
                marginTop: '20px',
                backgroundColor:
                  '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                overflowX: 'auto'
              }}
            >
              {reports.length > 0 ? (
                <table
                  style={{
                    width: '100%',
                    borderCollapse:
                      'collapse',
                    minWidth: '700px'
                  }}
                >
                  <thead>
                    <tr>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Vendor
                      </th>

                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Customers
                      </th>

                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Stamps
                      </th>

                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Rewards
                      </th>

                      <th
                        style={{
                          textAlign: 'left',
                          padding: '14px',
                          borderBottom:
                            '1px solid #e5e7eb'
                        }}
                      >
                        Redemptions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.map(
                      (report, index) => {
                        const vendorName =
                          report?.business_name ||
                          report?.businessName ||
                          report?.vendor_name ||
                          report?.vendorName ||
                          report?.vendor?.business_name ||
                          'Unknown Vendor';

                        const customers =
                          report?.total_customers ??
                          report?.customers ??
                          0;

                        const stamps =
                          report?.total_stamps ??
                          report?.stamps ??
                          0;

                        const rewards =
                          report?.total_rewards ??
                          report?.rewards ??
                          0;

                        const redemptions =
                          report?.total_redemptions ??
                          report?.redemptions ??
                          0;

                        return (
                          <tr
                            key={
                              report?.id ||
                              `report-${index}`
                            }
                          >
                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              {String(
                                vendorName
                              )}
                            </td>

                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              {String(
                                customers
                              )}
                            </td>

                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              {String(
                                stamps
                              )}
                            </td>

                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              {String(
                                rewards
                              )}
                            </td>

                            <td
                              style={{
                                padding: '14px',
                                borderBottom:
                                  '1px solid #f1f5f9'
                              }}
                            >
                              {String(
                                redemptions
                              )}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              ) : (
                <div
                  style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#6b7280'
                  }}
                >
                  No reports available.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;