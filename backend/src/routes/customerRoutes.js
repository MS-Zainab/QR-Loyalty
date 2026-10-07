const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { normalizePhoneNumber } = require('../utils/phone');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

/**
 * @swagger
 * /api/customers/register:
 *   post:
 *     summary: Register customer with a vendor
 *     description: Registers the authenticated customer with a vendor using the vendor's active QR code.
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/register',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const { qr_code, phone } = req.body;

      if (!qr_code) {
        return res.status(400).json({
          success: false,
          message: 'QR code is required'
        });
      }

      const { data: qrRecord, error: qrError } =
        await supabaseAdmin
          .from('qr_codes')
          .select('id, tenant_id, is_active')
          .eq('code', qr_code)
          .eq('is_active', true)
          .maybeSingle();

      if (qrError) {
        console.error('Customer registration QR error:', qrError);

        return res.status(500).json({
          success: false,
          message: 'Failed to verify QR code'
        });
      }

      if (!qrRecord) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or inactive QR code'
        });
      }

      const tenantId = qrRecord.tenant_id;
      const profileId = req.profile.id;

      // First try lookup by profile_id (primary key)
      let { data: existingCustomer, error: existingError } =
        await supabaseAdmin
          .from('customers')
          .select(
            'id, tenant_id, profile_id, name, phone, email, status'
          )
          .eq('tenant_id', tenantId)
          .eq('profile_id', profileId)
          .maybeSingle();

      if (existingError) {
        console.error(
          'Existing customer lookup error:',
          existingError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to check customer registration'
        });
      }

      // Fallback: if not found by profile, try phone-based lookup within this tenant
      if (!existingCustomer && phone) {
        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone) {
          const { data: phoneCustomer } = await supabaseAdmin
            .from('customers')
            .select('id, tenant_id, profile_id, name, phone, email, status')
            .eq('tenant_id', tenantId)
            .eq('phone', normalizedPhone)
            .eq('status', 'active')
            .maybeSingle();

          if (phoneCustomer) {
            existingCustomer = phoneCustomer;
            // Link this profile to the existing customer for future lookups
            await supabaseAdmin
              .from('customers')
              .update({ profile_id: profileId })
              .eq('id', phoneCustomer.id);
          }
        }
      }

      if (existingCustomer) {
        return res.status(200).json({
          success: true,
          message: 'Customer is already registered with this vendor',
          customer: existingCustomer
        });
      }

      // Normalize phone before insert
      const normalizedPhone = phone ? normalizePhoneNumber(phone) : (req.user.user_metadata?.phone ? normalizePhoneNumber(req.user.user_metadata.phone) : null);

      const { data: customer, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .insert({
            tenant_id: tenantId,
            profile_id: profileId,
            name: req.profile.full_name,
            phone: normalizedPhone || null,
            email: req.user.email || null,
            status: 'active'
          })
          .select(
            'id, tenant_id, profile_id, name, phone, email, status, created_at'
          )
          .single();

      if (customerError) {
        console.error(
          'Customer registration error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to register customer'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Customer registered with vendor successfully',
        customer
      });
    } catch (error) {
      console.error(
        'Customer registration error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Customer registration failed'
      });
    }
  }
);


/**
 * Calculate current loyalty progress.
 *
 * Historical stamps are never deleted.
 *
 * Current progress =
 * total historical stamps - stamps consumed by successful redemptions.
 *
 * Each redemption consumes the stamps_required value of its reward.
 */
/**
 * Calculate loyalty program progress per program.
 *
 * Progress is calculated independently per program.
 * Valid visits/stamps for a program are counted during its validity window (if start_date/end_date exist).
 * Redeeming a reward for one program consumes stamps for that program only.
 */
