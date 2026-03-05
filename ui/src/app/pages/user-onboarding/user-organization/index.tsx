import React, { useCallback, useContext, useState } from 'react';
import { Helmet } from '@/app/components/helmet';
import { IBlueBGArrowButton } from '@/app/components/form/button';
import { Input } from '@/app/components/form/input';
import { Select } from '@/app/components/form/select';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CreateOrganization } from '@rapidaai/react';
import { CreateOrganizationResponse } from '@rapidaai/react';
import { useCurrentCredential } from '@/hooks/use-credential';
import { useRapidaStore } from '@/hooks';
import { ServiceError } from '@rapidaai/react';
import { AuthContext } from '@/context/auth-context';
import { FieldSet } from '@/app/components/form/fieldset';
import { FormLabel } from '@/app/components/form-label';
import { connectionConfig } from '@/configs';
import { AlertCircle } from 'lucide-react';

export function CreateOrganizationPage() {
  const navigate = useNavigate();
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const { authorize } = useContext(AuthContext);
  const { user, authId, token } = useCurrentCredential();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();
  const [error, setError] = useState('');

  const OrgOptions = [
    { name: 'Startup (1–50)',      value: 'startup' },
    { name: 'Growing (51–500)',    value: 'late-stage' },
    { name: 'Enterprise (500+)',   value: 'enterprise' },
  ];

  const afterCreateOrganization = useCallback(
    (err: ServiceError | null, org: CreateOrganizationResponse | null) => {
      if (err) {
        hideLoader();
        setError('Unable to process your request. Please try again later.');
        return;
      }
      if (org?.getSuccess()) {
        authorize &&
          authorize(
            () => {
              hideLoader();
              return navigate('/onboarding/project');
            },
            () => {
              hideLoader();
              setError('Please provide valid credentials to sign in.');
            },
          );
      } else {
        hideLoader();
        setError('Please provide valid credentials to sign in.');
      }
    },
    [],
  );

  const onCreateOrganization = data => {
    showLoader('overlay');
    CreateOrganization(
      connectionConfig,
      data.organizationName,
      data.organizationSize,
      data.organizationIndustry,
      {
        authorization: token,
        'x-auth-id': authId,
      },
      afterCreateOrganization,
    );
  };

  const formError =
    (errors.organizationName?.message as string) ||
    (errors.organizationSize?.message as string) ||
    (errors.organizationIndustry?.message as string) ||
    error;

  return (
    <>
      <Helmet title="Onboarding: Create an organization" />

      {/* Heading */}
      <div className="mb-8">
        {user?.name && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Welcome,{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {user.name}
            </span>
          </p>
        )}
        <h1 className="text-[28px] leading-9 font-light text-gray-900 dark:text-gray-100">
          Create your organization
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-5">
          Your organization is the top-level workspace where your team will
          build and manage AI assistants.
        </p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onCreateOrganization)}>

        <div className="flex flex-col gap-1">
          <FieldSet>
            <FormLabel>Organization Name</FormLabel>
            <Input
              type="text"
              required
              defaultValue={`${user?.name}'s Organization`}
              placeholder="eg: Lexatic Inc"
              {...register('organizationName', {
                required: 'Please enter the organization name.',
              })}
            />
          </FieldSet>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            This will be the public display name of your organization.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <FieldSet>
            <FormLabel>Company Size</FormLabel>
            <Select
              required
              placeholder="Select your organization size"
              {...register('organizationSize')}
              options={OrgOptions}
            />
          </FieldSet>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Helps us tailor your onboarding experience.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <FieldSet>
            <FormLabel>Industry</FormLabel>
            <Input
              required
              type="text"
              {...register('organizationIndustry', {
                required: 'Please provide an industry for your organization.',
              })}
              placeholder="eg: Software, Healthcare, Finance"
            />
          </FieldSet>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            We'll suggest relevant integrations and assistant templates for your sector.
          </p>
        </div>

        {formError && (
          <div className="flex rounded-none">
            <div className="w-[3px] flex-shrink-0 bg-red-600" />
            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 flex-1">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          </div>
        )}

        <IBlueBGArrowButton
          type="submit"
          className="w-full justify-between h-12 mt-2"
          isLoading={loading}
        >
          Continue
        </IBlueBGArrowButton>
      </form>
    </>
  );
}
