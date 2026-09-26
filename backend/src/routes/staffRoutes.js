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

      const { data: staff, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id, tenant_id, profile_id, is_active')
          .eq('tenant_id', tenantId)
          .eq('profile_id', profileId)
          .single();

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

module.exports = router;