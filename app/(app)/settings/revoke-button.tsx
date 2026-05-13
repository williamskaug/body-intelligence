"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { revokeClientAction } from "./actions";

export function RevokeClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="destructive">
            Revoke
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke access for {clientName}?</DialogTitle>
          <DialogDescription>
            All active access and refresh tokens for this client will be
            invalidated. It can re-authorize at any time by reconnecting.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" size="sm" />}>
            Cancel
          </DialogClose>
          <form
            action={async (fd: FormData) => {
              setPending(true);
              try {
                await revokeClientAction(fd);
              } finally {
                setPending(false);
                setOpen(false);
              }
            }}
          >
            <input type="hidden" name="client_id" value={clientId} />
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={pending}
            >
              {pending ? "Revoking…" : "Revoke access"}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
