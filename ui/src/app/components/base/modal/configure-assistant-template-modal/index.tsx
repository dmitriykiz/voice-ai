import React, { FC, useState } from 'react';
import { IBlueBGButton, ICancelButton } from '@/app/components/form/button';
import { GenericModal, ModalProps } from '@/app/components/base/modal';
import { ModalFitHeightBlock } from '@/app/components/blocks/modal-fit-height-block';
import { ModalHeader } from '@/app/components/base/modal/modal-header';
import { ModalTitleBlock } from '@/app/components/blocks/modal-title-block';
import { ModalBody } from '@/app/components/base/modal/modal-body';
import { ModalFooter } from '@/app/components/base/modal/modal-footer';
import { cn } from '@/utils';
import assistantTemplates from '@/prompts/assistants/index.json';
import { Check } from 'lucide-react';
import { CornerBorderOverlay } from '@/app/components/base/corner-border';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssistantTemplate {
  name: string;
  description: string;
  category: string;
  provider: string;
  model: string;
  parameters: {
    temperature: number;
  };
  instruction: {
    role: string;
    content: string;
  }[];
}

interface ConfigureAssistantTemplateDialogProps extends ModalProps {
  onSelectTemplate?: (template: AssistantTemplate) => void;
}

// ── Category colours ──────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Support:     'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  Sales:       'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  HR:          'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  Healthcare:  'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  Finance:     'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
  'E-commerce':'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  IT:          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'Real Estate':'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const ConfigureAssistantTemplateDialog: FC<
  ConfigureAssistantTemplateDialogProps
> = props => {
  const [selectedTemplate, setSelectedTemplate] =
    useState<AssistantTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const templates = assistantTemplates as AssistantTemplate[];
  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category)))];

  const visible =
    activeCategory === 'All'
      ? templates
      : templates.filter(t => t.category === activeCategory);

  const handleContinue = () => {
    if (selectedTemplate && props.onSelectTemplate) {
      props.onSelectTemplate(selectedTemplate);
    }
    props.setModalOpen(false);
  };

  return (
    <GenericModal modalOpen={props.modalOpen} setModalOpen={props.setModalOpen}>
      <ModalFitHeightBlock
        className="w-[960px] flex flex-col items-stretch"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <ModalHeader onClose={() => props.setModalOpen(false)}>
          <ModalTitleBlock>Select a usecase template</ModalTitleBlock>
        </ModalHeader>

        {/* Context bar */}
        <div className="shrink-0 px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Choose a pre-configured assistant template to auto-fill your model,
            prompt, and parameters. You can customise everything after selecting.
          </p>
        </div>

        {/* Category filter */}
        <div className="shrink-0 px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setActiveCategory(cat);
                setSelectedTemplate(null);
              }}
              className={cn(
                'h-6 px-3 text-[11px] font-medium transition-colors duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                activeCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700',
              )}
            >
              {cat}
            </button>
          ))}
          {selectedTemplate && (
            <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
              Selected:{' '}
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {selectedTemplate.name}
              </span>
            </span>
          )}
        </div>

        {/* Scrollable tile grid */}
        <ModalBody className="flex-1 min-h-0 overflow-y-auto px-6 py-6 gap-0">
          <div className="grid grid-cols-2 border-l border-t border-gray-200 dark:border-gray-800">
            {visible.map((template, index) => {
              const isSelected = selectedTemplate?.name === template.name;
              const categoryColor =
                CATEGORY_COLORS[template.category] ??
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

              return (
                <div
                  key={index}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedTemplate(template)}
                  onKeyDown={e =>
                    (e.key === 'Enter' || e.key === ' ') &&
                    setSelectedTemplate(template)
                  }
                  className={cn(
                    'relative flex flex-col p-4 border-r border-b border-gray-200 dark:border-gray-800 cursor-pointer transition-colors duration-100 select-none outline-none group',
                    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                    isSelected
                      ? 'bg-primary/5 dark:bg-primary/10'
                      : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60',
                  )}
                >
                  {/* Corner accent brackets */}
                  <CornerBorderOverlay
                    className={isSelected ? 'opacity-100' : undefined}
                  />

                  {/* Carbon checkmark — top-right square badge */}
                  <div
                    className={cn(
                      'absolute top-0 right-0 w-6 h-6 flex items-center justify-center transition-colors duration-100 z-20',
                      isSelected ? 'bg-primary' : 'bg-transparent',
                    )}
                  >
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                    )}
                  </div>

                  {/* Category pill */}
                  <span
                    className={cn(
                      'self-start mb-2 inline-flex items-center h-5 px-2 text-[10px] font-semibold tracking-[0.06em] uppercase',
                      categoryColor,
                    )}
                  >
                    {template.category}
                  </span>

                  {/* Template name */}
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mb-1.5 pr-6">
                    {template.name}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-4 flex-1">
                    {template.description}
                  </p>

                  {/* Metadata tags */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {template.provider}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                      {template.model}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500">
                      Temp&nbsp;{template.parameters.temperature}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ModalBody>

        <ModalFooter>
          <ICancelButton onClick={() => props.setModalOpen(false)}>
            Cancel
          </ICancelButton>
          <IBlueBGButton
            type="button"
            disabled={!selectedTemplate}
            onClick={handleContinue}
          >
            Use template
          </IBlueBGButton>
        </ModalFooter>
      </ModalFitHeightBlock>
    </GenericModal>
  );
};
