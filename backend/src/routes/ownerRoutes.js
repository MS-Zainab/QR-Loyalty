const express = require('express');

const supabaseAdmin = require('../config/supabaseAdmin');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { isUuid } = require('../middleware/validation');

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

      // The tenant and dashboard statistics use the authenticated tenant ID,
      // so the reads are independent and can run concurrently.
      const tenantQuery = supabaseAdmin
        .from('tenants')
        .select('id, business_name, status, created_at, slug')
        .eq('id', tenantId)
        .single();


      // These tenant-scoped reads are independent, so run them together.
      const [
        { data: tenant, error: tenantError },
        { data: loyaltyProgram, error: loyaltyError },
        { data: customers, error: customerError },
        { data: stamps, error: stampError },
        { data: rewards, error: rewardError },
        { data: redemptions, error: redemptionError },
        { data: staff, error: staffError }
      ] = await Promise.all([
        tenantQuery,
        supabaseAdmin
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
          .maybeSingle(),
        supabaseAdmin
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        supabaseAdmin
          .from('stamps')
          .select('id, staff_id, created_at')
          .eq('tenant_id', tenantId),
        supabaseAdmin
          .from('rewards')
          .select('id, name, is_active')
          .eq('tenant_id', tenantId),
        supabaseAdmin
          .from('redemptions')
          .select('id, staff_id, redeemed_at, created_at')
          .eq('tenant_id', tenantId),
        supabaseAdmin
          .from('staff')
          .select('id, profile_id, is_active')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
      ]);
      if (tenantError || !tenant) {
        console.error('Owner dashboard tenant error:', tenantError);

        return res.status(404).json({
          success: false,
          message: 'Vendor not found'
        });
      }

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
      const profileIds = (staff || []).map((member) => member.profile_id);
      const { data: staffProfiles } = profileIds.length
        ? await supabaseAdmin
            .from('profiles')
            .select('id, full_name')
            .in('id', profileIds)
        : { data: [] };
      const profilesById = new Map(
        (staffProfiles || []).map((profile) => [profile.id, profile])
      );

      for (const staffMember of staff || []) {
        const profile = profilesById.get(staffMember.profile_id);
        if (!profile) continue;

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

      const profileIds = (staff || []).map((member) => member.profile_id);
      const [
        { data: profiles, error: profilesError },
        { data: stamps, error: stampsError },
        { data: redemptions, error: redemptionsError }
      ] = profileIds.length
        ? await Promise.all([
            supabaseAdmin
              .from('profiles')
              .select('id, full_name, auth_user_id, role, status')
              .in('id', profileIds),
            supabaseAdmin
              .from('stamps')
              .select('id, staff_id, created_at')
              .eq('tenant_id', tenantId),
            supabaseAdmin
              .from('redemptions')
              .select('id, staff_id, redeemed_at, created_at')
              .eq('tenant_id', tenantId)
          ])
        : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

      if (profilesError || stampsError || redemptionsError) {
        console.error('Owner staff activity lookup error:', profilesError || stampsError || redemptionsError);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve staff activity'
        });
      }

      const profilesById = new Map((profiles || []).map((profile) => [profile.id, profile]));
      const stampsByStaff = new Map();
      const redemptionsByStaff = new Map();
      for (const stamp of stamps || []) {
        const entries = stampsByStaff.get(stamp.staff_id) || [];
        entries.push(stamp);
        stampsByStaff.set(stamp.staff_id, entries);
      }
      for (const redemption of redemptions || []) {
        const entries = redemptionsByStaff.get(redemption.staff_id) || [];
        entries.push(redemption);
        redemptionsByStaff.set(redemption.staff_id, entries);
      }

      const staffList = (staff || []).map((staffMember) => {
        const profile = profilesById.get(staffMember.profile_id);
        const staffStamps = stampsByStaff.get(staffMember.id) || [];
        const staffRedemptions = redemptionsByStaff.get(staffMember.id) || [];
        const activityDates = [
          ...staffStamps.map((stamp) => stamp.created_at),
          ...staffRedemptions.map((redemption) => redemption.redeemed_at || redemption.created_at)
        ].filter(Boolean);
        activityDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

        return {
          staff_id: staffMember.id,
          profile_id: staffMember.profile_id,
          // A missing profile must not hide a real staff record from the
          // owner; surface it with a placeholder name instead.
          staff_name: profile?.full_name || 'Unknown (missing profile)',
          status: staffMember.is_active
            ? 'active'
            : 'inactive',
          profile_status: profile?.status || null,
          created_at: staffMember.created_at,
          updated_at: staffMember.updated_at,
          activity: {
            stamps_issued: staffStamps.length,
            rewards_redeemed: staffRedemptions.length,
            last_activity: activityDates.length
              ? activityDates[0]
              : null
          }
        };
      });

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

      if (!isUuid(staffId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid staff ID is required'
        });
      }

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

