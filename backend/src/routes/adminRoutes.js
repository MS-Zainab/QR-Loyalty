const express = require('express');
const router = express.Router();

const supabaseAdmin = require('../config/supabaseAdmin');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Get platform admin dashboard
 *     description: Returns overall platform statistics and vendor summary for the platform administrator.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin dashboard retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only platform admins can access this resource
 *       500:
 *         description: Failed to retrieve admin dashboard
 */
router.get(
  '/dashboard',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const [
        { data: tenants, error: tenantsError },
        { count: totalCustomers, error: customersError },
        { count: activeCustomers, error: activeCustomersError },
        { count: totalStamps, error: stampsError },
        { count: totalRewards, error: rewardsError },
        { count: activeRewards, error: activeRewardsError },
        { count: totalRedemptions, error: redemptionsError },
        { count: totalStaff, error: staffError },
        { count: activeStaff, error: activeStaffError }
      ] = await Promise.all([
        supabaseAdmin
          .from('tenants')
          .select('id, business_name, status, created_at')
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('customers')
          .select('id', { count: 'exact', head: true }),
        supabaseAdmin
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabaseAdmin
          .from('stamps')
          .select('id', { count: 'exact', head: true }),
        supabaseAdmin
          .from('rewards')
          .select('id', { count: 'exact', head: true }),
        supabaseAdmin
          .from('rewards')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true),
        supabaseAdmin
          .from('redemptions')
          .select('id', { count: 'exact', head: true }),
        supabaseAdmin
          .from('staff')
          .select('id', { count: 'exact', head: true }),
        supabaseAdmin
          .from('staff')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
      ]);

      const queryErrors = [
        [tenantsError, 'vendor'],
        [customersError, 'customer'],
        [activeCustomersError, 'active customer'],
        [stampsError, 'stamp'],
        [rewardsError, 'reward'],
        [activeRewardsError, 'active reward'],
        [redemptionsError, 'redemption'],
        [staffError, 'staff'],
        [activeStaffError, 'active staff']
      ];
      const failedQuery = queryErrors.find(([error]) => error);

      if (failedQuery) {
        console.error(`Admin dashboard ${failedQuery[1]} query error:`, failedQuery[0]);
        return res.status(500).json({
          success: false,
          message: `Failed to retrieve ${failedQuery[1]} data`
        });
      }

      const activeVendors =
        tenants.filter(
          (tenant) => tenant.status === 'active'
        ).length;

      const heldVendors =
        tenants.filter(
          (tenant) => tenant.status === 'hold'
        ).length;

      const removedVendors =
        tenants.filter(
          (tenant) => tenant.status === 'removed'
        ).length;

      return res.status(200).json({
        success: true,
        message: 'Admin dashboard retrieved successfully',
        dashboard: {
          statistics: {
            total_vendors: tenants.length,
            active_vendors: activeVendors,
            held_vendors: heldVendors,
            removed_vendors: removedVendors,
            total_customers: totalCustomers || 0,
            active_customers: activeCustomers,
            total_stamps: totalStamps || 0,
            total_rewards: totalRewards || 0,
            active_rewards: activeRewards,
            total_redemptions: totalRedemptions || 0,
            total_staff: totalStaff || 0,
            active_staff: activeStaff
          },
          vendors: tenants
        }
      });
    } catch (error) {
      console.error(
        'Admin dashboard error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve admin dashboard'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/vendors:
 *   get:
 *     summary: Get all vendors
 *     description: Returns all vendors with their current status and basic business information for the platform administrator.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor list retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only platform admins can access this resource
 *       500:
 *         description: Failed to retrieve vendors
 */
router.get(
  '/vendors',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data: tenants, error: tenantsError } =
        await supabaseAdmin
          .from('tenants')
          .select(
            'id, business_name, status, created_at, updated_at'
          )
          .order('created_at', { ascending: false });

      if (tenantsError) {
        console.error(
          'Admin vendors query error:',
          tenantsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve vendors'
        });
      }

      const vendorIds = tenants.map(
        (tenant) => tenant.id
      );

      let customerCounts = {};
      let staffCounts = {};
      let rewardCounts = {};

      if (vendorIds.length > 0) {
        const { data: customers, error: customersError } =
          await supabaseAdmin
            .from('customers')
            .select('id, tenant_id, status')
            .in('tenant_id', vendorIds);

        if (customersError) {
          console.error(
            'Admin vendor customers query error:',
            customersError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve vendor customer data'
          });
        }

        const { data: staff, error: staffError } =
          await supabaseAdmin
            .from('staff')
            .select('id, tenant_id, is_active')
            .in('tenant_id', vendorIds);

        if (staffError) {
          console.error(
            'Admin vendor staff query error:',
            staffError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve vendor staff data'
          });
        }

        const { data: rewards, error: rewardsError } =
          await supabaseAdmin
            .from('rewards')
            .select('id, tenant_id, is_active')
            .in('tenant_id', vendorIds);

        if (rewardsError) {
          console.error(
            'Admin vendor rewards query error:',
            rewardsError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve vendor reward data'
          });
        }

        customers.forEach((customer) => {
          if (!customerCounts[customer.tenant_id]) {
            customerCounts[customer.tenant_id] = {
              total: 0,
              active: 0
            };
          }

          customerCounts[customer.tenant_id].total += 1;

          if (customer.status === 'active') {
            customerCounts[customer.tenant_id].active += 1;
          }
        });

        staff.forEach((member) => {
          if (!staffCounts[member.tenant_id]) {
            staffCounts[member.tenant_id] = {
              total: 0,
              active: 0
            };
          }

          staffCounts[member.tenant_id].total += 1;

          if (member.is_active === true) {
            staffCounts[member.tenant_id].active += 1;
          }
        });

        rewards.forEach((reward) => {
          if (!rewardCounts[reward.tenant_id]) {
            rewardCounts[reward.tenant_id] = {
              total: 0,
              active: 0
            };
          }

          rewardCounts[reward.tenant_id].total += 1;

          if (reward.is_active === true) {
            rewardCounts[reward.tenant_id].active += 1;
          }
        });
      }

      const vendors = tenants.map((tenant) => ({
        id: tenant.id,
        business_name: tenant.business_name,
        status: tenant.status,
        created_at: tenant.created_at,
        updated_at: tenant.updated_at,
        statistics: {
          total_customers:
            customerCounts[tenant.id]?.total || 0,
          active_customers:
            customerCounts[tenant.id]?.active || 0,
          total_staff:
            staffCounts[tenant.id]?.total || 0,
          active_staff:
            staffCounts[tenant.id]?.active || 0,
          total_rewards:
            rewardCounts[tenant.id]?.total || 0,
          active_rewards:
            rewardCounts[tenant.id]?.active || 0
        }
      }));

      return res.status(200).json({
        success: true,
        message: 'Vendor list retrieved successfully',
        vendors
      });
    } catch (error) {
      console.error(
        'Admin vendors error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve vendors'
      });
    }
  }
);


