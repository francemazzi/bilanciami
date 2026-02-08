import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Check, X } from "lucide-react";
import type { PendingQuery } from "@/api/chat";

interface ApprovalDialogProps {
  pendingQuery: PendingQuery;
  onApprove: (feedback?: string) => void;
  onReject: (feedback?: string) => void;
  isLoading?: boolean;
}

export function ApprovalDialog({
  pendingQuery,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalDialogProps) {
  const [feedback, setFeedback] = useState("");

  return (
    <Card className="border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <CardTitle className="text-base">Conferma operazione</CardTitle>
        </div>
        <CardDescription>
          L'operazione richiesta necessita della tua approvazione.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description */}
        <div>
          <p className="text-sm font-medium">Descrizione:</p>
          <p className="text-sm text-muted-foreground">
            {pendingQuery.description}
          </p>
        </div>

        {/* Sensitive reason */}
        {pendingQuery.sensitiveReason && (
          <div>
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
              Motivo richiesta approvazione:
            </p>
            <p className="text-sm text-muted-foreground">
              {pendingQuery.sensitiveReason}
            </p>
          </div>
        )}

        {/* SQL Preview */}
        <div>
          <p className="text-sm font-medium">Query SQL:</p>
          <pre className="mt-1 p-2 rounded bg-muted text-xs overflow-x-auto">
            {pendingQuery.sql}
          </pre>
        </div>

        {/* Optional feedback */}
        <div>
          <label className="text-sm font-medium">
            Feedback (opzionale):
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Aggiungi modifiche o note..."
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            rows={2}
            disabled={isLoading}
          />
        </div>
      </CardContent>

      <CardFooter className="gap-2">
        <Button
          variant="outline"
          onClick={() => onReject(feedback || undefined)}
          disabled={isLoading}
          className="flex-1"
        >
          <X className="h-4 w-4 mr-2" />
          Rifiuta
        </Button>
        <Button
          onClick={() => onApprove(feedback || undefined)}
          disabled={isLoading}
          className="flex-1"
        >
          <Check className="h-4 w-4 mr-2" />
          Approva
        </Button>
      </CardFooter>
    </Card>
  );
}
