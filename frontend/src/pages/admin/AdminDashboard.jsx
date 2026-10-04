import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { logClientError } from '../../services/logging';

const AdminDashboard = () => {
  const { session, profile, logout } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [reports, setReports] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const loadedForUser = useRef(null);
  const [loadedForUserId, setLoadedForUserId] = useState(null);

  // Tenant Onboarding state
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardSuccess, setOnboardSuccess] = useState('');

  // Admin Monthly Tenant Report State
  const [selectedReportTenantId, setSelectedReportTenantId] = useState('');
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [monthlyReportData, setMonthlyReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Subscriptions state
  const [subscriptions, setSubscriptions] = useState([]);
  const [subSummary, setSubSummary] = useState(null);

  // Admin Grant Subscription State
  const [showGrantSubModal, setShowGrantSubModal] = useState(false);
  const [grantTenantId, setGrantTenantId] = useState('');
  const [grantTenantName, setGrantTenantName] = useState('');
  const [grantPlanDuration, setGrantPlanDuration] = useState('monthly');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantSuccess, setGrantSuccess] = useState('');

  const getConfig = (signal) => ({
    headers: {
      Authorization: `Bearer ${session?.access_token}`
    },
    ...(signal ? { signal } : {})
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

  const loadDashboard = async (signal) => {
    try {
      setLoading(true);
      setError('');

      const config = getConfig(signal);

      const [
        dashboardResponse,
        vendorsResponse,
        reportsResponse,
        subResponse
      ] = await Promise.all([
        api.get('/admin/dashboard', config),
        api.get('/admin/vendors', config),
        api.get('/admin/reports', config),
        api.get('/admin/subscriptions', config).catch(() => ({ data: { subscriptions: [], summary: null } }))
      ]);

      if (signal?.aborted) return;

      setSubscriptions(subResponse.data?.subscriptions || []);
      setSubSummary(subResponse.data?.summary || null);

      const dashboardData =
        dashboardResponse.data?.dashboard ?? dashboardResponse.data;
      setDashboard(dashboardData);

      const vendorData =
        vendorsResponse.data?.vendors ||
        dashboardData?.vendors ||
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
        reportsResponse.data?.report?.vendors ||
        reportsResponse.data?.reports ||
        reportsResponse.data ||
        [];

      setReports(
        Array.isArray(reportData)
          ? reportData
          : []
      );
    } catch (err) {
      if (signal?.aborted) return;
      logClientError('Failed to load admin dashboard', err);

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to load admin dashboard.'
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const loadDashboardEffect = useEffectEvent(loadDashboard);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || loadedForUser.current === userId) return;
    loadedForUser.current = userId;
    setDashboard(null);
    setVendors([]);
    setReports([]);
    setLoadedForUserId(userId);
    const controller = new AbortController();
    loadDashboardEffect(controller.signal);

    return () => {
      controller.abort();
      if (loadedForUser.current === userId) {
        loadedForUser.current = null;
      }
    };
  }, [session?.user?.id]);

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
      logClientError('Failed to update vendor status', err);

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to update vendor status.'
      );
    }
  };

  const handleAddTenant = async (event) => {
    event.preventDefault();
    setError('');
    setOnboardSuccess('');

    if (!businessName.trim() || !ownerEmail.trim() || !ownerPassword || !ownerFullName.trim()) {
      setError('Business name, owner full name, email, and password are required.');
      return;
    }

    if (ownerPassword.length < 6) {
      setError('Owner password must be at least 6 characters.');
      return;
    }

    try {
      setOnboardLoading(true);
      const config = getConfig();

      // Step 1: Create Tenant
      const tenantRes = await api.post('/tenants', { business_name: businessName.trim() }, config);
      const createdTenant = tenantRes.data?.tenant;

      if (!createdTenant?.id) {
        throw new Error('Failed to create tenant record.');
      }

      // Step 2: Create Vendor Owner
      await api.post(`/tenants/${createdTenant.id}/owner`, {
        email: ownerEmail.trim(),
        password: ownerPassword,
        full_name: ownerFullName.trim()
      }, config);

      setOnboardSuccess(`Tenant "${businessName}" & owner "${ownerFullName}" onboarded successfully!`);
      setBusinessName('');
      setOwnerFullName('');
      setOwnerEmail('');
      setOwnerPassword('');
      setShowAddTenantModal(false);

      await loadDashboard();
    } catch (err) {
      logClientError('Tenant onboarding failed', err);
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to onboard new tenant.'
      );
    } finally {
      setOnboardLoading(false);
    }
  };

  const handleGrantSubscription = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setGrantSuccess('');

    if (!grantTenantId) {
      setError('Please select a vendor to grant subscription.');
      return;
    }

    try {
      setGrantLoading(true);
      const res = await api.post(`/admin/subscriptions/${grantTenantId}/grant`, {
        plan_duration: grantPlanDuration
      }, getConfig());

      setGrantSuccess(res.data?.message || 'Subscription package granted successfully!');
      setShowGrantSubModal(false);
      await loadDashboard();
    } catch (err) {
      logClientError('Grant subscription failed', err);
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to grant subscription package.'
      );
    } finally {
      setGrantLoading(false);
    }
  };

  const handleGenerateMonthlyReport = async (e) => {
    if (e) e.preventDefault();
    if (!selectedReportTenantId) {
      setError('Please select a tenant to generate the monthly report.');
      return;
    }
    if (!selectedReportMonth) {
      setError('Please select a month for the report.');
      return;
    }
    try {
      setReportLoading(true);
      setError('');
      const res = await api.get(`/admin/reports/monthly?tenant_id=${selectedReportTenantId}&month=${selectedReportMonth}`, getConfig());
      setMonthlyReportData(res.data?.report || null);
    } catch (err) {
      logClientError('Failed to generate monthly report', err);
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to generate monthly report.'
      );
    } finally {
      setReportLoading(false);
    }
  };

  const downloadMonthlyReportCsv = () => {
    if (!monthlyReportData) return;
    const { business_name, report_month, summary, daily_breakdown, customer_frequency } = monthlyReportData;

    let csvContent = `Tenant Monthly Report: ${business_name}\n`;
    csvContent += `Report Month: ${report_month}\n\n`;
    csvContent += `SUMMARY METRICS\n`;
    csvContent += `Metric,Value\n`;
    csvContent += `Total Visits,${summary.total_visits}\n`;
    csvContent += `Unique Customers,${summary.unique_customers}\n`;
    csvContent += `Repeat Visits,${summary.repeat_visits}\n`;
    csvContent += `New Customers,${summary.new_customers}\n`;
    csvContent += `Average Visits / Customer,${summary.avg_visits_per_customer}\n`;
    csvContent += `Stamps Issued,${summary.stamps_issued}\n`;
    csvContent += `Rewards Redeemed,${summary.rewards_redeemed}\n`;
    csvContent += `Peak Visit Day,${summary.peak_visit_day?.date} (${summary.peak_visit_day?.visits} visits)\n`;
    csvContent += `Lowest Visit Day,${summary.lowest_visit_day?.date} (${summary.lowest_visit_day?.visits} visits)\n\n`;

    csvContent += `DAILY BREAKDOWN\n`;
    csvContent += `Date,Visits,Unique Customers,Stamps,Redemptions\n`;
    (daily_breakdown || []).forEach((row) => {
      csvContent += `${row.date},${row.visits},${row.unique_customers},${row.stamps},${row.redemptions}\n`;
    });

    csvContent += `\nCUSTOMER VISIT FREQUENCY\n`;
    csvContent += `Customer Identifier,Visits\n`;
    (customer_frequency || []).forEach((row) => {
      csvContent += `"${row.customer_identifier.replace(/"/g, '""')}",${row.visits}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${business_name.replace(/\s+/g, '_')}_Monthly_Report_${report_month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      logClientError('Failed to export reports', err);

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
        <h1>Admin Dashboard</h1>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const overview =
    dashboard?.statistics ||
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
    [
      { status: 'active', count: activeVendors },
      { status: 'hold', count: holdVendors },
      { status: 'removed', count: removedVendors }
    ];

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
          ['reports', 'Reports'],
          ['subscriptions', 'Subscriptions & Billing']
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setError('');
                    setOnboardSuccess('');
                    setShowAddTenantModal(true);
                  }}
                  style={{
                    padding: '10px 16px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: '600'
                  }}
                >
                  + Add New Tenant
                </button>

                <button
                  onClick={loadDashboard}
                  style={{
                    padding: '10px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    cursor: 'pointer',
                    fontWeight: '500'
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {onboardSuccess && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#dcfce7',
                  color: '#166534',
                  border: '1px solid #bbf7d0'
                }}
              >
                {onboardSuccess}
              </div>
            )}

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
            {/* Tenant Onboarding Modal */}
            {showAddTenantModal && (
              <div
                style={{
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
                }}
              >
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '28px',
                    maxWidth: '480px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                >
                  <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '700', color: '#111827' }}>
                    Onboard New Vendor Tenant
                  </h3>
                  <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>
                    Create a new business tenant and configure its vendor owner credentials.
                  </p>

                  <form onSubmit={handleAddTenant} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Business Name</label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Express Coffee Bar"
                        required
                        style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Owner Full Name</label>
                      <input
                        type="text"
                        value={ownerFullName}
                        onChange={(e) => setOwnerFullName(e.target.value)}
                        placeholder="e.g. Alex Rivera"
                        required
                        style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Owner Email Address</label>
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="owner@expresscoffee.com"
                        required
                        style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Initial Owner Password</label>
                      <input
                        type="password"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddTenantModal(false)}
                        style={{ padding: '10px 16px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={onboardLoading}
                        style={{ padding: '10px 16px', border: 'none', backgroundColor: '#16a34a', color: '#ffffff', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        {onboardLoading ? 'Creating...' : 'Onboard Tenant'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </section>
        )}

        {/* REPORTS */}
        {activeSection === 'reports' && (
          <section>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Reports</h2>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
                  Platform Admin Official Monthly Tenant Report Generator
                </p>
              </div>

              <button
                onClick={downloadReports}
                style={{
                  padding: '10px 16px',
                  border: '1px solid #2563eb',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  color: '#2563eb',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Export Platform CSV
              </button>
            </div>

            {/* Monthly Tenant Report Generator Form */}
            <div
              style={{
                marginTop: '20px',
                backgroundColor: '#ffffff',
                padding: '24px',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: '700', color: '#111827' }}>
                Generate Tenant Monthly Report
              </h3>

              <form onSubmit={handleGenerateMonthlyReport} style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px', flex: 1 }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Select Tenant</label>
                  <select
                    value={selectedReportTenantId}
                    onChange={(e) => setSelectedReportTenantId(e.target.value)}
                    required
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  >
                    <option value="">-- Choose Vendor Tenant --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.business_name || v.name} ({v.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Select Month</label>
                  <input
                    type="month"
                    value={selectedReportMonth}
                    onChange={(e) => setSelectedReportMonth(e.target.value)}
                    required
                    style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '14px', width: '100%', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={reportLoading || !selectedReportTenantId}
                  style={{
                    padding: '11px 22px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: reportLoading || !selectedReportTenantId ? '#9ca3af' : '#2563eb',
                    color: '#ffffff',
                    cursor: reportLoading || !selectedReportTenantId ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '14px',
                    height: '42px'
                  }}
                >
                  {reportLoading ? 'Generating...' : 'Generate Report'}
                </button>
              </form>
            </div>

            {/* Generated Monthly Report Preview */}
            {monthlyReportData && (
              <div
                style={{
                  marginTop: '24px',
                  backgroundColor: '#ffffff',
                  padding: '24px',
                  borderRadius: '12px',
                  border: '1px solid #2563eb'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '20px', color: '#1e3a8a' }}>
                      {monthlyReportData.business_name} — Monthly Report ({monthlyReportData.report_month})
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>
                      Official Tenant Analytics & Activity Summary
                    </p>
                  </div>

                  <button
                    onClick={downloadMonthlyReportCsv}
                    style={{
                      padding: '10px 18px',
                      border: 'none',
                      borderRadius: '8px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>↓</span> Download CSV
                  </button>
                </div>

                {/* Report Key Metrics Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '16px',
                    marginBottom: '28px'
                  }}
                >
                  {[
                    ['Total Visits', monthlyReportData.summary?.total_visits ?? 0],
                    ['Unique Customers', monthlyReportData.summary?.unique_customers ?? 0],
                    ['Repeat Visits', monthlyReportData.summary?.repeat_visits ?? 0],
                    ['New Customers', monthlyReportData.summary?.new_customers ?? 0],
                    ['Avg Visits / Cust', monthlyReportData.summary?.avg_visits_per_customer ?? 0],
                    ['Stamps Issued', monthlyReportData.summary?.stamps_issued ?? 0],
                    ['Rewards Redeemed', monthlyReportData.summary?.rewards_redeemed ?? 0],
                    ['Peak Visit Day', `${monthlyReportData.summary?.peak_visit_day?.date} (${monthlyReportData.summary?.peak_visit_day?.visits || 0})`],
                    ['Lowest Visit Day', `${monthlyReportData.summary?.lowest_visit_day?.date} (${monthlyReportData.summary?.lowest_visit_day?.visits || 0})`]
                  ].map(([label, val]) => (
                    <div key={label} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>{label}</span>
                      <h4 style={{ margin: '8px 0 0', fontSize: '20px', color: '#0f172a' }}>{String(val)}</h4>
                    </div>
                  ))}
                </div>

                {/* Daily Breakdown Table */}
                <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700' }}>Daily Visit Breakdown</h4>
                <div style={{ overflowX: 'auto', marginBottom: '28px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>Visits</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>Unique Customers</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>Stamps</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #cbd5e1' }}>Redemptions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monthlyReportData.daily_breakdown || []).map((row) => (
                        <tr key={row.date} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '500' }}>{row.date}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.visits}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.unique_customers}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.stamps}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>{row.redemptions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Customer Visit Frequency */}
                <h4 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '700' }}>Customer Visit Frequency</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '450px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>Customer Identifier</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #cbd5e1' }}>Visits in Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monthlyReportData.customer_frequency || []).length > 0 ? (
                        monthlyReportData.customer_frequency.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 12px', fontWeight: '500' }}>{item.customer_identifier}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#2563eb' }}>{item.visits} visits</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} style={{ padding: '14px', color: '#6b7280', textAlign: 'center' }}>
                            No customer visit activity recorded in this month.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Platform Overview Reports */}
            <div
              style={{
                marginTop: '30px',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                overflowX: 'auto',
                padding: '20px'
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Platform Vendors Summary</h3>
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
                          report?.statistics?.total_customers ??
                          report?.total_customers ??
                          report?.customers ??
                          0;

                        const stamps =
                          report?.statistics?.total_stamps ??
                          report?.total_stamps ??
                          report?.stamps ??
                          0;

                        const rewards =
                          report?.statistics?.total_rewards ??
                          report?.total_rewards ??
                          report?.rewards ??
                          0;

                        const redemptions =
                          report?.statistics?.total_redemptions ??
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

        {/* SUBSCRIPTIONS */}
        {activeSection === 'subscriptions' && (
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0 }}>Tenant Subscriptions & Billing</h2>
                <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
                  Monitor paid subscriptions, active trial periods, and override tenant plans.
                </p>
              </div>
            </div>

            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>ACTIVE PAID TENANTS</div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#166534', marginTop: '6px' }}>{subSummary?.total_paid_tenants ?? 0}</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>ACTIVE TRIALS</div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#0369a1', marginTop: '6px' }}>{subSummary?.active_trials ?? 0}</div>
              </div>

              <div style={{ backgroundColor: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>EXPIRED SUBSCRIPTIONS</div>
                <div style={{ fontSize: '28px', fontWeight: '800', color: '#991b1b', marginTop: '6px' }}>{subSummary?.expired_subscriptions ?? 0}</div>
              </div>
            </div>

            {/* Tenant Subscriptions Table */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Business Name</th>
                    <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Plan Type</th>
                    <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Days Remaining</th>
                    <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Amount Paid</th>
                    <th style={{ padding: '14px 16px', color: '#475569', fontWeight: '600' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.length > 0 ? (
                    subscriptions.map((sub) => (
                      <tr key={sub.tenant_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '14px 16px', fontWeight: '600', color: '#0f172a' }}>{sub.business_name}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                            {sub.plan_type}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', backgroundColor: sub.status === 'active' ? '#dcfce7' : '#fee2e2', color: sub.status === 'active' ? '#15803d' : '#b91c1c' }}>
                            {sub.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: '600' }}>{sub.days_left} Days</td>
                        <td style={{ padding: '14px 16px', fontWeight: '600' }}>${sub.amount_paid}.00</td>
                        <td style={{ padding: '14px 16px' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await api.patch(`/admin/subscriptions/${sub.tenant_id}`, {
                                  plan_type: 'pro',
                                  status: 'active',
                                  days_to_add: 30
                                }, getConfig());
                                setOnboardingSuccess(`Activated PRO plan for ${sub.business_name}!`);
                                await loadDashboard();
                              } catch (err) {
                                logClientError('Override subscription failed', err);
                                setError('Failed to override subscription.');
                              }
                            }}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #2563eb', backgroundColor: '#ffffff', color: '#2563eb', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                          >
                            Grant +30 Days Pro
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#6b7280' }}>
                        No subscription records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Grant Subscription Modal */}
        {showGrantSubModal && (
          <div
            style={{
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
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '28px',
                width: '100%',
                maxWidth: '480px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '20px' }}>Grant Subscription Package</h3>
                <button
                  type="button"
                  onClick={() => setShowGrantSubModal(false)}
                  style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                This is an administrative grant for testing or vendor promotion. It will mark the vendor's subscription status as <strong>Active</strong> and payment status as <strong>Granted</strong> (not real payment).
              </p>

              <form onSubmit={handleGrantSubscription}>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Vendor / Business
                  </label>
                  <input
                    type="text"
                    disabled
                    value={grantTenantName}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#f1f5f9', fontWeight: '600' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '14px' }}>
                    Subscription Package Duration
                  </label>
                  <select
                    value={grantPlanDuration}
                    onChange={(e) => setGrantPlanDuration(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '15px' }}
                  >
                    <option value="monthly">Monthly (30 Days)</option>
                    <option value="3_months">3 Months (90 Days)</option>
                    <option value="6_months">6 Months (180 Days)</option>
                    <option value="yearly">Yearly (365 Days)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowGrantSubModal(false)}
                    style={{ padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: '8px', backgroundColor: '#ffffff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={grantLoading}
                    style={{ padding: '10px 18px', border: 'none', borderRadius: '8px', backgroundColor: '#2563eb', color: '#ffffff', fontWeight: '600', cursor: grantLoading ? 'not-allowed' : 'pointer' }}
                  >
                    {grantLoading ? 'Granting...' : 'Confirm & Grant Package'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
