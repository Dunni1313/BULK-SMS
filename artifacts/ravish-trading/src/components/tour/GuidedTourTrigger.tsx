// v1.6.0, Sprint 3 — UX Transformation. A small, reusable button that
// opens GuidedTourDialog for a given tour — the one shared trigger every
// page uses, mirroring ModuleLearnTrigger's own established shape
// (components/learn/ModuleLearnTrigger.tsx).
import { useState } from "react";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuidedTourDialog } from "./GuidedTourDialog";
import { GUIDED_TOURS, hasCompletedTour, type GuidedTourId } from "@/lib/guided-tours";

export function GuidedTourTrigger({ tourId, size = "sm" }: { tourId: GuidedTourId; size?: "sm" | "xs" }) {
  const [open, setOpen] = useState(false);
  const completed = hasCompletedTour(tourId);
  const tour = GUIDED_TOURS[tourId];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={size === "xs" ? "h-6 px-2 text-[11px] gap-1" : "h-7 text-xs gap-1.5"}
        onClick={() => setOpen(true)}
        data-testid={`button-guided-tour-${tourId}`}
      >
        <Compass className={size === "xs" ? "w-3 h-3 text-indigo-400" : "w-3.5 h-3.5 text-indigo-400"} />
        {completed ? `Retake: ${tour.label}` : `Take the tour: ${tour.label}`}
      </Button>
      <GuidedTourDialog tourId={tourId} open={open} onOpenChange={setOpen} />
    </>
  );
}
