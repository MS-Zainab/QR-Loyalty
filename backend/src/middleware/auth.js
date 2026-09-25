const supabase = require('../config/supabase');
const supabaseAdmin = require('../config/supabaseAdmin');

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const { data: authData, error: authError } =
      await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token'
      });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
  .from('profiles')
  .select('id, auth_user_id, tenant_id, full_name, role, status')
  .eq('auth_user_id', authData.user.id)
  .single();

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        message: 'User profile not found'
      });
    }

    if (profile.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active'
      });
    }

    req.user = authData.user;
    req.profile = profile;

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    return res.status(500).json({
      success: false,
      message: 'Authentication verification failed'
    });
  }
};

module.exports = {
  requireAuth
};