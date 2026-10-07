const supabaseAdmin = require('../config/supabaseAdmin');

/**
 * Middleware to resolve tenant from URL slug parameter.
 * Extracts :slug from request params and loads tenant context.
 * Attaches tenant info to req.tenant for downstream use.
 */
const resolveTenant = async (req, res, next) => {
  try {
    const slug = req.params.slug;

    if (!slug) {
      // No slug provided - this might be a legacy route or platform-level route
      return next();
    }

    // Validate slug format
    if (!/^[a-z0-9-]{2,60}$/.test(slug)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tenant slug format'
      });
    }

    // Look up tenant by slug
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, business_name, slug, status, created_at')
      .eq('slug', slug)
      .single();

    if (error || !tenant) {
      return res.status(404).json({
        success: false,
        message: `Tenant '${slug}' not found`
      });
    }

    // Check if tenant is active
    if (tenant.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Tenant account is ${tenant.status}. Please contact support.`
      });
    }

    // Attach tenant context to request
    req.tenant = {
      id: tenant.id,
      business_name: tenant.business_name,
      slug: tenant.slug,
      status: tenant.status
    };

    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve tenant'
    });
  }
};

/**
 * Middleware to ensure user belongs to the resolved tenant.
 * Should be used after requireAuth middleware.
 */
const requireTenantMatch = (req, res, next) => {
  if (!req.tenant) {
    return res.status(400).json({
      success: false,
      message: 'Tenant context not available'
    });
  }

  if (!req.profile) {
    return res.status(400).json({
      success: false,
      message: 'User profile not available'
    });
  }

  // Check if user's tenant_id matches the resolved tenant
  if (req.profile.tenant_id !== req.tenant.id) {
    return res.status(403).json({
      success: false,
      message: 'You do not have access to this tenant'
    });
  }

  next();
};

module.exports = {
  resolveTenant,
  requireTenantMatch
};
