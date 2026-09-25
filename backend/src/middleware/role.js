const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.profile || !req.profile.role) {
      return res.status(403).json({
        success: false,
        message: 'User role not available'
      });
    }

    if (!allowedRoles.includes(req.profile.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this resource'
      });
    }

    next();
  };
};

module.exports = {
  requireRole
};