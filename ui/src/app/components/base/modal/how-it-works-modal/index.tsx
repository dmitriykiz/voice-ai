import { ModalBody } from '@/app/components/base/modal/modal-body';
import React, { FC } from 'react';
import { GenericModal, ModalProps } from '@/app/components/base/modal';
import { Check } from 'lucide-react';
import { ModalFooter } from '@/app/components/base/modal/modal-footer';
import { ModalFitHeightBlock } from '@/app/components/blocks/modal-fit-height-block';
import { ModalHeader } from '@/app/components/base/modal/modal-header';
import { ModalTitleBlock } from '@/app/components/blocks/modal-title-block';

export const HowItWorksDialog: FC<
  ModalProps & {
    steps: Array<{ title: string; icon: React.ReactElement; description: string }>;
    title?: string;
    className?: string;
  }
> = ({ modalOpen, setModalOpen, steps, title = 'How it works', className = 'w-[800px]' }) => (
  <GenericModal modalOpen={modalOpen} setModalOpen={setModalOpen}>
    <ModalFitHeightBlock className={className}>
      <ModalHeader onClose={() => setModalOpen(false)}>
        <ModalTitleBlock>{title}</ModalTitleBlock>
      </ModalHeader>
      <HowItWorks steps={steps} />
      <ModalFooter>
        <button
          type="button"
          className="inline-flex items-center gap-2 h-10 px-4 text-sm text-white bg-primary hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          onClick={() => setModalOpen(false)}
        >
          Got it
          <Check className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </ModalFooter>
    </ModalFitHeightBlock>
  </GenericModal>
);

export const HowItWorks: FC<{
  steps: Array<{
    title: string;
    icon: React.ReactElement;
    description: string;
  }>;
}> = React.memo(({ steps }) => {
  return (
    <ModalBody>
      <div className="grid grid-flow-col divide-x divide-gray-200 dark:divide-gray-800 -mx-8">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col px-8">
            {/* Step indicator row */}
            <div className="flex items-center gap-2 mb-5">
              <span className="text-[10px] font-medium tracking-[0.08em] text-gray-400 dark:text-gray-500 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="w-px h-3 bg-gray-300 dark:bg-gray-700" />
              <div className="text-primary [&_svg]:w-4 [&_svg]:h-4">
                {step.icon}
              </div>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 leading-snug">
              {step.title}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </ModalBody>
  );
});
