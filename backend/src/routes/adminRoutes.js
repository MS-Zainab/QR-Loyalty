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
      const { data: tenants, error: tenantsError } =
        await supabaseAdmin
          .from('tenants')
          .select('id, business_name, status, created_at')
          .order('created_at', { ascending: false });

      if (tenantsError) {
        console.error(
          'Admin tenants query error:',
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
          'Admin customers query error:',
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
          'Admin stamps query error:',
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
          'Admin rewards query error:',
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
          'Admin redemptions query error:',
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
          'Admin staff query error:',
          staffError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff data'
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

      const activeCustomers =
        customers.filter(
          (customer) => customer.status === 'active'
        ).length;

      const activeRewards =
        rewards.filter(
          (reward) => reward.is_active === true
        ).length;

      const activeStaff =
        staff.filter(
          (member) => member.is_active === true
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
            total_customers: customers.length,
            active_customers: activeCustomers,
            total_stamps: stamps.length,
            total_rewards: rewards.length,
            active_rewards: activeRewards,
            total_redemptions: redemptions.length,
            total_staff: staff.length,
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
      const { data: tenants, error: tenantsError } =
        await supabaseAdmin
          .from('tenants')
          .select('id, business_name, status, created_at')
          .order('created_at', { ascending: false });

      if (tenantsError) {
        console.error(
          'Admin reports tenants error:',
          tenantsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve vendor report data'
        });
      }

      const { data: customers, error: customersError } =
        await supabaseAdmin
          .from('customers')
          .select(
            'id, tenant_id, status, created_at'
          );

      if (customersError) {
        console.error(
          'Admin reports customers error:',
          customersError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve customer report data'
        });
      }

      const { data: stamps, error: stampsError } =
        await supabaseAdmin
          .from('stamps')
          .select(
            'id, tenant_id, customer_id, staff_id, visit_id, created_at'
          );

      if (stampsError) {
        console.error(
          'Admin reports stamps error:',
          stampsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve stamp report data'
        });
      }

      const { data: rewards, error: rewardsError } =
        await supabaseAdmin
          .from('rewards')
          .select(
            'id, tenant_id, name, stamps_required, is_active, created_at'
          );

      if (rewardsError) {
        console.error(
          'Admin reports rewards error:',
          rewardsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve reward report data'
        });
      }

      const { data: redemptions, error: redemptionsError } =
        await supabaseAdmin
          .from('redemptions')
          .select(
            'id, tenant_id, customer_id, reward_id, staff_id, redeemed_at, created_at'
          );

      if (redemptionsError) {
        console.error(
          'Admin reports redemptions error:',
          redemptionsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve redemption report data'
        });
      }

      const { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select(
            'id, tenant_id, profile_id, is_active, created_at'
          );

      if (staffError) {
        console.error(
          'Admin reports staff error:',
          staffError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff report data'
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

module.exports = router;