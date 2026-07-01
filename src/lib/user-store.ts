"use client";

import { create } from "zustand";

import { appUsers, defaultUser } from "@/lib/users";

type UserState = {
  activeUserId: string;
  setActiveUser: (id: string) => void;
};

export const useUserStore = create<UserState>((set) => ({
  activeUserId: defaultUser.id,
  setActiveUser: (id) => {
    if (!appUsers.some((user) => user.id === id)) return;
    set({ activeUserId: id });
  },
}));

export function useActiveUser() {
  const activeUserId = useUserStore((state) => state.activeUserId);
  return appUsers.find((user) => user.id === activeUserId) ?? defaultUser;
}
