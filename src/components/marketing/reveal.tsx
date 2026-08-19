"use client";

import { cn } from "@/lib/cn";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({
  children,
  className,
  delay = 0,
  fade = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  fade?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "marketing-reveal transition-[opacity,transform] duration-700 ease-out",
        visible ? "translate-y-0 opacity-100" : fade ? "opacity-0" : "translate-y-4 opacity-0",
        className,
      )}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
