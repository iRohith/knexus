"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useActiveUser, useUserStore } from "@/lib/stores/user-store";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const activeUser = useActiveUser();

  if (activeUser == null) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Current user: ${activeUser.name}`}
            className="size-9 cursor-pointer rounded-full p-0"
            variant="ghost"
          >
            <Avatar>
              <AvatarFallback className={cn("text-xs font-semibold", activeUser.color)}>
                {activeUser.initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
          <div className="p-4 flex flex-col items-center border-b">
            <Avatar size="lg" className="mb-2">
              <AvatarFallback className={cn("text-lg font-semibold", activeUser.color)}>
                {activeUser.initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-sm font-medium">{activeUser.name}</div>
            <div className="text-xs text-muted-foreground">{activeUser.email}</div>
          </div>
          <DropdownMenuItem
            className="cursor-pointer gap-2 p-3 justify-center text-destructive focus:bg-destructive/10"
            onClick={async () => {
              await useUserStore.getState().logout();
              window.location.href = "/login";
            }}
          >
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
