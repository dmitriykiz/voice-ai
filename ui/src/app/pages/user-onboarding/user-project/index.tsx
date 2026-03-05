import React, { useCallback, useContext, useState } from 'react';
import { Helmet } from '@/app/components/helmet';
import { Textarea } from '@/app/components/form/textarea';
import { Input } from '@/app/components/form/input';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { CreateProject } from '@rapidaai/react';
import { CreateProjectResponse } from '@rapidaai/react';
import { useCurrentCredential } from '@/hooks/use-credential';
import { useRapidaStore } from '@/hooks';
import { IBlueBGArrowButton } from '@/app/components/form/button';
import { ServiceError } from '@rapidaai/react';
import { AuthContext } from '@/context/auth-context';
import { FieldSet } from '@/app/components/form/fieldset';
import { FormLabel } from '@/app/components/form-label';
import { connectionConfig } from '@/configs';
import { AlertCircle } from 'lucide-react';

export function CreateProjectPage() {
  const navigate = useNavigate();
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const { authorize } = useContext(AuthContext);
  const { authId, token, user } = useCurrentCredential();
  const { register, handleSubmit } = useForm();
  const [error, setError] = useState('');

  const afterCreateProject = useCallback(
    async (err: ServiceError | null, cpr: CreateProjectResponse | null) => {
      hideLoader();
      if (err) {
        setError('Unable to process your request. Please try again later.');
        return;
      }
      if (cpr?.getSuccess()) {
        authorize &&
          authorize(
            () => {
              navigate('/dashboard');
            },
            () => {
              setError('Unable to create project. Please check the details.');
            },
          );
      } else {
        setError('Unable to create project. Please check the details.');
      }
    },
    [],
  );

  const onCreateProject = data => {
    showLoader('overlay');
    CreateProject(
      connectionConfig,
      data.projectName,
      data.projectDescription,
      {
        authorization: token,
        'x-auth-id': authId,
      },
      afterCreateProject,
    );
  };

  return (
    <>
      <Helmet title="Onboarding: Create a Project" />

      {/* Heading */}
      <div className="mb-8">
        {user?.name && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            Almost there,{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {user.name}
            </span>
          </p>
        )}
        <h1 className="text-[28px] leading-9 font-light text-gray-900 dark:text-gray-100">
          Create your first project
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-5">
          Projects group your AI assistants, deployments, and knowledge bases.
          You can create more projects later.
        </p>
      </div>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit(onCreateProject)}>

        <div className="flex flex-col gap-1">
          <FieldSet>
            <FormLabel>Project Name</FormLabel>
            <Input
              required
              type="text"
              defaultValue={`${user?.name}'s Workspace`}
              placeholder="eg: Customer Support Bot"
              {...register('projectName')}
            />
          </FieldSet>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Choose a name that reflects the purpose or team for this project.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <FieldSet>
            <FormLabel>Project Description</FormLabel>
            <Textarea
              {...register('projectDescription')}
              row={3}
              placeholder="eg: Voice assistant for handling customer inquiries 24/7"
            />
          </FieldSet>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Optional — helps your team understand the project's goals at a glance.
          </p>
        </div>

        {error && (
          <div className="flex rounded-none">
            <div className="w-[3px] flex-shrink-0 bg-red-600" />
            <div className="flex items-center gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-950/30 flex-1">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        <IBlueBGArrowButton
          type="submit"
          className="w-full justify-between h-12 mt-2"
          isLoading={loading}
        >
          Go to dashboard
        </IBlueBGArrowButton>
      </form>
    </>
  );
}
