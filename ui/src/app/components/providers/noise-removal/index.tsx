import { Dropdown } from '@/app/components/dropdown';
import { FormLabel } from '@/app/components/form-label';
import { FieldSet } from '@/app/components/form/fieldset';
import { HTMLAttributes } from 'react';
import { NoiseCancellation } from '@/providers';
import { Metadata } from '@rapidaai/react';
import { NoiseCancellationConfigComponent } from '@/app/components/providers/noise-removal/provider';

interface NoiseCancellationProviderProps
  extends HTMLAttributes<HTMLDivElement> {
  noiseCancellationProvider?: string;
  onChangeNoiseCancellationProvider: (v: string) => void;
  parameters?: Metadata[];
  onChangeParameter?: (parameters: Metadata[]) => void;
}

export const NoiseCancellationProvider: React.FC<
  NoiseCancellationProviderProps
> = ({
  noiseCancellationProvider,
  onChangeNoiseCancellationProvider,
  parameters,
  onChangeParameter,
  className,
}) => {
  return (
    <div className={['flex flex-col gap-6', className].filter(Boolean).join(' ')}>
      <FieldSet>
        <FormLabel>Background noise provider</FormLabel>
        <Dropdown
          className="bg-light-background max-w-full dark:bg-gray-950"
          currentValue={NoiseCancellation().find(
            x => x.code === noiseCancellationProvider,
          )}
          setValue={v => {
            onChangeNoiseCancellationProvider(v.code);
          }}
          allValue={NoiseCancellation()}
          placeholder="Select noise removal provider"
          option={c => {
            return (
              <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
                <span className="truncate capitalize">{c.name}</span>
              </span>
            );
          }}
          label={c => {
            return (
              <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
                <span className="truncate capitalize">{c.name}</span>
              </span>
            );
          }}
        />
      </FieldSet>
      {noiseCancellationProvider && parameters && onChangeParameter && (
        <NoiseCancellationConfigComponent
          provider={noiseCancellationProvider}
          parameters={parameters}
          onChangeParameter={onChangeParameter}
          onChangeProvider={() => {}}
        />
      )}
    </div>
  );
};
