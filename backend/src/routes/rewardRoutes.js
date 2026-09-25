
const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

// Get rewards for current vendor
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

// Create reward
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

            // Get the vendor's active loyalty program
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

// Update reward
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

