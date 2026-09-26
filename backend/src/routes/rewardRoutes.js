const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

/**
 * @swagger
 * /api/rewards:
 *   get:
 *     summary: Get rewards for current vendor
 *     description: Returns all rewards belonging to the authenticated vendor.
 *     tags:
 *       - Rewards
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rewards fetched successfully
 *       400:
 *         description: User is not linked to a vendor
 *       401:
 *         description: Authentication required
 *       403:
 *         description: User does not have permission
 *       500:
 *         description: Failed to fetch rewards
 */
router.get(
    '/',
    requireAuth,
    requireRole('vendor_owner', 'vendor_staff'),
    async (req, res) => {
        try {
            const tenantId = req.profile.tenant_id;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'User is not linked to a vendor'
                });
            }

            const { data: rewards, error } = await supabaseAdmin
                .from('rewards')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Get rewards error:', error);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to fetch rewards'
                });
            }

            return res.status(200).json({
                success: true,
                rewards
            });
        } catch (error) {
            console.error('Get rewards error:', error);

            return res.status(500).json({
                success: false,
                message: 'Server error while fetching rewards'
            });
        }
    }
);

/**
 * @swagger
 * /api/rewards:
 *   post:
 *     summary: Create a reward
 *     description: Creates a new reward for the authenticated vendor using its active loyalty program.
 *     tags:
 *       - Rewards
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - stamps_required
 *             properties:
 *               name:
 *                 type: string
 *                 example: Free Coffee
 *               description:
 *                 type: string
 *                 example: One free coffee after completing the required stamps
 *               stamps_required:
 *                 type: integer
 *                 example: 10
 *     responses:
 *       201:
 *         description: Reward created successfully
 *       400:
 *         description: Invalid request or active loyalty program not found
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor owners can create rewards
 *       500:
 *         description: Failed to create reward
 */
router.post(
    '/',
    requireAuth,
    requireRole('vendor_owner'),
    async (req, res) => {
        try {
            const tenantId = req.profile.tenant_id;
            const { name, description, stamps_required } = req.body;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'User is not linked to a vendor'
                });
            }

            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Reward name is required'
                });
            }

            const { data: loyaltyProgram, error: programError } =
                await supabaseAdmin
                    .from('loyalty_programs')
                    .select('id')
                    .eq('tenant_id', tenantId)
                    .eq('is_active', true)
                    .maybeSingle();

            if (programError) {
                console.error('Get loyalty program error:', programError);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to find loyalty program'
                });
            }

            if (!loyaltyProgram) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Create an active loyalty program before creating rewards'
                });
            }

            const { data: reward, error } = await supabaseAdmin
                .from('rewards')
                .insert({
                    tenant_id: tenantId,
                    loyalty_program_id: loyaltyProgram.id,
                    name: name.trim(),
                    description: description ? description.trim() : null,
                    stamps_required: stamps_required,
                    is_active: true
                })
                .select()
                .single();

            if (error) {
                console.error('Create reward error:', error);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to create reward'
                });
            }

            return res.status(201).json({
                success: true,
                message: 'Reward created successfully',
                reward
            });
        } catch (error) {
            console.error('Create reward error:', error);

            return res.status(500).json({
                success: false,
                message: 'Server error while creating reward'
            });
        }
    }
);

/**
 * @swagger
 * /api/rewards/{id}/redeem:
 *   post:
 *     summary: Redeem a customer reward
 *     description: Allows an active vendor staff member to redeem an active reward for a customer who has completed the required number of loyalty stamps.
 *     tags:
 *       - Rewards
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reward ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *             properties:
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *                 example: 4e9a1fc6-0b67-40eb-8eac-b57c013e3c5d
 *     responses:
 *       201:
 *         description: Reward redeemed successfully
 *       400:
 *         description: Customer is not eligible or invalid request
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor staff can redeem rewards
 *       404:
 *         description: Customer or reward not found
 *       500:
 *         description: Failed to redeem reward
 */
