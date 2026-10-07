import React from 'react';
import { theme } from '../theme';

/**
 * DigitalLoyaltyCard - Premium loyalty stamp card for customers
 * Dynamically renders stamp circles based on program requirements
 * @param {string} businessName - Business/tenant name
 * @param {string} programName - Loyalty program name
 * @param {number} requiredStamps - Total stamps needed for reward
 * @param {number} currentStamps - Customer's current progress
 * @param {string} rewardDescription - Reward description
 * @param {boolean} isUnlocked - Whether reward is unlocked
 * @param {boolean} isRedeemed - Whether reward has been redeemed
 */
const DigitalLoyaltyCard = ({
  businessName,
  programName,
  requiredStamps,
  currentStamps,
  rewardDescription,
  isUnlocked,
  isRedeemed
}) => {
  const safeRequired = Math.max(1, Math.min(50, requiredStamps || 10));
  const safeCurrent = Math.max(0, Math.min(safeRequired, currentStamps || 0));
  const remaining = Math.max(0, safeRequired - safeCurrent);
  const progressPct = Math.round((safeCurrent / safeRequired) * 100);

  // Determine card status
  let statusText = `${safeCurrent} of ${safeRequired} visits completed`;
  let statusColor = theme.colors.primary[600];
  let cardGradient = `linear-gradient(135deg, ${theme.colors.primary[50]} 0%, #ffffff 100%)`;

  if (isRedeemed) {
    statusText = 'Reward Redeemed ✓';
    statusColor = theme.colors.success[600];
    cardGradient = `linear-gradient(135deg, ${theme.colors.success[50]} 0%, #ffffff 100%)`;
  } else if (isUnlocked) {
    statusText = 'Reward Unlocked! 🎉';
    statusColor = theme.colors.reward[600];
    cardGradient = `linear-gradient(135deg, ${theme.colors.reward[50]} 0%, #ffffff 100%)`;
  }

  // Calculate grid layout for stamps
  const cols = safeRequired <= 5 ? safeRequired : safeRequired <= 10 ? 5 : 6;
  const rows = Math.ceil(safeRequired / cols);

  return (
    <div style={{
      background: cardGradient,
      borderRadius: theme.borderRadius.xl,
      border: `2px solid ${isUnlocked ? theme.colors.reward[400] : theme.colors.primary[200]}`,
      boxShadow: theme.shadows.xl,
      padding: theme.spacing['3xl'],
      maxWidth: '500px',
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative corner accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '80px',
        height: '80px',
        background: `linear-gradient(135deg, transparent 50%, ${isUnlocked ? theme.colors.reward[100] : theme.colors.primary[100]} 50%)`,
        opacity: 0.5
      }} />

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: theme.spacing['2xl'], position: 'relative' }}>
        <h3 style={{
          margin: 0,
          fontSize: theme.typography.sizes.lg,
          fontWeight: theme.typography.weights.bold,
          color: theme.colors.neutral[900],
          letterSpacing: '-0.025em'
        }}>
          {businessName || 'Business'}
        </h3>
        {programName && (
          <p style={{
            margin: `${theme.spacing.sm} 0 0`,
            fontSize: theme.typography.sizes.sm,
            color: theme.colors.neutral[500],
            fontWeight: theme.typography.weights.medium
          }}>
            {programName}
          </p>
        )}
      </div>

      {/* Stamp Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: theme.spacing.md,
        maxWidth: '400px',
        margin: `0 auto ${theme.spacing['2xl']}`
      }}>
        {Array.from({ length: safeRequired }).map((_, index) => {
          const isFilled = index < safeCurrent;
          return (
            <div
              key={index}
              style={{
                aspectRatio: '1',
                borderRadius: '50%',
                border: `2px solid ${isFilled ? theme.colors.primary[500] : theme.colors.neutral[300]}`,
                backgroundColor: isFilled ? theme.colors.primary[500] : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: theme.typography.sizes.lg,
                transition: `all ${theme.transitions.base}`,
                boxShadow: isFilled ? theme.shadows.md : 'none',
                position: 'relative'
              }}
            >
              {isFilled && (
                <span style={{ color: '#ffffff', fontWeight: 'bold' }}>✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Info */}
      <div style={{ textAlign: 'center', marginBottom: theme.spacing.xl }}>
        <div style={{
          fontSize: theme.typography.sizes['2xl'],
          fontWeight: theme.typography.weights.bold,
          color: statusColor,
          marginBottom: theme.spacing.sm
        }}>
          {statusText}
        </div>

        {remaining > 0 && !isRedeemed && (
          <div style={{
            fontSize: theme.typography.sizes.base,
            color: theme.colors.neutral[600],
            fontWeight: theme.typography.weights.medium
          }}>
            {remaining} {remaining === 1 ? 'visit' : 'visits'} remaining to unlock your reward
          </div>
        )}

        {/* Progress Bar */}
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: theme.colors.neutral[200],
          borderRadius: theme.borderRadius.full,
          marginTop: theme.spacing.lg,
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${progressPct}%`,
            height: '100%',
            backgroundColor: isUnlocked ? theme.colors.reward[500] : theme.colors.primary[500],
            borderRadius: theme.borderRadius.full,
            transition: `width ${theme.transitions.slow}`
          }} />
        </div>
        <div style={{
          marginTop: theme.spacing.sm,
          fontSize: theme.typography.sizes.sm,
          color: theme.colors.neutral[500],
          fontWeight: theme.typography.weights.semibold
        }}>
          {progressPct}% Complete
        </div>
      </div>

      {/* Reward Section */}
      {rewardDescription && (
        <div style={{
          backgroundColor: isUnlocked ? theme.colors.reward[50] : theme.colors.neutral[50],
          border: `1px solid ${isUnlocked ? theme.colors.reward[200] : theme.colors.neutral[200]}`,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing.lg,
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: theme.typography.sizes.xs,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.colors.neutral[500],
            fontWeight: theme.typography.weights.semibold,
            marginBottom: theme.spacing.sm
          }}>
            Your Reward
          </div>
          <div style={{
            fontSize: theme.typography.sizes.lg,
            fontWeight: theme.typography.weights.bold,
            color: isUnlocked ? theme.colors.reward[700] : theme.colors.neutral[700]
          }}>
            {rewardDescription}
          </div>
        </div>
      )}
    </div>
  );
};

export default DigitalLoyaltyCard;
