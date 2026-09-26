const express = require('express');

const supabaseAdmin = require('../config/supabaseAdmin');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');

const router = express.Router();

/**
 * @swagger
 * /api/owner/dashboard:
 *   get:
 *     summary: Get vendor owner dashboard
 *     description: Returns dashboard overview and staff activity for the authenticated vendor owner.
 *     tags:
 *       - Owner Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Owner dashboard retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor owners can access this resource
 *       500:
 *         description: Failed to retrieve owner dashboard
 */
router.get(
  '/dashboard',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Vendor owner is not associated with a tenant'
        });
      }

      // Get tenant information
      const { data: tenant, error: tenantError } =
        await supabaseAdmin
          .from('tenants')
         .select('id, business_name, status, created_at')
          .eq('id', tenantId)
          .single();

      if (tenantError || !tenant) {
        console.error('Owner dashboard tenant error:', tenantError);

        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

      // Get active loyalty program
      const { data: loyaltyProgram, error: loyaltyError } =
        await supabaseAdmin
          .from('loyalty_programs')
          .select(
            'id, name, stamps_required, reward_description, is_active'
          )
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('created_at', {
            ascending: false
          })
          .limit(1)
          .maybeSingle();

      if (loyaltyError) {
        console.error(
          'Owner dashboard loyalty program error:',
          loyaltyError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve loyalty program'
        });
      }

      // Get active customers
      const { data: customers, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active');

      if (customerError) {
        console.error(
          'Owner dashboard customer error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve customer statistics'
        });
      }

      // Get all stamps
      const { data: stamps, error: stampError } =
        await supabaseAdmin
          .from('stamps')
          .select('id, staff_id, created_at')
          .eq('tenant_id', tenantId);

      if (stampError) {
        console.error(
          'Owner dashboard stamp error:',
          stampError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve stamp statistics'
        });
      }

      // Get all rewards
      const { data: rewards, error: rewardError } =
        await supabaseAdmin
          .from('rewards')
          .select('id, name, is_active')
          .eq('tenant_id', tenantId);

      if (rewardError) {
        console.error(
          'Owner dashboard reward error:',
          rewardError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve reward statistics'
        });
      }

      // Get all redemptions
      const { data: redemptions, error: redemptionError } =
        await supabaseAdmin
          .from('redemptions')
          .select('id, staff_id, redeemed_at, created_at')
          .eq('tenant_id', tenantId);

      if (redemptionError) {
        console.error(
          'Owner dashboard redemption error:',
          redemptionError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve redemption statistics'
        });
      }

      // Get active staff
      const { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id, profile_id, is_active')
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

      if (staffError) {
        console.error(
          'Owner dashboard staff error:',
          staffError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff statistics'
        });
      }

      // Build staff activity
      const staffActivity = [];

      for (const staffMember of staff || []) {
        const { data: profile, error: profileError } =
          await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', staffMember.profile_id)
            .single();

        if (profileError || !profile) {
          continue;
        }

        const staffStamps = (stamps || []).filter(
          (stamp) => stamp.staff_id === staffMember.id
        );

        const staffRedemptions = (redemptions || []).filter(
          (redemption) =>
            redemption.staff_id === staffMember.id
        );

        const activityDates = [
          ...staffStamps.map((stamp) => stamp.created_at),
          ...staffRedemptions.map(
            (redemption) =>
              redemption.redeemed_at ||
              redemption.created_at
          )
        ].filter(Boolean);

        activityDates.sort(
          (a, b) =>
            new Date(b).getTime() -
            new Date(a).getTime()
        );

        staffActivity.push({
          staff_id: staffMember.id,
          staff_name: profile.full_name,
          stamps_issued: staffStamps.length,
          rewards_redeemed: staffRedemptions.length,
          last_activity: activityDates.length
            ? activityDates[0]
            : null
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Owner dashboard retrieved successfully',

        dashboard: {
          tenant: {
            id: tenant.id,
            business_name: tenant.business_name,
            status: tenant.status,
            created_at: tenant.created_at
          },

          loyalty_program: loyaltyProgram || null,

          statistics: {
            active_customers: customers
              ? customers.length
              : 0,

            total_stamps: stamps
              ? stamps.length
              : 0,

            total_rewards: rewards
              ? rewards.length
              : 0,

            active_rewards: rewards
              ? rewards.filter(
                  (reward) => reward.is_active
                ).length
              : 0,

            total_redemptions: redemptions
              ? redemptions.length
              : 0,

            active_staff: staff
              ? staff.length
              : 0
          },

          staff_activity: staffActivity
        }
      });
    } catch (error) {
      console.error(
        'Owner dashboard error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve owner dashboard'
      });
    }
  }
);


/**
 * @swagger
 * /api/owner/staff:
 *   get:
 *     summary: Get vendor staff
 *     description: Returns all staff members and their activity for the authenticated vendor owner.
 *     tags:
 *       - Owner Dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Staff list retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor owners can access this resource
 *       500:
 *         description: Failed to retrieve staff
 */
