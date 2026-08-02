// v1.5.0, Sprint 11 — Platform Integration. A small, reusable "Learn"
// button any page/panel can drop into its own header to open
// ModuleLearnDrawer for a given module — the one shared trigger every
// module uses, per the approved scope's "every module should have an
// integrated AI Coach panel... the user should be able to learn without
// leaving the page" instruction.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { ModuleLearnDrawer } from "./ModuleLearnDrawer";

export function ModuleLearnTrigger({
  moduleLabel,
  pathKey,
  topicKey,
  size = "sm",
}: {
  moduleLabel: string;
  pathKey: string;
  topicKey?: string;
  size?: "sm" | "xs";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={size === "xs" ? "h-6 px-2 text-[11px] gap-1" : "h-7 text-xs gap-1.5"}
        onClick={() => setOpen(true)}
        data-testid={`button-learn-${pathKey}${topicKey ? `-${topicKey}` : ""}`}
      >
        <GraduationCap className={size === "xs" ? "w-3 h-3 text-indigo-400" : "w-3.5 h-3.5 text-indigo-400"} /> Learn
      </Button>
      <ModuleLearnDrawer open={open} onOpenChange={setOpen} moduleLabel={moduleLabel} pathKey={pathKey} topicKey={topicKey} />
    </>
  );
}
