import { useEffect, useState } from 'react';
import {
  ConnectionConfig,
  CreateProviderCredentialRequest,
} from '@rapidaai/react';
import { useCurrentCredential } from '@/hooks/use-credential';
import { CreateProviderKey } from '@rapidaai/react';
import { ErrorMessage } from '@/app/components/form/error-message';
import { useRapidaStore } from '@/hooks';
import toast from 'react-hot-toast/headless';
import { ModalProps } from '@/app/components/base/modal';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/app/components/carbon/modal';
import {
  PrimaryButton,
  SecondaryButton,
  TertiaryButton,
} from '@/app/components/carbon/button';
import { Stack, TextInput, TextArea } from '@/app/components/carbon/form';
import { Dropdown, Button } from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { connectionConfig } from '@/configs';
import { useProviderContext } from '@/context/provider-context';
import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import { INTEGRATION_PROVIDER, RapidaProvider } from '@/providers';

interface CreateProviderCredentialDialogProps extends ModalProps {
  currentProvider?: string | null;
}

export function CreateProviderCredentialDialog(
  props: CreateProviderCredentialDialogProps,
) {
  const { authId, projectId, token } = useCurrentCredential();
  const [provider, setProvider] = useState<RapidaProvider | null>(null);
  const providerCtx = useProviderContext();
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const [error, setError] = useState('');
  const [keyName, setKeyName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    setProvider(
      INTEGRATION_PROVIDER.slice()
        .reverse()
        .find(x => x.code === props.currentProvider) || null,
    );
  }, [props.currentProvider]);

  const handleConfigChange = (name: string, value: string) => {
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const validateAndSubmit = () => {
    if (!provider) {
      setError('Please select the provider which you want to create the key.');
      return;
    }
    if (!keyName.trim()) {
      setError('Please provide a valid key name for the credential.');
      return;
    }
    const missingFields = provider.configurations?.filter(
      configOption => !config[configOption.name]?.trim(),
    );
    if (missingFields && missingFields.length > 0) {
      setError(
        `Please fill out the following fields: ${missingFields
          .map(field => field.label)
          .join(', ')}`,
      );
      return;
    }

    showLoader();
    const requestObject = new CreateProviderCredentialRequest();
    requestObject.setProvider(provider.code);
    requestObject.setCredential(Struct.fromJavaScript(config));
    requestObject.setName(keyName);

    CreateProviderKey(
      connectionConfig,
      requestObject,
      ConnectionConfig.WithDebugger({
        authorization: token,
        userId: authId,
        projectId: projectId,
      }),
    )
      .then(cpkr => {
        hideLoader();
        if (cpkr?.getSuccess()) {
          toast.success(
            'Provider credential have been successfully added to the vault.',
          );
          providerCtx.reloadProviderCredentials();
          props.setModalOpen(false);
          setError('');
          setKeyName('');
          setConfig({});
        } else {
          let errorMessage = cpkr?.getError();
          setError(
            errorMessage?.getHumanmessage() ??
              'Unable to process your request. Please try again later.',
          );
        }
      })
      .catch(() => {
        hideLoader();
        toast.error(
          'Unable to create provider credential, please try again later.',
        );
      });
  };

  return (
    <Modal
      open={props.modalOpen}
      onClose={() => props.setModalOpen(false)}
      size="sm"
      selectorPrimaryFocus="#credential-key-name"
      preventCloseOnClickOutside
    >
      <ModalHeader
        label="Credentials"
        title="Create provider credential"
        onClose={() => props.setModalOpen(false)}
      />
      <ModalBody hasForm>
        <Stack gap={6}>
          <Dropdown
            id="credential-provider"
            titleText="Select your provider"
            label="Select the provider"
            items={INTEGRATION_PROVIDER}
            selectedItem={provider}
            itemToString={(item: RapidaProvider | null) => item?.name || ''}
            onChange={({ selectedItem }) => {
              setError('');
              setKeyName('');
              setConfig({});
              setProvider(selectedItem || null);
            }}
          />
          <TextInput
            id="credential-key-name"
            labelText="Key Name"
            placeholder="Assign a unique name to this provider key"
            value={keyName}
            required
            onChange={e => setKeyName(e.target.value)}
          />
          {provider &&
            provider.configurations?.map((x, idx) =>
              x.type === 'text' ? (
                <TextArea
                  key={idx}
                  id={`config-${x.name}`}
                  labelText={x.label}
                  placeholder={x.label}
                  value={config[x.name] || ''}
                  required
                  onChange={e => handleConfigChange(x.name, e.target.value)}
                />
              ) : x.type === 'key_value' ? (
                <CredentialKeyValueField
                  key={idx}
                  name={x.name}
                  label={x.label}
                  value={config[x.name] || ''}
                  onChange={value => handleConfigChange(x.name, value)}
                />
              ) : (
                <TextInput
                  key={idx}
                  id={`config-${x.name}`}
                  labelText={x.label}
                  placeholder={x.label}
                  value={config[x.name] || ''}
                  required
                  onChange={e => handleConfigChange(x.name, e.target.value)}
                />
              ),
            )}
          <ErrorMessage message={error} />
        </Stack>
      </ModalBody>
      <ModalFooter>
        <SecondaryButton size="lg" onClick={() => props.setModalOpen(false)}>
          Cancel
        </SecondaryButton>
        <PrimaryButton
          size="lg"
          onClick={validateAndSubmit}
          isLoading={loading}
        >
          Configure
        </PrimaryButton>
      </ModalFooter>
    </Modal>
  );
}