router.get(
  '/staff',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Vendor owner is not associated with a tenant'
        });
      }

      const { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id, profile_id, is_active, created_at, updated_at')
          .eq('tenant_id', tenantId)
          .order('created_at', {
            ascending: false
          });

      if (staffError) {
        console.error('Owner staff lookup error:', staffError);

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff'
        });
      }

      const staffList = [];

      for (const staffMember of staff || []) {
        const { data: profile, error: profileError } =
          await supabaseAdmin
            .from('profiles')
            .select('id, full_name, auth_user_id, role, status')
            .eq('id', staffMember.profile_id)
            .single();

        if (profileError || !profile) {
          continue;
        }

        const { data: stamps, error: stampError } =
          await supabaseAdmin
            .from('stamps')
            .select('id, created_at')
            .eq('tenant_id', tenantId)
            .eq('staff_id', staffMember.id);

        if (stampError) {
          console.error(
            'Owner staff stamp lookup error:',
            stampError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve staff activity'
          });
        }

        const { data: redemptions, error: redemptionError } =
          await supabaseAdmin
            .from('redemptions')
            .select(
              'id, redeemed_at, created_at'
            )
            .eq('tenant_id', tenantId)
            .eq('staff_id', staffMember.id);

        if (redemptionError) {
          console.error(
            'Owner staff redemption lookup error:',
            redemptionError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve staff activity'
          });
        }

        const activityDates = [
          ...(stamps || []).map(
            (stamp) => stamp.created_at
          ),
          ...(redemptions || []).map(
            (redemption) =>
              redemption.redeemed_at ||
              redemption.created_at
          )
        ].filter(Boolean);

        activityDates.sort(
          (a, b) =>
            new Date(b).getTime() -
            new Date(a).getTime()
        );

        staffList.push({
          staff_id: staffMember.id,
          profile_id: staffMember.profile_id,
          staff_name: profile.full_name,
          status: staffMember.is_active
            ? 'active'
            : 'inactive',
          profile_status: profile.status,
          created_at: staffMember.created_at,
          updated_at: staffMember.updated_at,
          activity: {
            stamps_issued: stamps
              ? stamps.length
              : 0,
            rewards_redeemed: redemptions
              ? redemptions.length
              : 0,
            last_activity: activityDates.length
              ? activityDates[0]
              : null
          }
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Staff list retrieved successfully',
        staff: staffList
      });
    } catch (error) {
      console.error(
        'Owner staff error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve staff'
      });
    }
  }
);

/**
 * @swagger
 * /api/owner/staff/{id}/status:
 *   patch:
 *     summary: Update staff status
 *     description: Allows a vendor owner to activate or deactivate staff belonging to their own vendor.
 *     tags:
 *       - Owner Dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Staff ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - active
 *                   - inactive
 *     responses:
 *       200:
 *         description: Staff status updated successfully
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor owners can access this resource
 *       404:
 *         description: Staff not found
 *       500:
 *         description: Failed to update staff status
 */
router.patch(
  '/staff/:id/status',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const staffId = req.params.id;
      const { status } = req.body;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Vendor owner is not associated with a tenant'
        });
      }

      if (!status || !['active', 'inactive'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be active or inactive'
        });
      }

      const isActive = status === 'active';

      // Find staff belonging to the owner's tenant
      const { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id, tenant_id, profile_id, is_active')
          .eq('id', staffId)
          .eq('tenant_id', tenantId)
          .single();

      if (staffError || !staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      // Update operational staff status
      const { data: updatedStaff, error: updateError } =
        await supabaseAdmin
          .from('staff')
          .update({
            is_active: isActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', staffId)
          .eq('tenant_id', tenantId)
          .select(
            'id, tenant_id, profile_id, is_active, created_at, updated_at'
          )
          .single();

      if (updateError || !updatedStaff) {
        console.error(
          'Staff status update error:',
          updateError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to update staff status'
        });
      }

      // Keep the staff profile status synchronized
      const { error: profileUpdateError } =
        await supabaseAdmin
          .from('profiles')
          .update({
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', staff.profile_id)
          .eq('tenant_id', tenantId);

      if (profileUpdateError) {
        console.error(
          'Staff profile status update error:',
          profileUpdateError
        );

        return res.status(500).json({
          success: false,
          message: 'Staff status updated but profile status synchronization failed'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Staff status updated successfully',
        staff: {
          id: updatedStaff.id,
          tenant_id: updatedStaff.tenant_id,
          profile_id: updatedStaff.profile_id,
          status: updatedStaff.is_active
            ? 'active'
            : 'inactive',
          created_at: updatedStaff.created_at,
          updated_at: updatedStaff.updated_at
        }
      });
    } catch (error) {
      console.error(
        'Staff status update error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to update staff status'
      });
    }
  }
);

module.exports = router;