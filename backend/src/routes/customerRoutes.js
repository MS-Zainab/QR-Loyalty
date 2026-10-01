const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
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

      const { data: existingCustomer, error: existingError } =
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

      if (existingCustomer) {
        return res.status(200).json({
          success: true,
          message: 'Customer is already registered with this vendor',
          customer: existingCustomer
        });
      }

      const { data: customer, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .insert({
            tenant_id: tenantId,
            profile_id: profileId,
            name: req.profile.full_name,
            phone: phone || null,
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
async function calculateCustomerProgress(
  tenantId,
  customerId,
  loyaltyProgram,
  preloaded = {}
) {
  const stampCountQuery = preloaded.totalStamps !== undefined
    ? Promise.resolve({ count: preloaded.totalStamps, error: null })
    : supabaseAdmin
        .from('stamps')
        .select('id', {
          count: 'exact',
          head: true
        })
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId);
  const redemptionQuery = preloaded.redemptionRows !== undefined
    ? Promise.resolve({ data: preloaded.redemptionRows, error: null })
    : supabaseAdmin
        .from('redemptions')
        .select('id, reward_id')
        .eq('tenant_id', tenantId)
        .eq('customer_id', customerId);

  const [
    { count: totalStampCount, error: stampError },
    { data: redemptionRows, error: redemptionError }
  ] = await Promise.all([stampCountQuery, redemptionQuery]);
  if (stampError) {
    throw stampError;
  }

  if (redemptionError) {
    throw redemptionError;
  }

  const totalStamps = totalStampCount || 0;

  let consumedStamps = 0;

  if (redemptionRows && redemptionRows.length > 0) {
    const rewardIds = [
      ...new Set(
        redemptionRows
          .map((redemption) => redemption.reward_id)
          .filter(Boolean)
      )
    ];

    if (rewardIds.length > 0) {
      const { data: redeemedRewards, error: rewardError } =
        await supabaseAdmin
          .from('rewards')
          .select('id, stamps_required')
          .eq('tenant_id', tenantId)
          .in('id', rewardIds);

      if (rewardError) {
        throw rewardError;
      }

      const rewardStampMap = new Map(
        (redeemedRewards || []).map((reward) => [
          reward.id,
          Number(reward.stamps_required) || 0
        ])
      );

      consumedStamps = redemptionRows.reduce(
        (total, redemption) => {
          return (
            total +
            (rewardStampMap.get(redemption.reward_id) || 0)
          );
        },
        0
      );
    }
  }

  let stampsRequired = loyaltyProgram
    ? Number(loyaltyProgram.stamps_required)
    : 0;

  if (!Number.isInteger(stampsRequired) || stampsRequired <= 0) {
    stampsRequired = 0;
  }

  const currentProgress = Math.max(
    totalStamps - consumedStamps,
    0
  );

  const completedCycles =
    stampsRequired > 0
      ? Math.floor(currentProgress / stampsRequired)
      : 0;

  const remainingStamps =
    stampsRequired > 0
      ? Math.max(
          stampsRequired - currentProgress,
          0
        )
      : 0;

  return {
    total_stamps: totalStamps,
    consumed_stamps: consumedStamps,
    current_progress: currentProgress,
    stamps_required: stampsRequired,
    remaining_stamps: remainingStamps,
    completed_cycles: completedCycles
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
        const { data: loyaltyProgram, error: loyaltyError } =
          await supabaseAdmin
            .from('loyalty_programs')
            .select(
              'id, tenant_id, name, reward_description, stamps_required, is_active'
            )
            .eq('tenant_id', customer.tenant_id)
            .eq('is_active', true)
            .maybeSingle();

        if (loyaltyError) {
          console.error(
            'Loyalty program lookup error:',
            loyaltyError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve loyalty program'
          });
        }

        const progress = await calculateCustomerProgress(
          customer.tenant_id,
          customer.id,
          loyaltyProgram
        );

        const { data: rewards, error: rewardError } =
          await supabaseAdmin
            .from('rewards')
            .select(
              'id, loyalty_program_id, name, description, stamps_required, is_active'
            )
            .eq('tenant_id', customer.tenant_id)
            .eq('is_active', true);

        if (rewardError) {
          console.error(
            'Customer reward lookup error:',
            rewardError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve rewards'
          });
        }

        const { data: redemptions, error: redemptionError } =
          await supabaseAdmin
            .from('redemptions')
            .select(
              'id, reward_id, staff_id, redeemed_at, created_at'
            )
            .eq('tenant_id', customer.tenant_id)
            .eq('customer_id', customer.id)
            .order('redeemed_at', {
              ascending: false
            });

        if (redemptionError) {
          console.error(
            'Customer redemption lookup error:',
            redemptionError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve redemption history'
          });
        }

        memberships.push({
          customer,
          loyalty_program: loyaltyProgram,
          progress,
          rewards: rewards || [],
          redemptions: redemptions || []
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
        const [
          { data: stamps, error: stampError },
          { data: loyaltyProgram, error: loyaltyError },
          { data: redemptionRows, error: redemptionError }
        ] = await Promise.all([
          supabaseAdmin
            .from('stamps')
            .select(
              'id, tenant_id, customer_id, staff_id, visit_id, created_at'
            )
            .eq('tenant_id', customer.tenant_id)
            .eq('customer_id', customer.id)
            .order('created_at', {
              ascending: false
            }),
          supabaseAdmin
            .from('loyalty_programs')
            .select(
              'id, stamps_required, is_active'
            )
            .eq('tenant_id', customer.tenant_id)
            .eq('is_active', true)
            .maybeSingle(),
          supabaseAdmin
            .from('redemptions')
            .select('id, reward_id')
            .eq('tenant_id', customer.tenant_id)
            .eq('customer_id', customer.id)
        ]);

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

        if (loyaltyError) {
          console.error(
            'Customer stamp history loyalty lookup error:',
            loyaltyError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve loyalty program'
          });
        }

        if (redemptionError) {
          console.error(
            'Customer stamp history redemption lookup error:',
            redemptionError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve redemption history'
          });
        }

        const progress = await calculateCustomerProgress(
          customer.tenant_id,
          customer.id,
          loyaltyProgram,
          {
            totalStamps: stamps?.length || 0,
            redemptionRows: redemptionRows || []
          }
        );

        stampHistory.push({
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          customer_name: customer.name,

          // Historical stamp count.
          total_stamps: stamps ? stamps.length : 0,

          // Current loyalty progress after redemptions.
          current_progress: progress.current_progress,
          consumed_stamps: progress.consumed_stamps,
          stamps_required: progress.stamps_required,
          stamps_remaining: progress.remaining_stamps,

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

      const { data: customer, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .select('id, tenant_id, status')
          .eq('profile_id', profileId)
          .eq('status', 'active')
          .maybeSingle();

      if (customerError || !customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer record not found'
        });
      }

      const { data: loyaltyProgram, error: loyaltyError } =
        await supabaseAdmin
          .from('loyalty_programs')
          .select(
            'id, tenant_id, stamps_required, is_active'
          )
          .eq('tenant_id', customer.tenant_id)
          .eq('is_active', true)
          .maybeSingle();

      if (loyaltyError) {
        console.error(
          'Customer rewards loyalty lookup error:',
          loyaltyError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve loyalty program'
        });
      }

      const { data: rewards, error: rewardsError } =
        await supabaseAdmin
          .from('rewards')
          .select(
            'id, tenant_id, loyalty_program_id, name, description, stamps_required, is_active'
          )
          .eq('tenant_id', customer.tenant_id)
          .eq('is_active', true)
          .order('created_at', {
            ascending: true
          });

      if (rewardsError) {
        console.error(
          'Customer rewards error:',
          rewardsError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve rewards'
        });
      }

      const progress = await calculateCustomerProgress(
        customer.tenant_id,
        customer.id,
        loyaltyProgram
      );

      const result = (rewards || []).map((reward) => {
        const rewardRequired =
          Number(reward.stamps_required) || 0;

        const currentStamps =
          progress.current_progress;

        const eligible =
          rewardRequired > 0 &&
          currentStamps >= rewardRequired;

        const stampsRemaining =
          rewardRequired > 0
            ? Math.max(
                rewardRequired - currentStamps,
                0
              )
            : 0;

        return {
          ...reward,

          // Current available stamps, not lifetime stamps.
          total_stamps: currentStamps,

          stamps_remaining: stampsRemaining,

          eligible
        };
      });

      return res.status(200).json({
        success: true,
        message: 'Customer rewards retrieved successfully',
        rewards: result,

        progress: {
          total_stamps: progress.total_stamps,
          consumed_stamps: progress.consumed_stamps,
          current_progress: progress.current_progress,
          stamps_required: progress.stamps_required,
          stamps_remaining: progress.remaining_stamps,
          completed_cycles: progress.completed_cycles
        }
      });
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
