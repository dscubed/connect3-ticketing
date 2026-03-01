"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FaInstagram } from "react-icons/fa";
import { PenLine } from "lucide-react";
import { useRouter } from "next/navigation";

interface CreateEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateEventModal({
  open,
  onOpenChange,
}: CreateEventModalProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Event</DialogTitle>
          <DialogDescription>
            How would you like to create your event?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 pt-2">
          {/* Create from scratch */}
          <Button
            variant="outline"
            className="h-auto justify-start gap-4 px-4 py-4"
            onClick={() => {
              onOpenChange(false);
              router.push("/events/create");
            }}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PenLine className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-medium">Create from scratch</p>
              <p className="text-xs text-muted-foreground">
                Build your event page from the ground up
              </p>
            </div>
          </Button>

          {/* Import from Instagram (disabled) */}
          <Button
            variant="outline"
            className="h-auto justify-start gap-4 px-4 py-4 opacity-50"
            disabled
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-purple-500 to-pink-500 text-white">
              <FaInstagram className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-medium">Import from Instagram</p>
              <p className="text-xs text-muted-foreground">
                Create from an existing post — coming soon
              </p>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
