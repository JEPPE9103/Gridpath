"use client";

import { CtaLink } from "@/components/marketing/cta-link";
import { Reveal } from "@/components/marketing/reveal";
import { Eyebrow, MarketingSection } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  DEMO_ROLES,
  submitDemoRequest,
  validateDemoRequest,
  type DemoRequest,
} from "@/lib/marketing/demo-request";
import { useState, type FormEvent } from "react";

const EMPTY: DemoRequest = { name: "", company: "", email: "", role: "" };

export function DemoCTA() {
  const [values, setValues] = useState<DemoRequest>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof DemoRequest, string>>>({});
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateDemoRequest(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setPending(true);
    try {
      await submitDemoRequest(values);
      setSuccess(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <MarketingSection id="demo">
      <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr]">
        <Reveal>
          <Eyebrow>Get in touch</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[42px] sm:leading-[1.12]">
            See your grid development portfolio differently.
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-muted">
            Bring sites, connection processes and grid changes into one workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <CtaLink href="#demo-form" className="w-full px-5 sm:w-auto">
              Book a demo
            </CtaLink>
            <CtaLink href="/overview" variant="secondary" className="w-full px-5 sm:w-auto">
              Open product demo
            </CtaLink>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <div
            id="demo-form"
            className="scroll-mt-28 rounded-md border border-line bg-surface p-6 sm:p-8"
          >
            {success ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
                  Request received
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight">
                  Thanks — demo request received.
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">
                  This environment does not send the form to a CRM yet. Your details stayed in this
                  browser session. Open the product demo while you wait.
                </p>
                <CtaLink href="/overview" className="mt-6">
                  Open product demo
                </CtaLink>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-4">
                <Field
                  label="Name"
                  error={errors.name}
                  value={values.name}
                  onChange={(value) => setValues((current) => ({ ...current, name: value }))}
                />
                <Field
                  label="Company"
                  error={errors.company}
                  value={values.company}
                  onChange={(value) => setValues((current) => ({ ...current, company: value }))}
                />
                <Field
                  label="Work email"
                  type="email"
                  error={errors.email}
                  value={values.email}
                  onChange={(value) => setValues((current) => ({ ...current, email: value }))}
                />
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-medium text-muted">Role</span>
                  <select
                    value={values.role}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, role: event.target.value }))
                    }
                    className={cn(
                      "h-10 w-full rounded-md border bg-canvas px-3",
                      errors.role ? "border-critical" : "border-line",
                    )}
                  >
                    <option value="">Select role</option>
                    {DEMO_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  {errors.role ? (
                    <span className="mt-1 block text-xs text-critical">{errors.role}</span>
                  ) : null}
                </label>
                <Button type="submit" disabled={pending} className="h-10 w-full">
                  {pending ? "Sending…" : "Request demo"}
                </Button>
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
  value,
  onChange,
  error,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-10 w-full rounded-md border bg-canvas px-3",
          error ? "border-critical" : "border-line",
        )}
      />
      {error ? <span className="mt-1 block text-xs text-critical">{error}</span> : null}
    </label>
  );
}