async function calculateCustomerProgramsProgress(tenantId, customerId) {
  const [
    { data: programs, error: programError },
    { data: stamps, error: stampError },
    { data: rewards, error: rewardError },
    { data: redemptions, error: redemptionError }
  ] = await Promise.all([
    supabaseAdmin
      .from('loyalty_programs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('stamps')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('rewards')
      .select('*')
      .eq('tenant_id', tenantId),
    supabaseAdmin
      .from('redemptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
  ]);

  if (programError) throw programError;
  if (stampError) throw stampError;
  if (rewardError) throw rewardError;
  if (redemptionError) throw redemptionError;

  const now = new Date();
  const allStamps = stamps || [];
  const allRewards = rewards || [];
  const allRedemptions = redemptions || [];

  const programResults = [];

  for (const program of programs || []) {
    const stampsRequired = Number(program.stamps_required) || 10;
    const startDate = program.start_date ? new Date(program.start_date) : null;
    const endDate = program.end_date ? new Date(program.end_date) : null;

    // Check validity
    const isExpired = endDate ? now > endDate : false;
    const isStarted = startDate ? now >= startDate : true;
    const isActive = program.is_active !== false && isStarted && !isExpired;

    // Filter stamps valid for this program
    const validStamps = allStamps.filter((s) => {
      if (s.loyalty_program_id && s.loyalty_program_id === program.id) {
        return true;
      }
      const stampDate = new Date(s.created_at);
      if (startDate && stampDate < startDate) return false;
      if (endDate && stampDate > endDate) return false;
      return true;
    });

    // Find rewards linked to this program or fallback to matching tenant rewards
    const programRewards = allRewards.filter(
      (r) => r.loyalty_program_id === program.id
    );

    // Calculate consumed stamps for this program from redemptions of this program's rewards
    let consumedStamps = 0;
    if (programRewards.length > 0) {
      const rewardIds = new Set(programRewards.map((r) => r.id));
      const rewardMap = new Map(programRewards.map((r) => [r.id, Number(r.stamps_required) || stampsRequired]));

      for (const rdm of allRedemptions) {
        if (rewardIds.has(rdm.reward_id)) {
          consumedStamps += (rewardMap.get(rdm.reward_id) || stampsRequired);
        }
      }
    } else {
      // If no explicit rewards are linked, check general redemptions for this program's stamp target
      for (const rdm of allRedemptions) {
        const matchingReward = allRewards.find((r) => r.id === rdm.reward_id);
        const req = matchingReward ? Number(matchingReward.stamps_required) : stampsRequired;
        if (req === stampsRequired) {
          consumedStamps += req;
        }
      }
    }

    const totalValidStamps = validStamps.length;
    const currentProgress = Math.max(0, totalValidStamps - consumedStamps);
    const remainingVisits = Math.max(0, stampsRequired - currentProgress);
    const rewardUnlocked = currentProgress >= stampsRequired;

    const matchingReward = programRewards[0] || allRewards.find(r => Number(r.stamps_required) === stampsRequired);
    const rewardTitle = matchingReward?.name || program.reward_description || program.name || 'Reward';
    const rewardDescription = matchingReward?.description || program.reward_description || '';

    programResults.push({
      id: program.id,
      tenant_id: program.tenant_id,
      name: program.name,
      stamps_required: stampsRequired,
      reward_description: rewardDescription,
      reward_title: rewardTitle,
      is_active: isActive,
      is_expired: isExpired,
      start_date: program.start_date || null,
      end_date: program.end_date || null,
      total_stamps: totalValidStamps,
      consumed_stamps: consumedStamps,
      current_stamps: currentProgress,
      current_progress: currentProgress,
      remaining_visits: remainingVisits,
      stamps_remaining: remainingVisits,
      reward_unlocked: rewardUnlocked,
      created_at: program.created_at,
      updated_at: program.updated_at
    });
  }

  return {
    all_programs: programResults,
    active_programs: programResults.filter((p) => p.is_active),
    expired_programs: programResults.filter((p) => p.is_expired),
    stamps: allStamps,
    redemptions: allRedemptions,
    rewards: allRewards
  };
}

/**
 * @swagger
 * /api/customers/me:
 *   get:
 *     summary: Get current customer loyalty progress
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/me',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const profileId = req.profile.id;

      const { data: customers, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .select(
            'id, tenant_id, profile_id, name, phone, email, status, created_at'
          )
          .eq('profile_id', profileId)
          .eq('status', 'active');

      if (customerError) {
        console.error(
          'Customer progress lookup error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve customer information'
        });
      }

      if (!customers || customers.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No active vendor memberships found',
          customer: {
            profile_id: profileId,
            name: req.profile.full_name,
            email: req.user.email || null
          },
          memberships: []
        });
      }

      const memberships = [];

      for (const customer of customers) {
        const progData = await calculateCustomerProgramsProgress(
          customer.tenant_id,
          customer.id
        );

        memberships.push({
          customer,
          loyalty_programs: progData.all_programs,
          active_programs: progData.active_programs,
          expired_programs: progData.expired_programs,
          rewards: progData.rewards,
          redemptions: progData.redemptions
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Customer loyalty progress retrieved successfully',
        customer: {
          profile_id: profileId,
          name: req.profile.full_name,
          email: req.user.email || null
        },
        memberships
      });
    } catch (error) {
      console.error(
        'Customer progress error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve customer loyalty progress'
      });
    }
  }
);


/**
 * @swagger
 * /api/customers/me/stamps:
 *   get:
 *     summary: Get current customer's stamp history
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/me/stamps',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const profileId = req.profile.id;

      const { data: customers, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .select('id, tenant_id, name')
          .eq('profile_id', profileId)
          .eq('status', 'active');

      if (customerError) {
        console.error(
          'Customer stamp history membership error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve customer memberships'
        });
      }

      if (!customers || customers.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No active vendor memberships found',
          stamp_history: []
        });
      }

      const stampHistory = [];

      for (const customer of customers) {
        const { data: stamps, error: stampError } = await supabaseAdmin
          .from('stamps')
          .select(
            'id, tenant_id, customer_id, staff_id, visit_id, created_at'
          )
          .eq('tenant_id', customer.tenant_id)
          .eq('customer_id', customer.id)
          .order('created_at', {
            ascending: false
          });

        if (stampError) {
          console.error(
            'Customer stamp history lookup error:',
            stampError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve stamp history'
          });
        }

        // Reuse the shared multi-program progress calculation so this route
        // stays consistent with /me and /me/rewards.
        const progData = await calculateCustomerProgramsProgress(
          customer.tenant_id,
          customer.id
        );

        const program =
          progData.active_programs[0] || progData.all_programs[0] || null;

        stampHistory.push({
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          customer_name: customer.name,

          // Historical stamp count.
          total_stamps: stamps ? stamps.length : 0,

          // Current loyalty progress after redemptions.
          current_progress: program
            ? program.current_progress
            : stamps
              ? stamps.length
              : 0,
          consumed_stamps: program ? program.consumed_stamps : 0,
          stamps_required: program ? program.stamps_required : 10,
          stamps_remaining: program ? program.remaining_visits : null,

          // Full historical stamp records are preserved.
          stamps: stamps || []
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Customer stamp history retrieved successfully',
        stamp_history: stampHistory
      });
    } catch (error) {
      console.error(
        'Customer stamp history error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve stamp history'
      });
    }
  }
);


/**
 * @swagger
 * /api/customers/me/redemptions:
 *   get:
 *     summary: Get current customer's redemption history
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/me/redemptions',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const profileId = req.profile.id;

      const { data: customers, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .select('id, tenant_id, name')
          .eq('profile_id', profileId)
          .eq('status', 'active');

      if (customerError) {
        console.error(
          'Customer redemption membership error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve customer memberships'
        });
      }

      if (!customers || customers.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No active vendor memberships found',
          redemption_history: []
        });
      }

      const redemptionHistory = [];

      for (const customer of customers) {
        const { data: redemptions, error: redemptionError } =
          await supabaseAdmin
            .from('redemptions')
            .select(
              'id, tenant_id, customer_id, reward_id, staff_id, redeemed_at, created_at'
            )
            .eq('tenant_id', customer.tenant_id)
            .eq('customer_id', customer.id)
            .order('redeemed_at', {
              ascending: false
            });

        if (redemptionError) {
          console.error(
            'Customer redemption history lookup error:',
            redemptionError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve redemption history'
          });
        }

        redemptionHistory.push({
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          customer_name: customer.name,
          total_redemptions: redemptions
            ? redemptions.length
            : 0,
          redemptions: redemptions || []
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Customer redemption history retrieved successfully',
        redemption_history: redemptionHistory
      });
    } catch (error) {
      console.error(
        'Customer redemption history error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve redemption history'
      });
    }
  }
);


/**
 * @swagger
 * /api/customers/me/rewards:
 *   get:
 *     summary: Get current customer's rewards and eligibility
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/me/rewards',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const profileId = req.profile.id;

      // A customer can be enrolled with multiple vendors, so fetch all
      // memberships. A brand-new customer without any membership yet gets an
      // empty (successful) response instead of a 404.
      const { data: customers, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .select('id, tenant_id, status')
          .eq('profile_id', profileId)
          .eq('status', 'active');

      if (customerError) {
        console.error(
          'Customer rewards membership lookup error:',
          customerError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve customer rewards'
        });
      }

      if (!customers || customers.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No active vendor memberships found',
          rewards: [],
          active_programs: [],
          expired_programs: [],
          programs: []
        });
      }

      const allRewards = [];
      const activePrograms = [];
      const expiredPrograms = [];
      const allPrograms = [];
      let firstActiveProg = null;

      for (const customer of customers) {
        const progData = await calculateCustomerProgramsProgress(
          customer.tenant_id,
          customer.id
        );

        const activeProg = progData.active_programs[0] || null;
        if (activeProg && !firstActiveProg) {
          firstActiveProg = activeProg;
        }

        for (const program of progData.all_programs) {
          allPrograms.push({ ...program, tenant_id: customer.tenant_id });
        }
        for (const program of progData.active_programs) {
          activePrograms.push({ ...program, tenant_id: customer.tenant_id });
        }
        for (const program of progData.expired_programs) {
          expiredPrograms.push({ ...program, tenant_id: customer.tenant_id });
        }

        for (const reward of progData.rewards || []) {
          const rewardRequired = Number(reward.stamps_required) || 0;
          const matchingProg =
            progData.all_programs.find(
              (p) =>
                p.id === reward.loyalty_program_id ||
                p.stamps_required === rewardRequired
            ) || activeProg;

          const currentStamps = matchingProg
            ? matchingProg.current_stamps
            : 0;
          const eligible =
            rewardRequired > 0 && currentStamps >= rewardRequired;
          const stampsRemaining =
            rewardRequired > 0
              ? Math.max(rewardRequired - currentStamps, 0)
              : 0;

          allRewards.push({
            ...reward,
            tenant_id: customer.tenant_id,
            total_stamps: currentStamps,
            stamps_remaining: stampsRemaining,
            eligible
          });
        }
      }

      const response = {
        success: true,
        message: 'Customer rewards retrieved successfully',
        rewards: allRewards,
        active_programs: activePrograms,
        expired_programs: expiredPrograms,
        programs: allPrograms
      };

      // Only report progress when an active program actually exists, so the
      // frontend renders a real empty state instead of derived defaults.
      if (firstActiveProg) {
        response.progress = {
          total_stamps: firstActiveProg.total_stamps,
          consumed_stamps: firstActiveProg.consumed_stamps,
          current_progress: firstActiveProg.current_stamps,
          stamps_required: firstActiveProg.stamps_required,
          stamps_remaining: firstActiveProg.remaining_visits,
          completed_cycles: Math.floor(
            firstActiveProg.consumed_stamps / firstActiveProg.stamps_required
          )
        };
      }

      return res.status(200).json(response);
    } catch (error) {
      console.error(
        'Customer rewards route error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve customer rewards'
      });
    }
  }
);


module.exports = router;
