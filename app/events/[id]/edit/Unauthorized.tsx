"use client";

import Link from "next/link";
import { ShieldAlert, LogIn, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface UnauthorizedProps {
  reason: "not_authenticated" | "forbidden";
  eventId?: string;
}

export default function Unauthorized({ reason, eventId }: UnauthorizedProps) {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
      <Card className="flex max-w-md flex-col items-center gap-6 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>

        {reason === "not_authenticated" ? (
          <>
            <div>
              <h1 className="text-xl font-semibold">Sign in required</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You need to sign in to edit this event. Please log in with an
                account that has access.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Home
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/auth/callback?redirect=/events/${eventId}/edit`}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign in
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-semibold">Access denied</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                You don&apos;t have permission to edit this event. Only the
                event creator and accepted collaborators can make changes.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Home
                </Link>
              </Button>
              {eventId && (
                <Button variant="secondary" asChild>
                  <Link href={`/events/${eventId}`}>View event</Link>
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
