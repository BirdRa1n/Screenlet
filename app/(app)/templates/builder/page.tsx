"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TemplateBuilder } from "@/views/TemplateBuilder";

function BuilderWithParams() {
  const id = useSearchParams().get("id") ?? undefined;
  // Remount when the target template changes so internal state re-initializes.
  return <TemplateBuilder key={id ?? "new"} templateId={id} />;
}

export default function TemplateBuilderPage() {
  return (
    <Suspense>
      <BuilderWithParams />
    </Suspense>
  );
}
