"use client";

import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { authInputClass, authSubmitClass } from "@/components/auth/auth-card";
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
                  Thanks — your request has been received. We&apos;ll be in touch.
                </h3>
              </div>
            ) : (
              <form action={formAction} noValidate className="space-y-4">
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
                      "w-full rounded-md border bg-canvas px-3 py-2",
                      state.fieldErrors?.message ? "border-critical" : "border-line",
                    )}
                  />
                  {state.fieldErrors?.message ? (
                    <span className="mt-1 block text-xs text-critical">
                      {state.fieldErrors.message}
                    </span>
                  ) : null}
                </label>
                {state.error ? (
                  <p className="text-sm text-critical" role="alert">
                    {state.error}
                  </p>
                ) : null}
                <button type="submit" disabled={pending} className={authSubmitClass}>
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
        className={cn(authInputClass, "mt-0")}
      />
      {error ? <span className="mt-1 block text-xs text-critical">{error}</span> : null}
    </label>
  );
}
