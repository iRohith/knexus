import { AppNavMenu } from "@/components/AppNavMenu";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { UserMenu } from "@/components/UserMenu";

export function AppNavbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex h-14 w-full items-center justify-between px-4 lg:px-16">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold tracking-normal sm:text-base">
            Knexus
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AppNavMenu />
          <DarkModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
