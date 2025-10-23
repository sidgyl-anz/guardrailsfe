"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DebugView } from "./debug-view";

interface GuardrailResultDialogProps {
    result: any;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function GuardrailResultDialog({ result, isOpen, onOpenChange }: GuardrailResultDialogProps) {

    if (!result) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                 <DialogHeader>
                    <DialogTitle>Guardrail Details</DialogTitle>
                    <DialogDescription>
                        The following is the raw JSON response from the guardrail service for this message.
                    </DialogDescription>
                </DialogHeader>
                 <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto max-h-[60vh]">
                    <code>{JSON.stringify(result, null, 2)}</code>
                </pre>
            </DialogContent>
        </Dialog>
    );
}
