import React from 'react';
import { theme, cardStyle } from '../theme';

/**
 * SectionCard - Container card for dashboard sections
 * @param {string} title - Section heading
 * @param {string} description - Optional subtitle/description
 * @param {React.ReactNode} children - Card content
 * @param {React.ReactNode} action - Optional action button/header element
 */
const SectionCard = ({ title, description, children, action }) => {
  return (
    <div style={{
      ...cardStyle,
      marginBottom: theme.spacing['2xl']
    }}>
      {(title || action) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: description ? theme.spacing.lg : theme.spacing.xl,
          paddingBottom: theme.spacing.lg,
          borderBottom: `1px solid ${theme.colors.neutral[100]}`
        }}>
          <div>
            {title && (
              <h2 style={{
                margin: 0,
                fontSize: theme.typography.sizes.xl,
                fontWeight: theme.typography.weights.bold,
                color: theme.colors.neutral[900]
              }}>
                {title}
              </h2>
            )}
            {description && (
              <p style={{
                margin: `${theme.spacing.sm} 0 0`,
                fontSize: theme.typography.sizes.sm,
                color: theme.colors.neutral[500]
              }}>
                {description}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default SectionCard;
