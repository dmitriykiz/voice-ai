import { ProtectedBox } from '@/app/components/container/protected-box';
import { RapidaIcon } from '@/app/components/Icon/Rapida';
import { RapidaTextIcon } from '@/app/components/Icon/RapidaText';
import { cn } from '@/utils';
import { BarChart2, Check, Globe, Mic2 } from 'lucide-react';
import React from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import {
  OnboardingCreateOrganizationPage,
  OnboardingCreateProjectPage,
} from '@/app/pages/user-onboarding';
import { useWorkspace } from '@/workspace';

// ── Step definitions ──────────────────────────────────────────────────────────

const STEPS = [
  { path: 'organization', label: 'Create organization', step: 1 },
  { path: 'project', label: 'Create project', step: 2 },
];

// ── Feature highlights ────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Mic2,      text: 'Build voice & text AI assistants' },
  { icon: Globe,     text: 'Deploy to any channel in minutes' },
  { icon: BarChart2, text: 'Monitor quality with real-time analytics' },
];

// ── Layout ────────────────────────────────────────────────────────────────────

function OnboardingLayout() {
  const location = useLocation();
  const workspace = useWorkspace();

  const currentStep =
    STEPS.find(s => location.pathname.includes(s.path))?.step ?? 1;

  const progressPct = Math.round((currentStep / STEPS.length) * 100);

  return (
    <div className="min-h-[100dvh] flex bg-white dark:bg-gray-900">

      {/* ── Left brand panel ───────────────────────────────────────── */}
      <aside className="hidden lg:flex w-[400px] xl:w-[460px] flex-shrink-0 bg-primary flex-col relative overflow-hidden">

        {/* Dot-grid decoration */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Logo */}
        <div className="relative px-10 pt-10">
          {workspace.logo ? (
            <>
              <img src={workspace.logo.light} alt={workspace.title} className="h-8 block dark:hidden" />
              <img src={workspace.logo.dark} alt={workspace.title} className="h-8 hidden dark:block" />
            </>
          ) : (
            <div className="flex items-center gap-2 text-white">
              <RapidaIcon className="h-8 w-8" />
              <RapidaTextIcon className="h-6" />
            </div>
          )}
        </div>

        {/* Tagline + feature highlights */}
        <div className="relative flex-1 flex flex-col justify-center px-10 pb-8">
          <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-blue-300 mb-4">
            Getting started
          </p>
          <h2 className="text-[26px] leading-[34px] font-light text-white mb-3">
            Build AI assistants that understand and respond like humans.
          </h2>
          <p className="text-sm text-blue-200 leading-relaxed mb-8">
            rapida.ai helps you create, deploy, and monitor voice AI experiences
            — powered by the world's best LLMs and speech engines.
          </p>

          {/* Feature list */}
          <div className="flex flex-col gap-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-7 h-7 flex items-center justify-center bg-white/10 shrink-0">
                  <Icon className="w-3.5 h-3.5 text-blue-200" />
                </div>
                <span className="text-sm text-blue-100 leading-5">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step progress */}
        <div className="relative px-10 pb-10 border-t border-white/10 pt-6">
          <p className="text-[10px] font-semibold tracking-[0.12em] uppercase text-blue-300 mb-5">
            Setup progress
          </p>

          <div className="flex flex-col">
            {STEPS.map((step, idx) => {
              const done = currentStep > step.step;
              const active = currentStep === step.step;
              return (
                <div key={step.path} className="flex gap-3">
                  {/* Circle + connecting line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-6 h-6 flex-shrink-0 flex items-center justify-center text-[11px] font-semibold',
                        done
                          ? 'bg-white text-primary'
                          : active
                          ? 'bg-white text-primary ring-4 ring-white/20'
                          : 'border border-white/30 text-white/40',
                      )}
                    >
                      {done ? <Check className="w-3 h-3" strokeWidth={2.5} /> : step.step}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div
                        className={cn('w-px my-1', done ? 'bg-white/50' : 'bg-white/15')}
                        style={{ minHeight: '20px' }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <div className={cn('pb-3', idx === STEPS.length - 1 && 'pb-0')}>
                    <span
                      className={cn(
                        'text-sm leading-6',
                        done || active ? 'text-white' : 'text-white/40',
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── Right form panel ───────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">

        {/* Top progress bar */}
        <div className="h-1 w-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-primary">
            <RapidaIcon className="h-7 w-7" />
            <RapidaTextIcon className="h-5" />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Step {currentStep} of {STEPS.length}
          </span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-10">
          <div className="w-full max-w-md">
            {/* Step badge — desktop only */}
            <div className="hidden lg:flex items-center gap-3 mb-8">
              <span className="inline-flex items-center h-5 px-2 text-[11px] font-medium bg-primary/10 text-primary">
                Step {currentStep} of {STEPS.length}
              </span>
              <span className="text-[11px] text-gray-400 dark:text-gray-600">
                {STEPS[currentStep - 1]?.label}
              </span>
            </div>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Route ─────────────────────────────────────────────────────────────────────

export function OnbaordingRoute() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedBox>
            <OnboardingLayout />
          </ProtectedBox>
        }
      >
        <Route
          key="organization"
          path="organization"
          element={<OnboardingCreateOrganizationPage />}
        />
        <Route
          key="project"
          path="project"
          element={<OnboardingCreateProjectPage />}
        />
      </Route>
    </Routes>
  );
}
