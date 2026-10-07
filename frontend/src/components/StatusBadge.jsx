import React from 'react';
import { theme, badgeStyle } from '../theme';

/**
 * StatusBadge - Colored status indicator
 * @param {string} status - Status value: 'active', 'hold', 'removed', etc.
 * @param {string} label - Display text (optional, defaults to status capitalized)
 */
const StatusBadge = ({ status, label }) => {
  const statusConfig = {
    active: { bg: theme.colors.success[50], text: theme.colors.success[700], border: theme.colors.success[100] },
    hold: { bg: theme.colors.warning[50], text: theme.colors.warning[600], border: theme.colors.warning[100] },
    removed: { bg: theme.colors.error[50], text: theme.colors.error[700], border: theme.colors.error[100] },
    inactive: { bg: theme.colors.neutral[100], text: theme.colors.neutral[600], border: theme.colors.neutral[200] },
    granted: { bg: theme.colors.primary[50], text: theme.colors.primary[700], border: theme.colors.primary[100] }
  };

  const config = statusConfig[status?.toLowerCase()] || statusConfig.inactive;
  const displayLabel = label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');

  return (
    <span style={{
      ...badgeStyle(),
      backgroundColor: config.bg,
      color: config.text,
      border: `1px solid ${config.border}`
    }}>
      {displayLabel}
    </span>
  );
};

export default StatusBadge;