/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     summary: Get platform reports
 *     description: Returns platform-level reporting data including vendors, customers, stamps, rewards, redemptions, and staff activity.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Platform reports retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only platform admins can access this resource
 *       500:
 *         description: Failed to retrieve platform reports
 */
router.get(
  '/reports',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const [
        { data: tenants, error: tenantsError },
        { data: customers, error: customersError },
        { data: stamps, error: stampsError },
        { data: rewards, error: rewardsError },
        { data: redemptions, error: redemptionsError },
        { data: staff, error: staffError }
      ] = await Promise.all([
        supabaseAdmin
          .from('tenants')
          .select('id, business_name, status, created_at')
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('customers')
          .select('id, tenant_id, status, created_at'),
        supabaseAdmin
          .from('stamps')
          .select('id, tenant_id, customer_id, staff_id, visit_id, created_at'),
        supabaseAdmin
          .from('rewards')
          .select('id, tenant_id, name, stamps_required, is_active, created_at'),
        supabaseAdmin
          .from('redemptions')
          .select('id, tenant_id, customer_id, reward_id, staff_id, redeemed_at, created_at'),
        supabaseAdmin
          .from('staff')
          .select('id, tenant_id, profile_id, is_active, created_at')
      ]);

      const queryErrors = [
        [tenantsError, 'vendor'],
        [customersError, 'customer'],
        [stampsError, 'stamp'],
        [rewardsError, 'reward'],
        [redemptionsError, 'redemption'],
        [staffError, 'staff']
      ];
      const failedQuery = queryErrors.find(([error]) => error);

      if (failedQuery) {
        console.error(`Admin reports ${failedQuery[1]} query error:`, failedQuery[0]);
        return res.status(500).json({
          success: false,
          message: `Failed to retrieve ${failedQuery[1]} report data`
        });
      }

      const vendorReports = tenants.map((tenant) => {
        const vendorCustomers = customers.filter(
          (customer) =>
            customer.tenant_id === tenant.id
        );

        const vendorStamps = stamps.filter(
          (stamp) =>
            stamp.tenant_id === tenant.id
        );

        const vendorRewards = rewards.filter(
          (reward) =>
            reward.tenant_id === tenant.id
        );

        const vendorRedemptions =
          redemptions.filter(
            (redemption) =>
              redemption.tenant_id === tenant.id
          );

        const vendorStaff = staff.filter(
          (member) =>
            member.tenant_id === tenant.id
        );

        return {
          tenant_id: tenant.id,
          business_name: tenant.business_name,
          status: tenant.status,
          created_at: tenant.created_at,
          statistics: {
            total_customers:
              vendorCustomers.length,

            active_customers:
              vendorCustomers.filter(
                (customer) =>
                  customer.status === 'active'
              ).length,

            total_stamps:
              vendorStamps.length,

            total_rewards:
              vendorRewards.length,

            active_rewards:
              vendorRewards.filter(
                (reward) =>
                  reward.is_active === true
              ).length,

            total_redemptions:
              vendorRedemptions.length,

            total_staff:
              vendorStaff.length,

            active_staff:
              vendorStaff.filter(
                (member) =>
                  member.is_active === true
              ).length
          }
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Platform reports retrieved successfully',
        report: {
          generated_at: new Date().toISOString(),

          platform_summary: {
            total_vendors: tenants.length,

            active_vendors:
              tenants.filter(
                (tenant) =>
                  tenant.status === 'active'
              ).length,

            held_vendors:
              tenants.filter(
                (tenant) =>
                  tenant.status === 'hold'
              ).length,

            removed_vendors:
              tenants.filter(
                (tenant) =>
                  tenant.status === 'removed'
              ).length,

            total_customers:
              customers.length,

            active_customers:
              customers.filter(
                (customer) =>
                  customer.status === 'active'
              ).length,

            total_stamps:
              stamps.length,

            total_rewards:
              rewards.length,

            active_rewards:
              rewards.filter(
                (reward) =>
                  reward.is_active === true
              ).length,

            total_redemptions:
              redemptions.length,

            total_staff:
              staff.length,

            active_staff:
              staff.filter(
                (member) =>
                  member.is_active === true
              ).length
          },

          vendors: vendorReports
        }
      });
    } catch (error) {
      console.error(
        'Admin reports error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve platform reports'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/reports/monthly:
 *   get:
 *     summary: Get detailed monthly report for a tenant (Admin only)
 *     description: Returns monthly tenant metrics, daily visit breakdown, customer frequency, and loyalty activity for a selected tenant and month.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tenant_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: string
 *           example: "2026-09"
 *     responses:
 *       200:
 *         description: Monthly tenant report retrieved successfully
 *       400:
 *         description: Missing or invalid parameters
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only platform admins can access this resource
 *       404:
 *         description: Tenant not found
 *       500:
 *         description: Failed to generate monthly report
 */
router.get(
  '/reports/monthly',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { tenant_id, month } = req.query;

      if (!tenant_id || !month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Valid tenant_id (UUID) and month (YYYY-MM) are required'
        });
      }

      // Fetch tenant
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, status, created_at')
        .eq('id', tenant_id)
        .single();

      if (tenantError || !tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1; // 0-indexed month

      const startDate = new Date(Date.UTC(year, monthIdx, 1, 0, 0, 0, 0));
      const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
      const endDate = new Date(Date.UTC(year, monthIdx, daysInMonth, 23, 59, 59, 999));

      const startIso = startDate.toISOString();
      const endIso = endDate.toISOString();

      // Parallel queries for selected tenant within time frame & baseline
      const [
        { data: visits, error: visitsError },
        { data: allTenantCustomers, error: customersError },
        { data: monthStamps, error: stampsError },
        { data: monthRedemptions, error: redemptionsError },
        { data: loyaltyProgram }
      ] = await Promise.all([
        supabaseAdmin
          .from('visits')
          .select('id, customer_id, visited_at')
          .eq('tenant_id', tenant_id)
          .gte('visited_at', startIso)
          .lte('visited_at', endIso)
          .order('visited_at', { ascending: true }),
        supabaseAdmin
          .from('customers')
          .select('id, name, created_at')
          .eq('tenant_id', tenant_id),
        supabaseAdmin
          .from('stamps')
          .select('id, customer_id, created_at')
          .eq('tenant_id', tenant_id)
          .gte('created_at', startIso)
          .lte('created_at', endIso),
        supabaseAdmin
          .from('redemptions')
          .select('id, customer_id, reward_id, redeemed_at, created_at')
          .eq('tenant_id', tenant_id)
          .gte('created_at', startIso)
          .lte('created_at', endIso),
        supabaseAdmin
          .from('loyalty_programs')
          .select('id, name, stamps_required, reward_description, is_active')
          .eq('tenant_id', tenant_id)
          .eq('is_active', true)
          .maybeSingle()
      ]);

      if (visitsError || customersError || stampsError || redemptionsError) {
        console.error('Monthly report queries error:', visitsError || customersError || stampsError || redemptionsError);
        return res.status(500).json({
          success: false,
          message: 'Failed to query tenant monthly data'
        });
      }

      // Fetch customer earliest visit date prior to or within month to determine repeat visits vs new customers
      const { data: allPriorVisits } = await supabaseAdmin
        .from('visits')
        .select('customer_id, visited_at')
        .eq('tenant_id', tenant_id)
        .lt('visited_at', startIso);

      const priorCustomerSet = new Set((allPriorVisits || []).map((v) => v.customer_id));

      const totalVisits = (visits || []).length;
      const visitedCustomerIds = new Set((visits || []).map((v) => v.customer_id));
      const uniqueCustomersCount = visitedCustomerIds.size;

      // Repeat visits: visits after the customer's first visit within the reporting period or customers who visited prior
      let repeatVisits = 0;
      const seenCustomerInPeriod = new Set();
      for (const visit of (visits || [])) {
        if (priorCustomerSet.has(visit.customer_id) || seenCustomerInPeriod.has(visit.customer_id)) {
          repeatVisits += 1;
        } else {
          seenCustomerInPeriod.add(visit.customer_id);
        }
      }

      // New customers: customers whose account created_at or first visit falls within the selected month
      const newCustomers = (allTenantCustomers || []).filter((c) => {
        const cDate = new Date(c.created_at);
        return cDate >= startDate && cDate <= endDate;
      }).length;

      const avgVisitsPerCustomer = uniqueCustomersCount > 0
        ? Number((totalVisits / uniqueCustomersCount).toFixed(2))
        : 0;

      // Daily Breakdown for every day in the month
      const dailyMap = new Map();
      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
        dailyMap.set(dayStr, {
          date: dayStr,
          visits: 0,
          unique_customers: 0,
          uniqueCustomerSet: new Set(),
          stamps: 0,
          redemptions: 0
        });
      }

      for (const visit of (visits || [])) {
        const dayStr = visit.visited_at.slice(0, 10);
        if (dailyMap.has(dayStr)) {
          const entry = dailyMap.get(dayStr);
          entry.visits += 1;
          entry.uniqueCustomerSet.add(visit.customer_id);
        }
      }

      for (const stamp of (monthStamps || [])) {
        const dayStr = stamp.created_at.slice(0, 10);
        if (dailyMap.has(dayStr)) {
          dailyMap.get(dayStr).stamps += 1;
        }
      }

      for (const redemption of (monthRedemptions || [])) {
        const rDate = redemption.redeemed_at || redemption.created_at;
        const dayStr = rDate ? rDate.slice(0, 10) : '';
        if (dailyMap.has(dayStr)) {
          dailyMap.get(dayStr).redemptions += 1;
        }
      }

      const dailyBreakdown = Array.from(dailyMap.values()).map((entry) => ({
        date: entry.date,
        visits: entry.visits,
        unique_customers: entry.uniqueCustomerSet.size,
        stamps: entry.stamps,
        redemptions: entry.redemptions
      }));

      // Peak & Lowest Visit Day calculation
      let peakDay = { date: '-', visits: 0 };
      let lowestDay = { date: '-', visits: Infinity };

      for (const day of dailyBreakdown) {
        if (day.visits > peakDay.visits) {
          peakDay = { date: day.date, visits: day.visits };
        }
        if (day.visits < lowestDay.visits) {
          lowestDay = { date: day.date, visits: day.visits };
        }
      }
      if (lowestDay.visits === Infinity) {
        lowestDay = { date: dailyBreakdown[0]?.date || '-', visits: 0 };
      }

      // Customer Visit Frequency (Top customers by visit count in period, with safe masked names/ids)
      const customerVisitCounts = new Map();
      const customerNameMap = new Map((allTenantCustomers || []).map((c) => [c.id, c.name]));

      for (const visit of (visits || [])) {
        const count = customerVisitCounts.get(visit.customer_id) || 0;
        customerVisitCounts.set(visit.customer_id, count + 1);
      }

      const customerFrequency = Array.from(customerVisitCounts.entries())
        .map(([customerId, visitsCount]) => ({
          customer_identifier: `Customer ${customerId.slice(0, 6)}... (${customerNameMap.get(customerId) || 'Member'})`,
          visits: visitsCount
        }))
        .sort((a, b) => b.visits - a.visits);

      return res.status(200).json({
        success: true,
        report: {
          business_name: tenant.business_name,
          tenant_id: tenant.id,
          report_month: month,
          summary: {
            total_visits: totalVisits,
            unique_customers: uniqueCustomersCount,
            repeat_visits: repeatVisits,
            new_customers: newCustomers,
            avg_visits_per_customer: avgVisitsPerCustomer,
            stamps_issued: (monthStamps || []).length,
            rewards_redeemed: (monthRedemptions || []).length,
            peak_visit_day: peakDay,
            lowest_visit_day: lowestDay
          },
          daily_breakdown: dailyBreakdown,
          customer_frequency: customerFrequency,
          loyalty_program_status: loyaltyProgram || { status: 'No active loyalty program' }
        }
      });
    } catch (error) {
      console.error('Admin monthly report error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate monthly report'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/reports/export:
 *   get:
 *     summary: Export platform reports
 *     description: Downloads the platform report as a CSV file for the platform administrator.
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV report file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only platform admins can access this resource
 *       500:
 *         description: Failed to export platform reports
 */
router.get(
  '/reports/export',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data: tenants, error: tenantsError } =
        await supabaseAdmin
          .from('tenants')
          .select('id, business_name, status, created_at')
          .order('created_at', { ascending: false });

      if (tenantsError) {
        console.error(
          'Admin export tenants error:',
          tenantsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve vendor data'
        });
      }

      const { data: customers, error: customersError } =
        await supabaseAdmin
          .from('customers')
          .select('id, tenant_id, status');

      if (customersError) {
        console.error(
          'Admin export customers error:',
          customersError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve customer data'
        });
      }

      const { data: stamps, error: stampsError } =
        await supabaseAdmin
          .from('stamps')
          .select('id, tenant_id');

      if (stampsError) {
        console.error(
          'Admin export stamps error:',
          stampsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve stamp data'
        });
      }

      const { data: rewards, error: rewardsError } =
        await supabaseAdmin
          .from('rewards')
          .select('id, tenant_id, is_active');

      if (rewardsError) {
        console.error(
          'Admin export rewards error:',
          rewardsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve reward data'
        });
      }

      const { data: redemptions, error: redemptionsError } =
        await supabaseAdmin
          .from('redemptions')
          .select('id, tenant_id');

      if (redemptionsError) {
        console.error(
          'Admin export redemptions error:',
          redemptionsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve redemption data'
        });
      }

      const { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id, tenant_id, is_active');

      if (staffError) {
        console.error(
          'Admin export staff error:',
          staffError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff data'
        });
      }

      const escapeCsv = (value) => {
        if (value === null || value === undefined) {
          return '';
        }

        const stringValue = String(value);

        if (
          stringValue.includes(',') ||
          stringValue.includes('"') ||
          stringValue.includes('\n')
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }

        return stringValue;
      };

      const headers = [
        'Vendor ID',
        'Business Name',
        'Vendor Status',
        'Created At',
        'Total Customers',
        'Active Customers',
        'Total Stamps',
        'Total Rewards',
        'Active Rewards',
        'Total Redemptions',
        'Total Staff',
        'Active Staff'
      ];

      const rows = tenants.map((tenant) => {
        const vendorCustomers =
          customers.filter(
            (customer) =>
              customer.tenant_id === tenant.id
          );

        const vendorStamps =
          stamps.filter(
            (stamp) =>
              stamp.tenant_id === tenant.id
          );

        const vendorRewards =
          rewards.filter(
            (reward) =>
              reward.tenant_id === tenant.id
          );

        const vendorRedemptions =
          redemptions.filter(
            (redemption) =>
              redemption.tenant_id === tenant.id
          );

        const vendorStaff =
          staff.filter(
            (member) =>
              member.tenant_id === tenant.id
          );

        return [
          tenant.id,
          tenant.business_name,
          tenant.status,
          tenant.created_at,
          vendorCustomers.length,
          vendorCustomers.filter(
            (customer) =>
              customer.status === 'active'
          ).length,
          vendorStamps.length,
          vendorRewards.length,
          vendorRewards.filter(
            (reward) =>
              reward.is_active === true
          ).length,
          vendorRedemptions.length,
          vendorStaff.length,
          vendorStaff.filter(
            (member) =>
              member.is_active === true
          ).length
        ];
      });

      const csv = [
        headers.map(escapeCsv).join(','),
        ...rows.map((row) =>
          row.map(escapeCsv).join(',')
        )
      ].join('\n');

      const fileName = `qr-loyalty-platform-report-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

      res.setHeader(
        'Content-Type',
        'text/csv; charset=utf-8'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`
      );

      return res.status(200).send(csv);
    } catch (error) {
      console.error(
        'Admin report export error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to export platform reports'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: Get all tenant subscriptions for Admin
 */
router.get(
  '/subscriptions',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data: tenants } = await supabaseAdmin
        .from('tenants')
        .select('id, business_name, status, created_at')
        .order('created_at', { ascending: false });

      const { data: subscriptions } = await supabaseAdmin
        .from('subscriptions')
        .select('*');

      const subMap = new Map((subscriptions || []).map((sub) => [sub.tenant_id, sub]));

      const tenantSubscriptions = (tenants || []).map((t) => {
        const sub = subMap.get(t.id);
        const createdAt = new Date(t.created_at || Date.now());
        const trialEnds = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
        const daysLeft = sub?.current_period_end
          ? Math.max(0, Math.ceil((new Date(sub.current_period_end) - new Date()) / (1000 * 60 * 60 * 24)))
          : Math.max(0, Math.ceil((trialEnds - new Date()) / (1000 * 60 * 60 * 24)));

        return {
          tenant_id: t.id,
          business_name: t.business_name,
          tenant_status: t.status,
          plan_type: sub?.plan_type || 'trial',
          status: sub?.status || (daysLeft > 0 ? 'active' : 'expired'),
          amount_paid: sub?.amount_paid || 0,
          billing_cycle: sub?.billing_cycle || 'monthly',
          days_left: daysLeft,
          current_period_end: sub?.current_period_end || trialEnds.toISOString()
        };
      });

      const totalPaid = tenantSubscriptions.filter((s) => s.plan_type !== 'trial' && s.status === 'active').length;
      const totalTrial = tenantSubscriptions.filter((s) => s.plan_type === 'trial' && s.status === 'active').length;
      const totalExpired = tenantSubscriptions.filter((s) => s.status === 'expired').length;

      return res.status(200).json({
        success: true,
        summary: {
          total_paid_tenants: totalPaid,
          active_trials: totalTrial,
          expired_subscriptions: totalExpired
        },
        subscriptions: tenantSubscriptions
      });
    } catch (error) {
      console.error('Admin subscriptions error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve subscription data'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/subscriptions/{tenantId}:
 *   patch:
 *     summary: Override tenant subscription plan
 */
router.patch(
  '/subscriptions/:tenantId',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { plan_type, status, days_to_add = 30 } = req.body || {};

      const periodEnd = new Date(Date.now() + days_to_add * 24 * 60 * 60 * 1000).toISOString();

      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_type: plan_type || 'pro',
            status: status || 'active',
            current_period_end: periodEnd,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabaseAdmin
          .from('subscriptions')
          .insert({
            tenant_id: tenantId,
            plan_type: plan_type || 'pro',
            status: status || 'active',
            current_period_end: periodEnd
          });
      }

      if (status === 'active') {
        await supabaseAdmin.from('tenants').update({ status: 'ACTIVE' }).eq('id', tenantId);
      }

      return res.status(200).json({
        success: true,
        message: 'Tenant subscription updated successfully'
      });
    } catch (error) {
      console.error('Admin subscription patch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update tenant subscription'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/password-resets:
 *   get:
 *     summary: Get all password reset requests
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/password-resets',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('password_reset_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch password reset requests error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch password reset requests'
        });
      }

      return res.status(200).json({
        success: true,
        requests: data || []
      });
    } catch (error) {
      console.error('Fetch password reset requests error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch password reset requests'
      });
    }
  }
);

/**
 * @swagger
 * /api/admin/password-resets/{id}/reset:
 *   post:
 *     summary: Reset password for a request
 *     tags:
 *       - Admin
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/password-resets/:id/reset',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { new_password } = req.body;

      if (!new_password) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }

      const { data: request, error: reqError } = await supabaseAdmin
        .from('password_reset_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (reqError || !request) {
        return res.status(404).json({
          success: false,
          message: 'Password reset request not found'
        });
      }

      // Find user in auth
      const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
      if (usersError) throw usersError;

      const user = usersData.users.find(u => u.email === request.email);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found in authentication system'
        });
      }

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: new_password
      });

      if (updateError) throw updateError;

      // Mark request as completed
      await supabaseAdmin
        .from('password_reset_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id);

      return res.status(200).json({
        success: true,
        message: 'Password has been reset successfully'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to reset password'
      });
    }
  }
);

module.exports = router;