/**
 * @swagger
 * /api/owner/staff/{id}/password:
 *   patch:
 *     summary: Update staff member's password
 *     description: Allows a vendor owner to update/reset credentials for a staff member belonging to their tenant.
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
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 example: NewSecurePassword123!
 *     responses:
 *       200:
 *         description: Staff password updated successfully
 *       400:
 *         description: Invalid request or weak password
 *       403:
 *         description: Only vendor owners can access this resource
 *       404:
 *         description: Staff member not found
 *       500:
 *         description: Failed to update staff password
 */
router.patch(
  '/staff/:id/password',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const staffId = req.params.id;
      const { password } = req.body;

      if (!isUuid(staffId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid staff ID is required'
        });
      }

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Vendor owner is not associated with a tenant'
        });
      }

      if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters'
        });
      }

      // Verify staff member belongs to owner's tenant
      const { data: staff, error: staffError } = await supabaseAdmin
        .from('staff')
        .select('id, tenant_id, profile_id')
        .eq('id', staffId)
        .eq('tenant_id', tenantId)
        .single();

      if (staffError || !staff) {
        return res.status(404).json({
          success: false,
          message: 'Staff member not found'
        });
      }

      // Fetch profile to get auth_user_id
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, auth_user_id')
        .eq('id', staff.profile_id)
        .single();

      if (profileError || !profile || !profile.auth_user_id) {
        return res.status(404).json({
          success: false,
          message: 'Staff profile auth account not found'
        });
      }

      // Update Supabase Auth user password
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        profile.auth_user_id,
        { password }
      );

      if (updateAuthError) {
        console.error('Staff password update error:', updateAuthError);
        return res.status(400).json({
          success: false,
          message: updateAuthError.message || 'Failed to update staff password'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Staff password updated successfully'
      });
    } catch (error) {
      console.error('Staff password update catch error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update staff password'
      });
    }
  }
);

/**
 * @swagger
 * /api/owner/subscription:
 *   get:
 *     summary: Get tenant subscription details
 */
router.get(
  '/subscription',
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

      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('created_at, status')
        .eq('id', tenantId)
        .single();

      const createdAt = new Date(tenant?.created_at || Date.now());
      const trialEnds = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
      const daysLeft = Math.max(0, Math.ceil((trialEnds - new Date()) / (1000 * 60 * 60 * 24)));

      if (!subscription) {
        return res.status(200).json({
          success: true,
          subscription: {
            plan_type: 'trial',
            status: daysLeft > 0 ? 'active' : 'expired',
            billing_cycle: 'monthly',
            amount_paid: 0,
            days_left: daysLeft,
            trial_ends_at: trialEnds.toISOString(),
            current_period_end: trialEnds.toISOString()
          }
        });
      }

      return res.status(200).json({
        success: true,
        subscription: {
          ...subscription,
          days_left: subscription.current_period_end
            ? Math.max(0, Math.ceil((new Date(subscription.current_period_end) - new Date()) / (1000 * 60 * 60 * 24)))
            : daysLeft
        }
      });
    } catch (error) {
      console.error('Fetch owner subscription error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch subscription details'
      });
    }
  }
);

/**
 * @swagger
 * /api/owner/subscription/upgrade:
 *   post:
 *     summary: Upgrade tenant subscription
 */
router.post(
  '/subscription/upgrade',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const { plan_type = 'pro', billing_cycle = 'monthly' } = req.body || {};

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Vendor owner is not associated with a tenant'
        });
      }

      const validPlans = ['basic', 'pro', 'enterprise'];
      if (!validPlans.includes(plan_type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan type selected'
        });
      }

      const days = billing_cycle === 'yearly' ? 365 : 30;
      const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const amount = plan_type === 'basic' ? (billing_cycle === 'yearly' ? 190 : 19)
        : plan_type === 'pro' ? (billing_cycle === 'yearly' ? 490 : 49)
        : (billing_cycle === 'yearly' ? 990 : 99);

      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      let subData;
      if (existing) {
        const { data: updated } = await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_type,
            status: 'active',
            billing_cycle,
            amount_paid: amount,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        subData = updated;
      } else {
        const { data: created } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            tenant_id: tenantId,
            plan_type,
            status: 'active',
            billing_cycle,
            amount_paid: amount,
            current_period_end: periodEnd
          })
          .select()
          .single();
        subData = created;
      }

      await supabaseAdmin.from('tenants').update({ status: 'active', updated_at: new Date().toISOString() }).eq('id', tenantId);

      return res.status(200).json({
        success: true,
        message: `Successfully subscribed to ${plan_type.toUpperCase()} plan!`,
        subscription: subData || {
          plan_type,
          status: 'active',
          billing_cycle,
          amount_paid: amount,
          current_period_end: periodEnd
        }
      });
    } catch (error) {
      console.error('Upgrade subscription error:', error);
      return res.status(500).json({
        success: false,
        message: 'Subscription upgrade failed'
      });
    }
  }
);

module.exports = router;

