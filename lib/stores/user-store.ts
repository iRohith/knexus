"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { appUsers, AppUser } from "@/lib/users";

type UserState = {
  activeUserId: string | null;
  setActiveUser: (id: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      activeUserId: null,
      setActiveUser: async (id, password) => {
        const user = appUsers.find((u) => u.id === id);
        if (!user) return;

        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, password }),
          });

          if (!response.ok) {
            const error = (await response.json().catch(() => null)) as { message?: string } | null;
            throw new Error(error?.message || "Invalid password or failed to login.");
          }

          set({ activeUserId: id });
        } catch (err) {
          console.error("Failed to login to backend:", err);
          throw err; // throw error so the login page can show it
        }
      },
      logout: async () => {
        if (typeof window !== "undefined") {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
        }
        set({ activeUserId: null });
      },
    }),
    {
      name: "auth-storage",
    },
  ),
);

export function useActiveUser(): AppUser | null {
  const activeUserId = useUserStore((state) => state.activeUserId);
  return appUsers.find((user) => user.id === activeUserId) ?? null;
}
