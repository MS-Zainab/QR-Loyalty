const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const { isUuid } = require('../middleware/validation');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

/**
 * @swagger
 * /api/loyalty:
 *   get:
 *     summary: Get current vendor loyalty program
 *     description: Returns the loyalty program belonging to the authenticated vendor. Vendor owners and staff can access this endpoint.
 *     tags:
 *       - Loyalty
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty program fetched successfully
 *       400:
 *         description: User is not linked to a vendor
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: Vendor owner or vendor staff role required
 *       500:
 *         description: Server error while fetching loyalty program
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

      // A tenant may legitimately have more than one program (the customer
      // progress logic supports it), so fetch all rows. `loyalty` keeps the
      // most recent program for backward compatibility with existing
      // consumers.
      const { data: programs, error } = await supabaseAdmin
        .from('loyalty_programs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get loyalty program error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to fetch loyalty program'
        });
      }

      const programList = programs || [];
      const latest = programList[0] || null;

      return res.status(200).json({
        success: true,
        loyalty: latest,
        program: latest,
        programs: programList
      });
    } catch (error) {
      console.error('Get loyalty program error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while fetching loyalty program'
      });
    }
  }
);

/**
 * @swagger
 * /api/loyalty:
 *   post:
 *     summary: Create loyalty program
 *     description: Creates a new loyalty program for the authenticated vendor. Only the vendor owner can perform this action.
 *     tags:
 *       - Loyalty
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
 *                 description: Name of the loyalty program
 *                 example: Loyalty Demo Rewards
 *               stamps_required:
 *                 type: integer
 *                 minimum: 1
 *                 description: Number of stamps required to complete the loyalty program
 *                 example: 10
 *               reward_description:
 *                 type: string
 *                 description: Optional description of the reward customers earn
 *                 example: Free Coffee of Any Size
 *     responses:
 *       200:
 *         description: Loyalty program created successfully
 *       400:
 *         description: Invalid loyalty program data or user is not linked to a vendor
 *       401:
 *         description: Authentication required or token is invalid/expired
 *       403:
 *         description: Vendor owner role required
 *       500:
 *         description: Server error while saving loyalty program
 */
router.post(
  '/',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const { name, stamps_required, reward_description } = req.body;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'User is not linked to a vendor'
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Loyalty program name is required'
        });
      }

      if (
        !Number.isInteger(stamps_required) ||
        stamps_required < 1
      ) {
        return res.status(400).json({
          success: false,
          message: 'Stamps required must be a positive whole number'
        });
      }

      if (
        reward_description !== undefined &&
        typeof reward_description !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          message: 'reward_description must be a string'
        });
      }

      // A tenant can run multiple loyalty programs, so every POST creates a
      // new program; edits to an existing program go through PATCH /:id.
      const programData = {
        tenant_id: tenantId,
        name: name.trim(),
        stamps_required
      };

      if (reward_description !== undefined) {
        programData.reward_description = reward_description.trim();
      }

      const { data: program, error } = await supabaseAdmin
        .from('loyalty_programs')
        .insert(programData)
        .select()
        .single();

      if (error) {
        console.error('Save loyalty program error:', error);

        return res.status(500).json({
          success: false,
          message: 'Failed to save loyalty program'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Loyalty program created successfully',
        loyalty: program,
        program
      });
    } catch (error) {
      console.error('Save loyalty program error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while saving loyalty program'
      });
    }
  }
);


/**
 * @swagger
 * /api/loyalty/{id}:
 *   patch:
 *     summary: Update loyalty program
 *     description: Allows a vendor owner to update their own loyalty program rules.
 *     tags:
 *       - Loyalty
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Loyalty program ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               stamps_required:
 *                 type: integer
 *                 minimum: 1
 *               reward_description:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Loyalty program updated successfully
 *       400:
 *         description: Invalid loyalty program data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Only vendor owners can update loyalty programs
 *       404:
 *         description: Loyalty program not found
 *       500:
 *         description: Failed to update loyalty program
 */
router.patch(
  '/:id',
  requireAuth,
  requireRole('vendor_owner'),
  async (req, res) => {
    try {
      const tenantId = req.profile.tenant_id;
      const loyaltyProgramId = req.params.id;

      if (!tenantId) {
        return res.status(403).json({
          success: false,
          message: 'Vendor owner is not associated with a tenant'
        });
      }

      const {
        name,
        stamps_required,
        reward_description,
        is_active
      } = req.body;

      if (!isUuid(loyaltyProgramId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid loyalty program ID is required'
        });
      }

      // Make sure at least one field is provided
      if (
        name === undefined &&
        stamps_required === undefined &&
        reward_description === undefined &&
        is_active === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: 'At least one field is required for update'
        });
      }

      // Validate values when provided
      if (
        stamps_required !== undefined &&
        (!Number.isInteger(stamps_required) ||
          stamps_required < 1)
      ) {
        return res.status(400).json({
          success: false,
          message: 'stamps_required must be a positive integer'
        });
      }

      if (
        name !== undefined &&
        (typeof name !== 'string' ||
          name.trim().length === 0)
      ) {
        return res.status(400).json({
          success: false,
          message: 'name must be a non-empty string'
        });
      }

      if (
        reward_description !== undefined &&
        typeof reward_description !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          message: 'reward_description must be a string'
        });
      }

      if (
        is_active !== undefined &&
        typeof is_active !== 'boolean'
      ) {
        return res.status(400).json({
          success: false,
          message: 'is_active must be a boolean'
        });
      }

      // Verify that the loyalty program belongs to this owner
      const { data: existingProgram, error: existingError } =
        await supabaseAdmin
          .from('loyalty_programs')
          .select(
            'id, tenant_id, name, stamps_required, reward_description, is_active'
          )
          .eq('id', loyaltyProgramId)
          .eq('tenant_id', tenantId)
          .single();

      if (existingError || !existingProgram) {
        return res.status(404).json({
          success: false,
          message: 'Loyalty program not found'
        });
      }

      // Build update object
      const updateData = {};

      if (name !== undefined) {
        updateData.name = name.trim();
      }

      if (stamps_required !== undefined) {
        updateData.stamps_required = stamps_required;
      }

      if (reward_description !== undefined) {
        updateData.reward_description =
          reward_description.trim();
      }

      if (is_active !== undefined) {
        updateData.is_active = is_active;
      }

      updateData.updated_at = new Date().toISOString();

      const { data: updatedProgram, error: updateError } =
        await supabaseAdmin
          .from('loyalty_programs')
          .update(updateData)
          .eq('id', loyaltyProgramId)
          .eq('tenant_id', tenantId)
          .select(
            'id, tenant_id, name, stamps_required, reward_description, is_active, created_at, updated_at'
          )
          .single();

      if (updateError || !updatedProgram) {
        console.error(
          'Loyalty program update error:',
          updateError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to update loyalty program'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Loyalty program updated successfully',
        loyalty: updatedProgram,
        program: updatedProgram,
        loyalty_program: updatedProgram
      });
    } catch (error) {
      console.error(
        'Loyalty program update error:',
        error
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to update loyalty program'
      });
    }
  }
);

module.exports = router;
