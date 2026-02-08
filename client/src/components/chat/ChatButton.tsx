import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

export function ChatButton({ onClick, isOpen }: ChatButtonProps) {
  if (isOpen) return null;

  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-40",
        "animate-in fade-in slide-in-from-bottom-4 duration-200"
      )}
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
}