router.post(
    '/:id/redeem',
    requireAuth,
    requireRole('vendor_staff'),
    async (req, res) => {
        try {
            const tenantId = req.profile.tenant_id;
            const staffProfileId = req.profile.id;
            const rewardId = req.params.id;
            const { customer_id } = req.body;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'User is not linked to a vendor'
                });
            }

            if (!customer_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer ID is required'
                });
            }

            // Find the operational staff record for the authenticated profile.
            const { data: staff, error: staffError } = await supabaseAdmin
                .from('staff')
                .select('id, tenant_id, profile_id, is_active')
                .eq('profile_id', staffProfileId)
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .maybeSingle();

            if (staffError) {
                console.error('Find staff error:', staffError);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to verify staff account'
                });
            }

            if (!staff) {
                return res.status(403).json({
                    success: false,
                    message: 'Active staff record not found'
                });
            }

            // Find the active reward belonging to the same vendor.
            const { data: reward, error: rewardError } = await supabaseAdmin
                .from('rewards')
                .select(
                    'id, tenant_id, loyalty_program_id, name, description, stamps_required, is_active'
                )
                .eq('id', rewardId)
                .eq('tenant_id', tenantId)
                .eq('is_active', true)
                .maybeSingle();

            if (rewardError) {
                console.error('Find reward error:', rewardError);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to find reward'
                });
            }

            if (!reward) {
                return res.status(404).json({
                    success: false,
                    message: 'Active reward not found'
                });
            }

            if (
                !Number.isInteger(reward.stamps_required) ||
                reward.stamps_required <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Reward has an invalid stamp requirement'
                });
            }

            // Find the customer belonging to the same vendor.
            const { data: customer, error: customerError } =
                await supabaseAdmin
                    .from('customers')
                    .select('id, tenant_id, profile_id, name, status')
                    .eq('id', customer_id)
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active')
                    .maybeSingle();

            if (customerError) {
                console.error('Find customer error:', customerError);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to find customer'
                });
            }

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: 'Active customer not found'
                });
            }

            // Count all stamps earned by the customer for this vendor.
            const { count: stampCount, error: stampCountError } =
                await supabaseAdmin
                    .from('stamps')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('customer_id', customer_id);

            if (stampCountError) {
                console.error('Count stamps error:', stampCountError);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to calculate customer stamp progress'
                });
            }

            const totalStamps = stampCount || 0;

            // Count previous redemptions of this same reward.
            const { count: redemptionCount, error: redemptionCountError } =
                await supabaseAdmin
                    .from('redemptions')
                    .select('id', { count: 'exact', head: true })
                    .eq('tenant_id', tenantId)
                    .eq('customer_id', customer_id)
                    .eq('reward_id', rewardId);

            if (redemptionCountError) {
                console.error(
                    'Count redemptions error:',
                    redemptionCountError
                );

                return res.status(500).json({
                    success: false,
                    message: 'Failed to calculate reward redemption history'
                });
            }

            const previousRedemptions = redemptionCount || 0;
            const requiredStampsForNextRedemption =
                (previousRedemptions + 1) * reward.stamps_required;

            if (totalStamps < requiredStampsForNextRedemption) {
                const remainingStamps =
                    requiredStampsForNextRedemption - totalStamps;

                return res.status(400).json({
                    success: false,
                    message: 'Customer has not completed enough stamps for this reward',
                    eligibility: {
                        total_stamps: totalStamps,
                        stamps_required: reward.stamps_required,
                        previous_redemptions: previousRedemptions,
                        remaining_stamps: remainingStamps
                    }
                });
            }

            // Create the redemption record.
            const now = new Date().toISOString();

            const { data: redemption, error: redemptionError } =
                await supabaseAdmin
                    .from('redemptions')
                    .insert({
                        tenant_id: tenantId,
                        customer_id: customer_id,
                        reward_id: rewardId,
                        staff_id: staff.id,
                        redeemed_at: now,
                        created_at: now
                    })
                    .select()
                    .single();

            if (redemptionError) {
                console.error('Create redemption error:', redemptionError);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to redeem reward'
                });
            }

            const remainingStamps =
                totalStamps -
                requiredStampsForNextRedemption;

            return res.status(201).json({
                success: true,
                message: 'Reward redeemed successfully',
                redemption,
                progress: {
                    total_stamps: totalStamps,
                    stamps_used_for_redemption:
                        reward.stamps_required,
                    previous_redemptions: previousRedemptions,
                    remaining_stamps: remainingStamps
                }
            });
        } catch (error) {
            console.error('Redeem reward error:', error);

            return res.status(500).json({
                success: false,
                message: 'Server error while redeeming reward'
            });
        }
    }
);

/**
 * @swagger
 * /api/rewards/{id}:
 *   patch:
 *     summary: Update a reward
 *     description: Updates the name, description, or active status of a reward belonging to the authenticated vendor.
 *     tags:
 *       - Rewards
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reward ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Free Large Coffee
 *               description:
 *                 type: string
 *                 example: One free large coffee
 *               is_active:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Reward updated successfully
 *       400:
 *         description: User is not linked to a vendor or invalid reward name
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor owners can update rewards
 *       500:
 *         description: Failed to update reward
 */
router.patch(
    '/:id',
    requireAuth,
    requireRole('vendor_owner'),
    async (req, res) => {
        try {
            const tenantId = req.profile.tenant_id;
            const { id } = req.params;
            const { name, description, is_active } = req.body;

            if (!tenantId) {
                return res.status(400).json({
                    success: false,
                    message: 'User is not linked to a vendor'
                });
            }

            const updates = {};

            if (name !== undefined) {
                if (!name.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Reward name cannot be empty'
                    });
                }

                updates.name = name.trim();
            }

            if (description !== undefined) {
                updates.description = description
                    ? description.trim()
                    : null;
            }

            if (is_active !== undefined) {
                updates.is_active = is_active;
            }

            updates.updated_at = new Date().toISOString();

            const { data: reward, error } = await supabaseAdmin
                .from('rewards')
                .update(updates)
                .eq('id', id)
                .eq('tenant_id', tenantId)
                .select()
                .single();

            if (error) {
                console.error('Update reward error:', error);

                return res.status(500).json({
                    success: false,
                    message: 'Failed to update reward'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Reward updated successfully',
                reward
            });
        } catch (error) {
            console.error('Update reward error:', error);

            return res.status(500).json({
                success: false,
                message: 'Server error while updating reward'
            });
        }
    }
);

module.exports = router;