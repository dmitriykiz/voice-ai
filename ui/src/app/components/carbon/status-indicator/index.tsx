import { FC } from 'react';
import { unstable__ShapeIndicator as ShapeIndicatorModule } from '@carbon/react';

// ─── Status mapping to Carbon ShapeIndicator kinds ───────────────────────────
// failed     — red X (error, failure)
// critical   — red diamond (critical error)
// high       — orange triangle up (high severity)
// medium     — orange diamond (medium severity)
// low        — yellow triangle down (low severity)
// cautious   — yellow diamond (warning, pending)
// undefined  — gray dash (unknown)
// stable     — green circle (healthy, success)
// informative — blue square (info, in progress)
// incomplete — gray dashed circle (not started, inactive)
// draft      — gray half circle (draft, archived)

const statusMap: Record<string, { kind: string; label: string }> = {
  // Success / complete — stable (green)
  SUCCESS: { kind: 'stable', label: 'Success' },
  success: { kind: 'stable', label: 'Success' },
  COMPLETE: { kind: 'stable', label: 'Complete' },
  complete: { kind: 'stable', label: 'Complete' },
  COMPLETED: { kind: 'stable', label: 'Completed' },
  completed: { kind: 'stable', label: 'Completed' },
  'STREAM-STOPPED': { kind: 'stable', label: 'Complete' },
  CONNECTED: { kind: 'stable', label: 'Connected' },
  Connected: { kind: 'stable', label: 'Connected' },
  DEPLOYED: { kind: 'stable', label: 'Deployed' },
  deployed: { kind: 'stable', label: 'Deployed' },

  // Active / in progress — informative (blue)
  ACTIVE: { kind: 'incomplete', label: 'Active' },
  active: { kind: 'incomplete', label: 'Active' },
  IN_PROGRESS: { kind: 'informative', label: 'In Progress' },
  in_progress: { kind: 'informative', label: 'In Progress' },

  // Pending / waiting — cautious (yellow)
  PENDING: { kind: 'cautious', label: 'Pending' },
  pending: { kind: 'cautious', label: 'Pending' },
  INVITED: { kind: 'cautious', label: 'Invited' },
  invited: { kind: 'cautious', label: 'Invited' },
  WAITLIST: { kind: 'low', label: 'Waitlist' },
  waitlist: { kind: 'low', label: 'Waitlist' },

  // Queued — medium (orange)
  QUEUED: { kind: 'medium', label: 'Queued' },
  queued: { kind: 'medium', label: 'Queued' },

  // Inactive / not started — incomplete (gray dashed)
  INACTIVE: { kind: 'incomplete', label: 'Inactive' },
  inactive: { kind: 'incomplete', label: 'Inactive' },
  DISABLED: { kind: 'incomplete', label: 'Disabled' },
  disabled: { kind: 'incomplete', label: 'Disabled' },

  // Archived — draft (gray half)
  ARCHIEVE: { kind: 'draft', label: 'Archived' },
  archived: { kind: 'draft', label: 'Archived' },

  // Failed — failed (red X)
  FAILED: { kind: 'failed', label: 'Failed' },
  failed: { kind: 'failed', label: 'Failed' },

  // Error — critical (red diamond)
  ERROR: { kind: 'critical', label: 'Error' },
  error: { kind: 'critical', label: 'Error' },
};

const defaultStatus = { kind: 'undefined', label: 'Unknown' };
const ShapeIndicator =
  (ShapeIndicatorModule as unknown as { default?: FC<any> }).default ||
  (ShapeIndicatorModule as unknown as FC<any>);

// ─── Component ───────────────────────────────────────────────────────────────

export interface CarbonStatusIndicatorProps {
  state: string;
  textSize?: 12 | 14;
}

export const CarbonStatusIndicator: FC<CarbonStatusIndicatorProps> = ({
  state,
  textSize = 12,
}) => {
  const { kind, label } = statusMap[state] || defaultStatus;
  return <ShapeIndicator kind={kind as any} label={label} textSize={textSize} />;
};
