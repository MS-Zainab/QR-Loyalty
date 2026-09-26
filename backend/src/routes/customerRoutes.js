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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qr_code
 *             properties:
 *               qr_code:
 *                 type: string
 *                 description: Active vendor QR code
 *                 example: 4d70ca1b3a60e45cd1f5d09c5e0c34d6
 *               phone:
 *                 type: string
 *                 description: Optional customer phone number
 *                 example: "03001234567"
 *     responses:
 *       201:
 *         description: Customer registered with vendor successfully
 *       200:
 *         description: Customer is already registered with this vendor
 *       400:
 *         description: QR code is missing or invalid/inactive
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only customers can register with a vendor
 *       500:
 *         description: Customer registration failed
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

      // Find active vendor QR
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

      // Check if customer is already registered with this vendor
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

      // Create customer record
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
 * @swagger
 * /api/customers/me:
 *   get:
 *     summary: Get current customer loyalty progress
 *     description: Returns the authenticated customer's profile, vendor memberships, current stamp progress, available rewards, and redemption progress.
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer loyalty progress retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only customers can access this resource
 *       500:
 *         description: Failed to retrieve customer loyalty progress
 */
router.get(
  '/me',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const profileId = req.profile.id;

      // Find all active vendor memberships for this customer
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
        // Get active loyalty program for this vendor
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

        // Count customer's total stamps for this vendor
        const { count: totalStamps, error: stampError } =
          await supabaseAdmin
            .from('stamps')
            .select('id', {
              count: 'exact',
              head: true
            })
            .eq('tenant_id', customer.tenant_id)
            .eq('customer_id', customer.id);

        if (stampError) {
          console.error(
            'Customer stamp count error:',
            stampError
          );

          return res.status(500).json({
            success: false,
            message: 'Failed to retrieve stamp progress'
          });
        }

        // Get active rewards for this vendor
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

        // Get customer's redemption history for this vendor
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

        const stampCount = totalStamps || 0;

        let stampsRequired = loyaltyProgram
          ? loyaltyProgram.stamps_required
          : 0;

        if (!Number.isInteger(stampsRequired) || stampsRequired <= 0) {
          stampsRequired = 0;
        }

        const completedCycles =
          stampsRequired > 0
            ? Math.floor(stampCount / stampsRequired)
            : 0;

        const currentProgress =
          stampsRequired > 0
            ? stampCount % stampsRequired
            : stampCount;

        const remainingStamps =
          stampsRequired > 0
            ? stampsRequired - currentProgress
            : 0;

        memberships.push({
          customer,
          loyalty_program: loyaltyProgram,
          progress: {
            total_stamps: stampCount,
            stamps_required: stampsRequired,
            current_progress: currentProgress,
            remaining_stamps:
              currentProgress === 0 && completedCycles > 0
                ? 0
                : remainingStamps,
            completed_cycles: completedCycles
          },
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
 *     description: Returns the authenticated customer's loyalty stamp history across their active vendor memberships.
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer stamp history retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only customers can access this resource
 *       500:
 *         description: Failed to retrieve customer stamp history
 */
router.get(
  '/me/stamps',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const profileId = req.profile.id;

      // Find all active vendor memberships for this customer
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
        // Get all stamps belonging to this customer and vendor
        const { data: stamps, error: stampError } =
          await supabaseAdmin
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

        stampHistory.push({
          customer_id: customer.id,
          tenant_id: customer.tenant_id,
          customer_name: customer.name,
          total_stamps: stamps ? stamps.length : 0,
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
        message: 'Failed to retrieve customer stamp history'
      });
    }
  }
);


/**
 * @swagger
 * /api/customers/me/redemptions:
 *   get:
 *     summary: Get current customer's redemption history
 *     description: Returns the authenticated customer's own reward redemption history across active vendor memberships.
 *     tags:
 *       - Customers
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer redemption history retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only customers can access this resource
 *       500:
 *         description: Failed to retrieve customer redemption history
 */
router.get(
  '/me/redemptions',
  requireAuth,
  requireRole('customer'),
  async (req, res) => {
    try {
      const profileId = req.profile.id;

      // Find all active vendor memberships for this customer
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
        message: 'Failed to retrieve customer redemption history'
      });
    }
  }
);

module.exports = router;