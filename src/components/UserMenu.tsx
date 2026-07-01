"use client";

import { Check } from "lucide-react";

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
import { appUsers } from "@/lib/users";
import { useActiveUser, useUserStore } from "@/lib/user-store";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const activeUser = useActiveUser();
  const setActiveUser = useUserStore((state) => state.setActiveUser);

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
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
          {appUsers.map((user) => (
            <DropdownMenuItem
              key={user.id}
              className="cursor-pointer gap-3"
              onClick={() => setActiveUser(user.id)}
            >
              <Avatar size="sm">
                <AvatarFallback className={cn("text-xs font-semibold", user.color)}>
                  {user.initials}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              {activeUser.id === user.id && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
