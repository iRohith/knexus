export type AppUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
};

export const appUsers: AppUser[] = [
  {
    id: "riley",
    name: "Riley Hart",
    email: "riley@corp-os.example",
    initials: "RH",
    color: "bg-sky-600 text-white",
  },
  {
    id: "maya",
    name: "Maya Chen",
    email: "maya@corp-os.example",
    initials: "MC",
    color: "bg-emerald-600 text-white",
  },
  {
    id: "ari",
    name: "Ari Patel",
    email: "ari@corp-os.example",
    initials: "AP",
    color: "bg-amber-600 text-white",
  },
];

export const defaultUser = appUsers[0];

export function userToRecipient(user: AppUser) {
  return {
    name: user.name,
    email: user.email,
  };
}

export function getAppUserInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
