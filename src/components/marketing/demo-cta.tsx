"use client";

import { Reveal } from "@/components/marketing/reveal";
import { MarketingSection } from "@/components/marketing/section";
import { cn } from "@/lib/cn";
import { submitDemoRequestAction, type DemoRequestState } from "@/lib/marketing/demo-actions";
import { useActionState } from "react";

const INITIAL: DemoRequestState = {};

/**
 * Final conversion — dark geospatial CTA with integrated demo form.
 */
export function DemoCTA() {
  const [state, formAction, pending] = useActionState(submitDemoRequestAction, INITIAL);
  const values = state.values;

  return (
    <MarketingSection id="demo" dark wide className="border-t border-white/5">
      <div className="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-start lg:gap-14">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ad1c8]">
            Book a demo
          </p>
          <h2 className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-white sm:text-[40px] sm:leading-[1.12]">
            Make the next investigation the right one.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/70">
            See Noxheim on the geographies you develop.
          </p>
        </Reveal>

        <Reveal delay={60}>
          <div
            id="demo-form"
            className="scroll-mt-28 rounded-lg border border-white/12 bg-white/[0.06] p-6 backdrop-blur-[6px] sm:p-8"
          >
            {state.ok ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9ad1c8]">
                  Request received
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                  Thanks — your request has been received.
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  We&apos;ll be in touch at the work email you provided.
                </p>
              </div>
            ) : (
              <form action={formAction} noValidate className="space-y-5">
                <Field
                  label="Name"
                  name="name"
                  error={state.fieldErrors?.name}
                  defaultValue={values?.name}
                />
                <Field
                  label="Company"
                  name="company"
                  error={state.fieldErrors?.company}
                  defaultValue={values?.company}
                />
                <Field
                  label="Work email"
                  name="email"
                  type="email"
                  error={state.fieldErrors?.email}
                  defaultValue={values?.email}
                />
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-white/55">
                    Message (optional)
                  </span>
                  <textarea
                    name="message"
                    rows={3}
                    defaultValue={values?.message}
                    className={cn(
                      "w-full rounded-md border bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#9ad1c8]",
                      state.fieldErrors?.message ? "border-critical" : "border-white/15",
                    )}
                    aria-invalid={state.fieldErrors?.message ? true : undefined}
                    aria-describedby={state.fieldErrors?.message ? "message-error" : undefined}
                  />
                  {state.fieldErrors?.message ? (
                    <span id="message-error" className="mt-1.5 block text-xs text-critical">
                      {state.fieldErrors.message}
                    </span>
                  ) : null}
                </label>
                {state.error ? (
                  <p className="text-sm text-critical" role="alert">
                    {state.error}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  aria-busy={pending}
                  className="flex h-11 w-full items-center justify-center rounded-md bg-teal text-sm font-medium text-white transition-colors hover:bg-teal-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9ad1c8] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Request a demo"}
                </button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </MarketingSection>
  );
}

function Field({
  label,
  name,
  error,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  error?: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-medium text-white/55">{label}</span>
      <input
        name={name}
        type={type}
        required={name !== "message"}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(
          "mt-0 h-11 w-full rounded-md border px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#9ad1c8] focus-visible:outline-none",
          "border-white/15 bg-white/[0.04]",
        )}
      />
      {error ? (
        <span id={`${name}-error`} className="mt-1.5 block text-xs text-critical">
          {error}
        </span>
      ) : null}
    </label>
  );
}
