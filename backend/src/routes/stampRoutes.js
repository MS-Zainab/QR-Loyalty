const express = require('express');

const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/role');
const supabaseAdmin = require('../config/supabaseAdmin');

const router = express.Router();

// Issue one loyalty stamp to a customer
router.post(
  '/',
  requireAuth,
  requireRole('vendor_staff'),
  async (req, res) => {
    try {
      const { customer_id, visit_id } = req.body;

      if (!customer_id || !visit_id) {
        return res.status(400).json({
          success: false,
          message: 'Customer ID and visit ID are required'
        });
      }

      const tenantId = req.profile.tenant_id;
      const profileId = req.profile.id;

      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Staff member is not linked to a vendor'
        });
      }

      // Find operational staff record
      const { data: staffRecord, error: staffError } =
        await supabaseAdmin
          .from('staff')
          .select('id')
          .eq('profile_id', profileId)
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .maybeSingle();

      if (staffError) {
        console.error('Staff lookup error:', staffError);

        return res.status(500).json({
          success: false,
          message: 'Failed to find staff record'
        });
      }

      if (!staffRecord) {
        return res.status(400).json({
          success: false,
          message: 'Active staff record not found'
        });
      }

      const staffId = staffRecord.id;

      // Verify customer belongs to this vendor
      const { data: customer, error: customerError } =
        await supabaseAdmin
          .from('customers')
          .select('id, tenant_id, status')
          .eq('id', customer_id)
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .maybeSingle();

      if (customerError) {
        console.error('Customer lookup error:', customerError);

        return res.status(500).json({
          success: false,
          message: 'Failed to find customer'
        });
      }

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found for this vendor'
        });
      }

      // Verify visit belongs to same vendor and customer
      const { data: visit, error: visitError } =
        await supabaseAdmin
          .from('visits')
          .select(
            'id, tenant_id, customer_id, staff_id, visited_at'
          )
          .eq('id', visit_id)
          .eq('tenant_id', tenantId)
          .eq('customer_id', customer_id)
          .maybeSingle();

      if (visitError) {
        console.error('Visit lookup error:', visitError);

        return res.status(500).json({
          success: false,
          message: 'Failed to find visit'
        });
      }

      if (!visit) {
        return res.status(404).json({
          success: false,
          message: 'Visit not found for this customer'
        });
      }

      // Prevent more than one stamp for the same visit
      const { data: existingStamp, error: existingStampError } =
        await supabaseAdmin
          .from('stamps')
          .select('id')
          .eq('visit_id', visit_id)
          .maybeSingle();

      if (existingStampError) {
        console.error(
          'Existing stamp lookup error:',
          existingStampError
        );

        return res.status(500).json({
          success: false,
          message: 'Failed to check existing stamp'
        });
      }

      if (existingStamp) {
        return res.status(409).json({
          success: false,
          message: 'A stamp has already been issued for this visit'
        });
      }

      // Create stamp
      const { data: stamp, error: stampError } =
        await supabaseAdmin
          .from('stamps')
          .insert({
            tenant_id: tenantId,
            customer_id: customer_id,
            staff_id: staffId,
            visit_id: visit_id
          })
          .select(
            'id, tenant_id, customer_id, staff_id, visit_id, created_at'
          )
          .single();

      if (stampError) {
        console.error('Create stamp error:', stampError);

        return res.status(500).json({
          success: false,
          message: 'Failed to issue loyalty stamp'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Loyalty stamp issued successfully',
        stamp
      });
    } catch (error) {
      console.error('Issue stamp error:', error);

      return res.status(500).json({
        success: false,
        message: 'Server error while issuing loyalty stamp'
      });
    }
  }
);

module.exports = router;