import React from 'react';
import { theme, cardStyle } from '../theme';

/**
 * StatCard - Dashboard metric display component
 * @param {string} title - Card title
 * @param {number|string} value - Main metric value
 * @param {string} subtitle - Supporting text (optional)
 * @param {string} icon - Icon/emoji (optional)
 * @param {string} color - Accent color: 'primary', 'success', 'warning', 'error'
 */
const StatCard = ({ title, value, subtitle, icon, color = 'primary' }) => {
  const colorMap = {
    primary: { bg: theme.colors.primary[50], text: theme.colors.primary[700] },
    success: { bg: theme.colors.success[50], text: theme.colors.success[700] },
    warning: { bg: theme.colors.warning[50], text: theme.colors.warning[600] },
    error: { bg: theme.colors.error[50], text: theme.colors.error[700] }
  };

  const colors = colorMap[color] || colorMap.primary;

  return (
    <div style={{
      ...cardStyle,
      padding: theme.spacing.xl,
      transition: `transform ${theme.transitions.base}, box-shadow ${theme.transitions.base}`,
      cursor: 'default'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = theme.shadows.lg;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = theme.shadows.md;
    }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: theme.typography.sizes.sm,
            fontWeight: theme.typography.weights.medium,
            color: theme.colors.neutral[500],
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            {title}
          </h3>
          <div style={{
            marginTop: theme.spacing.sm,
            fontSize: theme.typography.sizes['3xl'],
            fontWeight: theme.typography.weights.bold,
            color: theme.colors.neutral[900],
            lineHeight: '1.2'
          }}>
            {value}
          </div>
        </div>
        {icon && (
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: theme.borderRadius.lg,
            backgroundColor: colors.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            flexShrink: 0
          }}>
            {icon}
          </div>
        )}
      </div>
      {subtitle && (
        <p style={{
          margin: 0,
          fontSize: theme.typography.sizes.sm,
          color: theme.colors.neutral[500]
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default StatCard;
