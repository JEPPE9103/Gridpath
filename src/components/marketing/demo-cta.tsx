"use client";

import { CtaLink } from "@/components/marketing/cta-link";
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
          <Eyebrow>Get in touch</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.12]">
            See official grid context on your portfolio.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted">
            Bring official Swedish grid context, connection cases and published plan changes into
            one workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <CtaLink href="#demo-form" className="w-full px-5 sm:w-auto">
              Book a demo
            </CtaLink>
            <CtaLink href="/signup" variant="secondary" className="w-full px-5 sm:w-auto">
              Get started
            </CtaLink>
          </div>
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
                  Thanks — we&apos;ll be in touch.
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  Your demo request was saved. The NOXHEIM team will follow up at the email you
                  provided.
                </p>
                <CtaLink href="/signup" className="mt-6">
                  Get started
                </CtaLink>
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
                  {pending ? "Sending…" : "Request demo"}
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
