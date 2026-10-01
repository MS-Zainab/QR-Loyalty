const express = require('express');
const router = express.Router();

const supabaseAdmin = require('../config/supabaseAdmin');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

/**
 * @swagger
 * /api/staff/activity:
 *   get:
 *     summary: Get staff activity
 *     description: Returns the authenticated staff member's loyalty activity for their vendor.
 *     tags:
 *       - Staff
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff activity retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor staff can access this resource
 *       404:
 *         description: Staff record not found
 *       500:
 *         description: Failed to retrieve staff activity
 */
router.get(
  '/activity',
  requireAuth,
  requireRole('vendor_staff'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const profileId = req.profile.id;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Staff member is not associated with a tenant'
        });
      }

      let { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id, tenant_id, profile_id, is_active')
          .eq('tenant_id', tenantId)
          .eq('profile_id', profileId)
          .maybeSingle();

      if (!staff) {
        // Auto-repair missing staff record if profile exists with role vendor_staff
        const { data: profileCheck } = await supabaseAdmin
          .from('profiles')
          .select('id, tenant_id, role')
          .eq('id', profileId)
          .maybeSingle();

        if (profileCheck && (profileCheck.role === 'vendor_staff' || profileCheck.role === 'vendor_owner')) {
          const { data: repairedStaff } = await supabaseAdmin
            .from('staff')
            .insert({
              tenant_id: tenantId,
              profile_id: profileId,
              is_active: true
            })
            .select('id, tenant_id, profile_id, is_active')
            .single();

          if (repairedStaff) {
            staff = repairedStaff;
            staffError = null;
          }
        }
      }

      if (staffError || !staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff record not found'
        });
      }

      if (!staff.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Staff account is inactive'
        });
      }

      const { data: profile, error: profileError } =
        await supabaseAdmin
          .from('profiles')
          .select('id, full_name, role, status')
          .eq('id', profileId)
          .single();

      if (profileError || !profile) {
        return res.status(404).json({
          success: false,
          message: 'Staff profile not found'
        });
      }

      const { data: stamps, error: stampsError } =
        await supabaseAdmin
          .from('stamps')
          .select(
            'id, customer_id, visit_id, created_at'
          )
          .eq('tenant_id', tenantId)
          .eq('staff_id', staff.id)
          .order('created_at', { ascending: false });

      if (stampsError) {
        console.error(
          'Staff stamps activity error:',
          stampsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff stamp activity'
        });
      }

      const { data: redemptions, error: redemptionsError } =
        await supabaseAdmin
          .from('redemptions')
          .select(
            'id, customer_id, reward_id, redeemed_at, created_at'
          )
          .eq('tenant_id', tenantId)
          .eq('staff_id', staff.id)
          .order('redeemed_at', { ascending: false });

      if (redemptionsError) {
        console.error(
          'Staff redemption activity error:',
          redemptionsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff redemption activity'
        });
      }

      const lastStamp =
        stamps && stamps.length > 0
          ? stamps[0].created_at
          : null;

      const lastRedemption =
        redemptions && redemptions.length > 0
          ? redemptions[0].redeemed_at ||
            redemptions[0].created_at
          : null;

      let lastActivity = null;

      if (lastStamp && lastRedemption) {
        lastActivity =
          new Date(lastStamp) > new Date(lastRedemption)
            ? lastStamp
            : lastRedemption;
      } else {
        lastActivity = lastStamp || lastRedemption;
      }

      return res.status(200).json({
        success: true,
        message: 'Staff activity retrieved successfully',
        activity: {
          staff: {
            id: staff.id,
            profile_id: profile.id,
            name: profile.full_name,
            role: profile.role,
            status: profile.status,
            is_active: staff.is_active
          },
          statistics: {
            total_stamps_issued: stamps.length,
            total_rewards_redeemed: redemptions.length,
            last_activity: lastActivity
          },
          stamps: stamps,
          redemptions: redemptions
        }
      });
    } catch (error) {
      console.error(
        'Staff activity error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff activity'
      });
    }
  }
);


/**
 * @swagger
 * /api/staff/verified-visits:
 *   get:
 *     summary: Get recent verified customer visits
 *     description: Returns recent customer visits verified by the authenticated staff member that have not yet received a stamp.
 *     tags:
 *       - Staff
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verified visits retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only active vendor staff can access this resource
 *       404:
 *         description: Staff record not found
 *       500:
 *         description: Failed to retrieve verified visits
 */
