// v1.6.0, Sprint 3 — UX Transformation. The one reusable Guided Tour
// dialog — built entirely from existing shadcn/ui Dialog + Progress +
// Button primitives (see guided-tours.ts's own header comment for why no
// new tour library was introduced). Renders whichever GUIDED_TOURS entry
// is requested; content lives in guided-tours.ts, never duplicated here.
import { useState } from "react";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GUIDED_TOURS, markTourCompleted, type GuidedTourId } from "@/lib/guided-tours";

export interface GuidedTourDialogProps {
  tourId: GuidedTourId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GuidedTourDialog({ tourId, open, onOpenChange }: GuidedTourDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const tour = GUIDED_TOURS[tourId];
  const step = tour.steps[stepIndex];
  const isLastStep = stepIndex === tour.steps.length - 1;

  function handleClose(open: boolean) {
    if (!open) setStepIndex(0);
    onOpenChange(open);
  }

  function handleFinish() {
    markTourCompleted(tourId);
    handleClose(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid={`dialog-guided-tour-${tourId}`}>
        <DialogHeader>
          <DialogTitle>{tour.label}</DialogTitle>
          <DialogDescription>{tour.description}</DialogDescription>
        </DialogHeader>

        <Progress value={((stepIndex + 1) / tour.steps.length) * 100} data-testid="guided-tour-progress" />

        <div className="space-y-2 py-2">
          <h3 className="text-sm font-semibold" data-testid="guided-tour-step-title">
            {step.title}
          </h3>
          <p className="text-sm text-muted-foreground" data-testid="guided-tour-step-body">
            {step.body}
          </p>
          {step.href && (
            <Link
              href={step.href}
              className="inline-flex text-sm text-indigo-400 hover:underline"
              data-testid="guided-tour-step-link"
              onClick={() => handleClose(false)}
            >
              {step.hrefLabel ?? "Go there now"} →
            </Link>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            data-testid="button-guided-tour-back"
          >
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => handleClose(false)} data-testid="button-guided-tour-skip">
              Skip
            </Button>
            {isLastStep ? (
              <Button type="button" size="sm" onClick={handleFinish} data-testid="button-guided-tour-finish">
                Done
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => setStepIndex((i) => i + 1)} data-testid="button-guided-tour-next">
                Next
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
