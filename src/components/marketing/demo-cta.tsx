"use client";

import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { authInputClass } from "@/components/auth/auth-card";
import { submitDemoRequestAction, type DemoRequestState } from "@/lib/marketing/demo-actions";
import { cn } from "@/lib/cn";
import { useActionState } from "react";

const INITIAL: DemoRequestState = {};

export function DemoCTA() {
  const [state, formAction, pending] = useActionState(submitDemoRequestAction, INITIAL);
  const values = state.values;

  return (
    <MarketingSection id="demo">
      <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr]">
        <Reveal>
          <Eyebrow>Book a demo</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.12]">
            See Noxheim on a real development workflow.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted">
            Tell us a little about your development portfolio and we&apos;ll show how Noxheim can
            bring grid context, connection workflow and portfolio monitoring together.
          </p>
        </Reveal>
        <Reveal delay={80}>
          <div
            id="demo-form"
            className="scroll-mt-28 rounded-md border border-line bg-surface p-6 sm:p-8"
          >
            {state.ok ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
                  Request received
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                  Thanks — your request has been received.
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
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
                  <span className="mb-1.5 block text-xs font-medium text-muted">
                    Message (optional)
                  </span>
                  <textarea
                    name="message"
                    rows={3}
                    defaultValue={values?.message}
                    className={cn(
                      "w-full rounded-md border bg-canvas px-3 py-2.5 text-sm outline-none focus:border-teal",
                      state.fieldErrors?.message ? "border-critical" : "border-line",
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
                  className="flex h-11 w-full items-center justify-center rounded-md bg-ink text-sm font-medium text-white transition-colors hover:bg-[#242a33] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal disabled:cursor-not-allowed disabled:opacity-50"
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
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={name !== "message"}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cn(authInputClass, "mt-0 h-11 focus-visible:outline-none")}
      />
      {error ? (
        <span id={`${name}-error`} className="mt-1.5 block text-xs text-critical">
          {error}
        </span>
      ) : null}
    </label>
  );
}