function CredentialKeyValueField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const parseEntries = (raw: string): { key: string; value: string }[] => {
    if (!raw) return [];
    try {
      const obj = JSON.parse(raw);
      return Object.entries(obj).map(([key, value]) => ({
        key,
        value: String(value),
      }));
    } catch {
      return [];
    }
  };

  const serialize = (entries: { key: string; value: string }[]): string => {
    const obj: Record<string, string> = {};
    for (const e of entries) {
      if (e.key) obj[e.key] = e.value;
    }
    return Object.keys(obj).length > 0 ? JSON.stringify(obj) : '';
  };

  const [entries, setEntries] = useState<{ key: string; value: string }[]>(() =>
    parseEntries(value),
  );

  useEffect(() => {
    setEntries(parseEntries(value));
  }, [value]);

  const syncEntries = (next: { key: string; value: string }[]) => {
    setEntries(next);
    onChange(serialize(next));
  };

  const updateEntry = (index: number, field: 'key' | 'value', val: string) => {
    const next = [...entries];
    next[index] = { ...next[index], [field]: val };
    syncEntries(next);
  };

  const removeEntry = (index: number) => {
    syncEntries(entries.filter((_, i) => i !== index));
  };

  const addEntry = () => {
    setEntries(prev => [...prev, { key: '', value: '' }]);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500 dark:text-gray-400">
        {label} ({entries.length})
      </p>
      <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 text-sm [&_input]:!border-none [&_.cds--text-input]:!border-none [&_.cds--text-input]:!outline-none [&_.cds--form-item]:!m-0">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900">
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2 border-b border-r border-gray-200 dark:border-gray-700 w-1/2">
              Key
            </th>
            <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-2 border-b border-r border-gray-200 dark:border-gray-700 w-1/2">
              Value
            </th>
            <th className="border-b border-gray-200 dark:border-gray-700 w-8" />
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={index}
              className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
            >
              <td className="border-r border-gray-200 dark:border-gray-700 p-0">
                <TextInput
                  id={`kv-key-${name}-${index}`}
                  labelText=""
                  hideLabel
                  value={entry.key}
                  onChange={e => updateEntry(index, 'key', e.target.value)}
                  placeholder="Key"
                  size="md"
                />
              </td>
              <td className="border-r border-gray-200 dark:border-gray-700 p-0">
                <TextInput
                  id={`kv-val-${name}-${index}`}
                  labelText=""
                  hideLabel
                  value={entry.value}
                  onChange={e => updateEntry(index, 'value', e.target.value)}
                  placeholder="Value"
                  size="md"
                />
              </td>
              <td className="p-0 text-center">
                <Button
                  hasIconOnly
                  renderIcon={TrashCan}
                  iconDescription="Remove"
                  kind="danger--ghost"
                  size="sm"
                  onClick={() => removeEntry(index)}
                />
              </td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr>
              <td
                colSpan={3}
                className="px-3 py-4 text-xs text-gray-500 dark:text-gray-400 text-center"
              >
                No {label.toLowerCase()} added yet. Add at least one key-value
                pair.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <TertiaryButton
        size="md"
        renderIcon={Add}
        onClick={addEntry}
        className="!w-full !max-w-none"
      >
        Add {label.toLowerCase()}
      </TertiaryButton>
    </div>
  );
}
