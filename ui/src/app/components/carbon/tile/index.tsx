import type { FC, ReactNode } from 'react';
import {
  Tile as CarbonTile,
  SkeletonPlaceholder,
} from '@carbon/react';
import { cn } from '@/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CarbonTileProps {
  children?: ReactNode;
  className?: string;
  isLoading?: boolean;
}

// ─── Tile ────────────────────────────────────────────────────────────────────

/** Carbon Tile — static content container with optional skeleton loading. */
export const Tile: FC<CarbonTileProps> = ({
  children,
  className,
  isLoading = false,
}) => {
  if (isLoading) {
    return <SkeletonPlaceholder className={cn('!w-full', className)} />;
  }

  return <CarbonTile className={cn(className)}>{children}</CarbonTile>;
};
