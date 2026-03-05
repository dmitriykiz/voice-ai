import { FC, MouseEvent, ReactNode } from 'react';
import { cn } from '@/utils';
import { IButton } from '@/app/components/form/button';
import TooltipPlus from '@/app/components/base/tooltip-plus';

interface IconActionButtonProps {
  tooltip: string;
  icon: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

export const IconActionButton: FC<IconActionButtonProps> = ({ tooltip, icon, onClick, className }) => (
  <IButton className={cn('rounded-none', className)} onClick={onClick}>
    <TooltipPlus
      className="bg-white dark:bg-gray-950 border-[0.5px] rounded-[2px] px-0 py-0"
      popupContent={
        <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-500">{tooltip}</div>
      }
    >
      {icon}
    </TooltipPlus>
  </IButton>
);
