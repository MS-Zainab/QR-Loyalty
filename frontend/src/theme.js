/**
 * QR Loyalty Design System - Shared Theme
 * Modern SaaS color palette and styling constants
 */

export const theme = {
  // Primary brand colors
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a'
    },
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      500: '#10b981',
      600: '#059669',
      700: '#047857'
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706'
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c'
    },
    reward: {
      50: '#fffbeb',
      100: '#fef3c7',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706'
    },
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a'
    }
  },

  // Typography scale
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    sizes: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px'
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    }
  },

  // Spacing scale (in px)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '32px',
    '4xl': '40px'
  },

  // Border radius
  borderRadius: {
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px'
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },

  // Transitions
  transitions: {
    fast: '150ms ease',
    base: '200ms ease',
    slow: '300ms ease'
  }
};

// Helper functions for common styles
export const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: theme.borderRadius.lg,
  border: `1px solid ${theme.colors.neutral[200]}`,
  boxShadow: theme.shadows.md,
  padding: theme.spacing['2xl']
};

export const buttonBase = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing.sm,
  padding: `${theme.spacing.md} ${theme.spacing.xl}`,
  borderRadius: theme.borderRadius.md,
  fontWeight: theme.typography.weights.semibold,
  fontSize: theme.typography.sizes.sm,
  transition: `all ${theme.transitions.base}`,
  cursor: 'pointer',
  border: 'none',
  lineHeight: '1.5'
};

export const primaryButton = {
  ...buttonBase,
  backgroundColor: theme.colors.primary[600],
  color: '#ffffff'
};

export const secondaryButton = {
  ...buttonBase,
  backgroundColor: theme.colors.neutral[100],
  color: theme.colors.neutral[700],
  border: `1px solid ${theme.colors.neutral[300]}`
};

export const dangerButton = {
  ...buttonBase,
  backgroundColor: theme.colors.error[600],
  color: '#ffffff'
};

export const successButton = {
  ...buttonBase,
  backgroundColor: theme.colors.success[600],
  color: '#ffffff'
};

export const inputStyle = {
  width: '100%',
  padding: `${theme.spacing.md} ${theme.spacing.lg}`,
  borderRadius: theme.borderRadius.md,
  border: `1px solid ${theme.colors.neutral[300]}`,
  fontSize: theme.typography.sizes.base,
  transition: `border-color ${theme.transitions.fast}`,
  boxSizing: 'border-box',
  outline: 'none'
};

export const badgeStyle = (color = 'neutral') => ({
  display: 'inline-flex',
  alignItems: 'center',
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  borderRadius: theme.borderRadius.full,
  fontSize: theme.typography.sizes.xs,
  fontWeight: theme.typography.weights.semibold,
  letterSpacing: '0.025em'
});

export default theme;