router.get(
  '/verified-visits',
  requireAuth,
  requireRole('vendor_staff'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const profileId = req.profile.id;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Staff member is not associated with a tenant'
        });
      }

      // Find the operational staff record (with auto-repair fallback)
      let { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select(
            'id, tenant_id, profile_id, is_active'
          )
          .eq('tenant_id', tenantId)
          .eq('profile_id', profileId)
          .maybeSingle();

      if (!staff) {
        const { data: profileCheck } = await supabaseAdmin
          .from('profiles')
          .select('id, tenant_id, role')
          .eq('id', profileId)
          .maybeSingle();

        if (profileCheck && (profileCheck.role === 'vendor_staff' || profileCheck.role === 'vendor_owner')) {
          const { data: repairedStaff } = await supabaseAdmin
            .from('staff')
            .insert({
              tenant_id: tenantId,
              profile_id: profileId,
              is_active: true
            })
            .select('id, tenant_id, profile_id, is_active')
            .single();

          if (repairedStaff) {
            staff = repairedStaff;
            staffError = null;
          }
        }
      }

      if (staffError || !staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff record not found'
        });
      }

      if (!staff.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Staff account is inactive'
        });
      }

      // Get recent visits verified by this staff member
      const { data: visits, error: visitsError } =
        await supabaseAdmin
          .from('visits')
          .select(
            'id, tenant_id, customer_id, staff_id, visited_at'
          )
          .eq('tenant_id', tenantId)
          .eq('staff_id', staff.id)
          .order('visited_at', {
            ascending: false
          })
          .limit(20);

      if (visitsError) {
        console.error(
          'Staff verified visits error:',
          visitsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve verified visits'
        });
      }

      if (!visits || visits.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No verified visits found',
          visits: []
        });
      }

      // Get stamps already issued for these visits
      const visitIds = visits.map(
        (visit) => visit.id
      );

      const { data: stamps, error: stampsError } =
        await supabaseAdmin
          .from('stamps')
          .select(
            'id, visit_id, customer_id, created_at'
          )
          .eq('tenant_id', tenantId)
          .in('visit_id', visitIds);

      if (stampsError) {
        console.error(
          'Verified visit stamp lookup error:',
          stampsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to check visit stamp status'
        });
      }

      // We no longer filter out stamped visits, because the stamp is issued automatically upon verification.
      // Instead, we mark them as having a stamp so the UI can disable the "Issue Stamp" button if needed.
      const stampedVisitIds = new Set(
        (stamps || []).map(
          (stamp) => stamp.visit_id
        )
      );

      // Return all recent visits
      const pendingVisits = visits;

      // Get customer information
      const customerIds = [
        ...new Set(
          pendingVisits.map(
            (visit) => visit.customer_id
          )
        )
      ];

      let customers = [];

      if (customerIds.length > 0) {
        const {
          data: customerData,
          error: customersError
        } = await supabaseAdmin
          .from('customers')
          .select(
            'id, name, phone, email, status'
          )
          .eq('tenant_id', tenantId)
          .in('id', customerIds);

        if (customersError) {
          console.error(
            'Staff customer lookup error:',
            customersError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve customer information'
          });
        }

        customers = customerData || [];
      }

      const customerMap = new Map(
        customers.map(
          (customer) => [
            customer.id,
            customer
          ]
        )
      );

      // Get total stamp count per customer for this tenant
      const { data: allCustomerStamps } = await supabaseAdmin
        .from('stamps')
        .select('customer_id')
        .eq('tenant_id', tenantId)
        .in('customer_id', customerIds);

      const customerStampCounts = new Map();
      (allCustomerStamps || []).forEach((stamp) => {
        customerStampCounts.set(
          stamp.customer_id,
          (customerStampCounts.get(stamp.customer_id) || 0) + 1
        );
      });

      const result = pendingVisits.map(
        (visit) => ({
          id: visit.id,
          tenant_id: visit.tenant_id,
          customer_id: visit.customer_id,
          staff_id: visit.staff_id,
          visited_at: visit.visited_at,
          has_stamp: stampedVisitIds.has(visit.id),
          total_stamps: customerStampCounts.get(visit.customer_id) || 0,
          customer:
            customerMap.get(
              visit.customer_id
            ) || null
        })
      );

      return res.status(200).json({
        success: true,
        message: 'Verified visits retrieved successfully',
        visits: result
      });
    } catch (error) {
      console.error(
        'Verified visits error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve verified visits'
      });
    }
  }
);

module.exports = router;