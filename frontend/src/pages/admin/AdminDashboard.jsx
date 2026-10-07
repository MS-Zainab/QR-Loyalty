import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { logClientError } from '../../services/logging';
import { copyToClipboard } from '../../utils/clipboard';
import { theme, cardStyle } from '../../theme';
import StatCard from '../../components/StatCard';
import StatusBadge from '../../components/StatusBadge';
import SectionCard from '../../components/SectionCard';
import './AdminDashboard.css';

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
  const [customSlug, setCustomSlug] = useState('');
  const [ownerFullName, setOwnerFullName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardSuccess, setOnboardSuccess] = useState('');
  const [createdBrandedUrl, setCreatedBrandedUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Admin Monthly Tenant Report State
  const [selectedReportTenantId, setSelectedReportTenantId] = useState('');
  const [selectedReportMonth, setSelectedReportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [monthlyReportData, setMonthlyReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDownloadFormat, setReportDownloadFormat] = useState('csv');
  const [reportDownloading, setReportDownloading] = useState(false);

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

  // Slug Edit State
  const [showSlugModal, setShowSlugModal] = useState(false);
  const [slugTenantId, setSlugTenantId] = useState('');
  const [slugTenantName, setSlugTenantName] = useState('');
  const [slugInput, setSlugInput] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError] = useState('');

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

      // Validate custom slug if provided
      let payload = { business_name: businessName.trim() };
      if (customSlug && customSlug.trim()) {
        const trimmedSlug = customSlug.trim();

        // Client-side validation
        if (!/^[a-z0-9-]{2,60}$/.test(trimmedSlug)) {
          setError('Slug must be 2-60 characters with lowercase letters, digits, and hyphens only.');
          setOnboardLoading(false);
          return;
        }
        if (trimmedSlug.startsWith('-') || trimmedSlug.endsWith('-')) {
          setError('Slug cannot start or end with a hyphen.');
          setOnboardLoading(false);
          return;
        }

        payload.slug = trimmedSlug;
      }

      // Step 1: Create Tenant
      const tenantRes = await api.post('/tenants', payload, config);
      const createdTenant = tenantRes.data?.tenant;
      const generatedSlug = tenantRes.data?.slug || createdTenant?.slug;

      if (!createdTenant?.id) {
        throw new Error('Failed to create tenant record.');
      }

      // Build branded URL using current origin (works for localhost and production)
      const brandedUrl = generatedSlug ? `${window.location.origin}/v/${generatedSlug}` : '';
      setCreatedBrandedUrl(brandedUrl);

      // Step 2: Create Vendor Owner
      await api.post(`/tenants/${createdTenant.id}/owner`, {
        email: ownerEmail.trim(),
        password: ownerPassword,
        full_name: ownerFullName.trim()
      }, config);

      setOnboardSuccess(`Tenant "${businessName}" & owner "${ownerFullName}" onboarded successfully!`);
      setBusinessName('');
      setCustomSlug('');
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

  const openSlugModal = (tenant) => {
    setSlugTenantId(tenant.id);
    setSlugTenantName(tenant.business_name);
    setSlugInput(tenant.slug || '');
    setSlugError('');
    setShowSlugModal(true);
  };

  const handleSaveSlug = async (e) => {
    if (e) e.preventDefault();
    setSlugError('');

    if (!slugInput.trim()) {
      setSlugError('Slug cannot be empty.');
      return;
    }

    const trimmedSlug = slugInput.trim();

    // Validate format
    if (!/^[a-z0-9-]{2,60}$/.test(trimmedSlug)) {
      setSlugError('Slug must be 2-60 characters, containing only lowercase letters, digits, and hyphens.');
      return;
    }

    if (trimmedSlug.startsWith('-') || trimmedSlug.endsWith('-')) {
      setSlugError('Slug cannot start or end with a hyphen.');
      return;
    }

    try {
      setSlugSaving(true);
      await api.patch(`/tenants/${slugTenantId}/slug`, { slug: trimmedSlug }, getConfig());
      setShowSlugModal(false);
      await loadDashboard();
    } catch (err) {
      logClientError('Update tenant slug failed', err);
      setSlugError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        'Failed to update tenant slug.'
      );
    } finally {
      setSlugSaving(false);
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

  const handleDownloadMonthlyReport = async () => {
    if (reportDownloading) return;
    if (!selectedReportTenantId) {
      setError('Please select a tenant to download the monthly report.');
      return;
    }
    if (!selectedReportMonth) {
      setError('Please select a month for the report.');
      return;
    }

    try {
      setReportDownloading(true);
      setError('');
      const res = await api.get(
        `/admin/reports/monthly?tenant_id=${selectedReportTenantId}&month=${selectedReportMonth}&format=${reportDownloadFormat}`,
        { ...getConfig(), responseType: 'blob' }
      );

      const blob = new Blob([res.data], {
        type: reportDownloadFormat === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-loyalty-report-${selectedReportMonth}.${reportDownloadFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      logClientError('Failed to download monthly report', err);

      let backendMessage = '';
      try {
        if (err?.response?.data instanceof Blob && typeof err.response.data.text === 'function') {
          const parsed = JSON.parse(await err.response.data.text());
          backendMessage = parsed?.message || parsed?.error || '';
        } else if (err?.response?.data && typeof err.response.data === 'object') {
          backendMessage = err.response.data.message || err.response.data.error || '';
        }
      } catch {
        backendMessage = '';
      }

      setError(
        backendMessage && err?.response?.status && err.response.status < 500
          ? backendMessage
          : 'Unable to download the report. Please try again.'
      );
    } finally {
      setReportDownloading(false);
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
    <div className="admin-dashboard">
      {/* Header */}
      <header className="admin-header">
        <div>
          <h1 className="admin-title">
            Admin Dashboard
          </h1>

          <p className="admin-subtitle">
            Welcome,{' '}
            {profile?.full_name ||
              profile?.name ||
              'QR Loyalty Admin'}
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="btn-danger"
        >
          Logout
        </button>
      </header>

      {/* Navigation */}
      <nav className="admin-nav">
        {[
          ['overview', 'Overview'],
          ['vendors', 'Vendors'],
          ['reports', 'Reports'],
          ['subscriptions', 'Subscriptions & Billing']
        ].map(([key, label]) => (
          <button
            key={key}
            className={`nav-tab ${activeSection === key ? 'active' : ''}`}
            onClick={() =>
              setActiveSection(key)
            }
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
          <section className="admin-section">
            <h2 className="section-title">Platform Overview</h2>

            <div className="stats-grid">
              <StatCard
                title="Total Vendors"
                value={totalVendors}
                icon="🏪"
                color="primary"
              />
              <StatCard
                title="Active Vendors"
                value={activeVendors}
                icon="✓"
                color="success"
              />
              <StatCard
                title="Vendors on Hold"
                value={holdVendors}
                icon="⏸"
                color="warning"
              />
              <StatCard
                title="Removed Vendors"
                value={removedVendors}
                icon="✕"
                color="error"
              />
              <StatCard
                title="Total Customers"
                value={totalCustomers}
                icon="👥"
                color="primary"
              />
              <StatCard
                title="Total Stamps"
                value={totalStamps}
                icon="⭐"
                color="reward"
              />
              <StatCard
                title="Total Rewards"
                value={totalRewards}
                icon="🎁"
                color="reward"
              />
              <StatCard
                title="Total Redemptions"
                value={totalRedemptions}
                icon="✓"
                color="success"
              />
            </div>

            <SectionCard title="Vendor Status Summary">
              {Array.isArray(
                vendorStatusSummary
              ) &&
              vendorStatusSummary.length > 0 ? (
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
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
                              <td>
                                <StatusBadge status={String(status)} />
                              </td>

                              <td>
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
                <p className="empty-state-text">
                  No vendor status data available.
                </p>
              )}
            </SectionCard>
          </section>
        )}

        {/* VENDORS */}
        {activeSection === 'vendors' && (
          <section className="admin-section">
            <div className="section-header">
              <h2 className="section-title">Vendors</h2>

              <div className="button-group">
                <button
                  onClick={() => {
                    setError('');
                    setOnboardSuccess('');
                    setShowAddTenantModal(true);
                  }}
                  className="btn-primary"
                >
                  + Add New Tenant
                </button>

                <button
                  onClick={loadDashboard}
                  className="btn-secondary"
                >
                  Refresh
                </button>
              </div>
            </div>

            {onboardSuccess && (
              <div className="success-message">
                {onboardSuccess}
              </div>
            )}

            {createdBrandedUrl && (
              <div className="branded-url-box">
                <div className="branded-url-label">
                  Branded Customer URL:
                </div>
                <div className="branded-url-content">
                  <code className="branded-url-code">
                    {createdBrandedUrl}
                  </code>
                  <button
                    onClick={async () => {
                      const success = await copyToClipboard(createdBrandedUrl);
                      if (success) {
                        setCopySuccess(true);
                        setTimeout(() => setCopySuccess(false), 2000);
                      }
                    }}
                    className={`btn-small ${copySuccess ? 'btn-success' : 'btn-primary'}`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy URL'}
                  </button>
                </div>
              </div>
            )}

            <div className="table-container">
              {vendors.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Business Name</th>
                      <th>Status</th>
                      <th>Slug</th>
                      <th>Branded URL</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {vendors.map(
                      (vendor, index) => {
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
                            <td className="vendor-name-cell">
                              {String(
                                businessName
                              )}
                            </td>

                            <td>
                              <StatusBadge status={String(status)} />
                            </td>

                            <td className="slug-cell">
                              {vendor?.slug || '—'}
                            </td>

                            <td className="branded-url-cell">
                              {vendor?.slug ? (
                                <div className="url-copy-row">
                                  <code className="url-code">
                                    {window.location.origin}/v/{vendor.slug}
                                  </code>
                                  <button
                                    onClick={async () => {
                                      const url = `${window.location.origin}/v/${vendor.slug}`;
                                      await copyToClipboard(url);
                                    }}
                                    className="btn-icon"
                                    title="Copy URL"
                                  >
                                    Copy
                                  </button>
                                </div>
                              ) : (
                                <span className="no-slug">No slug set</span>
                              )}
                            </td>

                            <td>
                              {formatDate(
                                createdAt
                              )}
                            </td>

                            <td>
                              {vendorId ? (
                                <div className="action-buttons">
                                  {status !==
                                    'active' && (
                                    <button
                                      onClick={() =>
                                        updateVendorStatus(
                                          vendorId,
                                          'active'
                                        )
                                      }
                                      className="btn-activate"
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
                                      className="btn-hold"
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
                                      className="btn-remove"
                                    >
                                      Remove
                                    </button>
                                  )}

                                  <button
                                    onClick={() => openSlugModal(vendor)}
                                    className="btn-slug"
                                  >
                                    {vendor?.slug ? 'Edit Slug' : 'Set Slug'}
                                  </button>
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
                <div className="empty-state">
                  No vendors found.
                </div>
              )}
            </div>
            {/* Tenant Onboarding Modal */}
            {showAddTenantModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <h3 className="modal-title">
                    Onboard New Vendor Tenant
                  </h3>
                  <p className="modal-subtitle">
                    Create a new business tenant and configure its vendor owner credentials.
                  </p>

                  <form onSubmit={handleAddTenant} className="modal-form">
                    <div className="form-group">
                      <label className="form-label">Business Name</label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => {
                          setBusinessName(e.target.value);
                          // Auto-generate slug preview if custom slug is empty
                          if (!customSlug.trim()) {
                            const autoSlug = e.target.value
                              .toLowerCase()
                              .trim()
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/^-|-$/g, '')
                              .slice(0, 60);
                            setCustomSlug(autoSlug);
                          }
                        }}
                        placeholder="e.g. Express Coffee Bar"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        Branded Slug (optional)
                      </label>
                      <input
                        type="text"
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value)}
                        placeholder="e.g., express-coffee-bar"
                        className="form-input monospace"
                      />
                      {customSlug && (
                        <p className="form-hint">
                          Preview: <code className="url-preview">{window.location.origin}/v/{customSlug}</code>
                        </p>
                      )}
                      <p className="form-help">
                        Lowercase letters, digits, hyphens only • 2-60 characters • leave empty to auto-generate
                      </p>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Owner Full Name</label>
                      <input
                        type="text"
                        value={ownerFullName}
                        onChange={(e) => setOwnerFullName(e.target.value)}
                        placeholder="e.g. Alex Rivera"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Owner Email Address</label>
                      <input
                        type="email"
                        value={ownerEmail}
                        onChange={(e) => setOwnerEmail(e.target.value)}
                        placeholder="owner@expresscoffee.com"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Initial Owner Password</label>
                      <input
                        type="password"
                        value={ownerPassword}
                        onChange={(e) => setOwnerPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        className="form-input"
                      />
                    </div>

                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={() => setShowAddTenantModal(false)}
                        className="btn-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={onboardLoading}
                        className="btn-primary"
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
          <section className="admin-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Reports</h2>
                <p className="section-subtitle">
                  Platform Admin Official Monthly Tenant Report Generator
                </p>
              </div>

              <button
                onClick={downloadReports}
                className="btn-secondary"
              >
                Export Platform CSV
              </button>
            </div>

            {/* Monthly Tenant Report Generator Form */}
            <SectionCard title="Generate Tenant Monthly Report">
              <form onSubmit={handleGenerateMonthlyReport} className="inline-form">
                <div className="form-group-inline">
                  <label className="form-label">Select Tenant</label>
                  <select
                    value={selectedReportTenantId}
                    onChange={(e) => setSelectedReportTenantId(e.target.value)}
                    required
                    className="form-input"
                  >
                    <option value="">-- Choose Vendor Tenant --</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.business_name || v.name} ({v.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group-inline">
                  <label className="form-label">Select Month</label>
                  <input
                    type="month"
                    value={selectedReportMonth}
                    onChange={(e) => setSelectedReportMonth(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group-inline">
                  <label className="form-label">Download Format</label>
                  <select
                    value={reportDownloadFormat}
                    onChange={(e) => setReportDownloadFormat(e.target.value)}
                    className="form-input"
                  >
                    <option value="csv">CSV</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={reportLoading || !selectedReportTenantId}
                  className="btn-primary"
                >
                  {reportLoading ? 'Generating...' : 'Generate Report'}
                </button>

                <button
                  type="button"
                  onClick={handleDownloadMonthlyReport}
                  disabled={reportDownloading || !selectedReportTenantId || !selectedReportMonth}
                  className="btn-success"
                >
                  {reportDownloading ? 'Downloading...' : 'Download Report'}
                </button>
              </form>
            </SectionCard>

            {/* Generated Monthly Report Preview */}
            {monthlyReportData && (
              <SectionCard>
                <div className="report-header">
                  <div>
                    <h3 className="report-title">
                      {monthlyReportData.business_name} — Monthly Report ({monthlyReportData.report_month})
                    </h3>
                    <p className="report-subtitle">
                      Official Tenant Analytics & Activity Summary
                    </p>
                  </div>

                  <button
                    onClick={downloadMonthlyReportCsv}
                    className="btn-success"
                  >
                    <span>↓</span> Download CSV
                  </button>
                </div>

                {/* Report Key Metrics Grid */}
                <div className="stats-grid">
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
                    <div key={label} className="metric-card">
                      <span className="metric-label">{label}</span>
                      <h4 className="metric-value">{String(val)}</h4>
                    </div>
                  ))}
                </div>

                {/* Daily Breakdown Table */}
                <h4 className="table-title">Daily Visit Breakdown</h4>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Visits</th>
                        <th>Unique Customers</th>
                        <th>Stamps</th>
                        <th>Redemptions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monthlyReportData.daily_breakdown || []).map((row) => (
                        <tr key={row.date}>
                          <td>{row.date}</td>
                          <td className="text-center">{row.visits}</td>
                          <td className="text-center">{row.unique_customers}</td>
                          <td className="text-center">{row.stamps}</td>
                          <td className="text-center">{row.redemptions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Customer Visit Frequency */}
                <h4 className="table-title">Customer Visit Frequency</h4>
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Customer Identifier</th>
                        <th className="text-right">Visits in Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(monthlyReportData.customer_frequency || []).length > 0 ? (
                        monthlyReportData.customer_frequency.map((item, idx) => (
                          <tr key={idx}>
                            <td>{item.customer_identifier}</td>
                            <td className="text-right highlight">{item.visits} visits</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={2} className="empty-cell">
                            No customer visit activity recorded in this month.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* Platform Overview Reports */}
            <SectionCard title="Platform Vendors Summary">
              {reports.length > 0 ? (
                <div className="table-wrapper">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Customers</th>
                        <th>Stamps</th>
                        <th>Rewards</th>
                        <th>Redemptions</th>
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
                              <td>{String(vendorName)}</td>
                              <td>{String(customers)}</td>
                              <td>{String(stamps)}</td>
                              <td>{String(rewards)}</td>
                              <td>{String(redemptions)}</td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  No reports available.
                </div>
              )}
            </SectionCard>
          </section>
        )}

        {/* SUBSCRIPTIONS */}
        {activeSection === 'subscriptions' && (
          <section className="admin-section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Tenant Subscriptions & Billing</h2>
                <p className="section-subtitle">
                  Monitor paid subscriptions, active trial periods, and override tenant plans.
                </p>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="stats-grid">
              <StatCard
                title="ACTIVE PAID TENANTS"
                value={subSummary?.total_paid_tenants ?? 0}
                color="success"
              />
              <StatCard
                title="ACTIVE TRIALS"
                value={subSummary?.active_trials ?? 0}
                color="primary"
              />
              <StatCard
                title="EXPIRED SUBSCRIPTIONS"
                value={subSummary?.expired_subscriptions ?? 0}
                color="error"
              />
            </div>

            {/* Tenant Subscriptions Table */}
            <SectionCard>
              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Business Name</th>
                      <th>Plan Type</th>
                      <th>Status</th>
                      <th>Days Remaining</th>
                      <th>Amount Paid</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.length > 0 ? (
                      subscriptions.map((sub) => (
                        <tr key={sub.tenant_id}>
                          <td className="vendor-name-cell">{sub.business_name}</td>
                          <td>
                            <span className="plan-badge">{sub.plan_type}</span>
                          </td>
                          <td>
                            <StatusBadge status={String(sub.status)} />
                          </td>
                          <td>{sub.days_left} Days</td>
                          <td>${sub.amount_paid}.00</td>
                          <td>
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
                              className="btn-small btn-outline"
                            >
                              Grant +30 Days Pro
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="empty-cell">
                          No subscription records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </section>
        )}

        {/* Grant Subscription Modal */}
        {showGrantSubModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Grant Subscription Package</h3>
                <button
                  type="button"
                  onClick={() => setShowGrantSubModal(false)}
                  className="btn-close"
                >
                  ✕
                </button>
              </div>

              <p className="modal-description">
                This is an administrative grant for testing or vendor promotion. It will mark the vendor's subscription status as <strong>Active</strong> and payment status as <strong>Granted</strong> (not real payment).
              </p>

              <form onSubmit={handleGrantSubscription} className="modal-form">
                <div className="form-group">
                  <label className="form-label">
                    Vendor / Business
                  </label>
                  <input
                    type="text"
                    disabled
                    value={grantTenantName}
                    className="form-input disabled"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Subscription Package Duration
                  </label>
                  <select
                    value={grantPlanDuration}
                    onChange={(e) => setGrantPlanDuration(e.target.value)}
                    className="form-input"
                  >
                    <option value="monthly">Monthly (30 Days)</option>
                    <option value="3_months">3 Months (90 Days)</option>
                    <option value="6_months">6 Months (180 Days)</option>
                    <option value="yearly">Yearly (365 Days)</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowGrantSubModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={grantLoading}
                    className="btn-primary"
                  >
                    {grantLoading ? 'Granting...' : 'Confirm & Grant Package'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Slug Edit Modal */}
        {showSlugModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">{slugTenantName ? `Set Slug for ${slugTenantName}` : 'Set Tenant Slug'}</h3>
                <button
                  type="button"
                  onClick={() => setShowSlugModal(false)}
                  className="btn-close"
                >
                  ✕
                </button>
              </div>

              <p className="modal-description">
                This slug will be used in the customer-facing URL: <code className="url-preview">{window.location.origin}/v/your-slug</code>
              </p>

              <form onSubmit={handleSaveSlug} className="modal-form">
                <div className="form-group">
                  <label className="form-label">
                    Branded Slug
                  </label>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    placeholder="e.g., test-cafe-hyderabad"
                    disabled={slugSaving}
                    className="form-input monospace"
                  />
                  <p className="form-help">
                    Rules: lowercase letters, digits, hyphens only • 2-60 characters • cannot start/end with hyphen • must be unique
                  </p>
                </div>

                {slugError && (
                  <div className="error-message">
                    {slugError}
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowSlugModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={slugSaving}
                    className="btn-primary"
                  >
                    {slugSaving ? 'Saving...' : 'Save Slug'}
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
