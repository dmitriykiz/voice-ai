import { Dropdown } from '@/app/components/dropdown';
import { CredentialDropdown } from '@/app/components/dropdown/credential-dropdown';
import { FormLabel } from '@/app/components/form-label';
import { FieldSet } from '@/app/components/form/fieldset';
import { ProviderComponentProps } from '@/app/components/providers';
import { SpeechToTextConfigComponent } from '@/app/components/providers/speech-to-text/provider';
import { SPEECH_TO_TEXT_PROVIDER } from '@/providers';
import { Metadata, VaultCredential } from '@rapidaai/react';
import { useCallback } from 'react';

export const SpeechToTextProvider: React.FC<ProviderComponentProps> = props => {
  const { parameters, provider, onChangeParameter, onChangeProvider } = props;
  const getParamValue = useCallback(
    (key: string) => {
      return parameters?.find(p => p.getKey() === key)?.getValue() ?? '';
    },
    [parameters],
  );
  const updateParameter = (key: string, value: string) => {
    const updatedParams = [...(parameters || [])];
    const existingIndex = updatedParams.findIndex(p => p.getKey() === key);
    const newParam = new Metadata();
    newParam.setKey(key);
    newParam.setValue(value);
    if (existingIndex >= 0) {
      updatedParams[existingIndex] = newParam;
    } else {
      updatedParams.push(newParam);
    }
    onChangeParameter(updatedParams);
  };

  return (
    <>
      <div className="flex flex-col gap-6 w-full max-w-6xl">
        <FieldSet className="relative col-span-1">
          <FormLabel>Provider</FormLabel>
          <Dropdown
            className="bg-light-background max-w-full dark:bg-gray-950"
            currentValue={
              SPEECH_TO_TEXT_PROVIDER.find(x => x.code === provider) || null
            }
            setValue={v => {
              onChangeProvider(v.code);
            }}
            allValue={SPEECH_TO_TEXT_PROVIDER}
            placeholder="Select voice input"
            option={c => (
              <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
                <img
                  alt=""
                  loading="lazy"
                  width={16}
                  height={16}
                  className="sm:h-4 sm:w-4 w-4 h-4 align-middle block shrink-0"
                  src={c.image}
                />
                <span className="truncate capitalize">{c.name}</span>
              </span>
            )}
            label={c => (
              <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
                <img
                  alt=""
                  loading="lazy"
                  width={16}
                  height={16}
                  className="sm:h-4 sm:w-4 w-4 h-4 align-middle block shrink-0"
                  src={c.image}
                />
                <span className="truncate capitalize">{c.name}</span>
              </span>
            )}
          />
        </FieldSet>
        {provider && (
          <CredentialDropdown
            className="bg-light-background max-w-full dark:bg-gray-950"
            onChangeCredential={(c: VaultCredential) => {
              updateParameter('rapida.credential_id', c.getId());
            }}
            currentCredential={getParamValue('rapida.credential_id')}
            provider={provider}
          />
        )}
        {provider && (
          <div className="grid grid-cols-3 gap-6">
            <SpeechToTextConfigComponent {...props} />
          </div>
        )}
      </div>
    </>
  );
};
