export type AppUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
  role: "ADMIN" | "EMPLOYEE";
};

export const appUsers: AppUser[] = [
  {
    id: "ava-chen",
    name: "Ava Chen",
    email: "ava.chen@redwoodinference.com",
    initials: "AC",
    color: "bg-amber-600 text-white",
    role: "ADMIN",
  },
  {
    id: "ethan-park",
    name: "Ethan Park",
    email: "ethan.park@redwoodinference.com",
    initials: "EP",
    color: "bg-violet-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "priya-natarajan",
    name: "Priya Natarajan",
    email: "priya.natarajan@redwoodinference.com",
    initials: "PN",
    color: "bg-orange-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "rafael-mendes",
    name: "Rafael Mendes",
    email: "rafael.mendes@redwoodinference.com",
    initials: "RM",
    color: "bg-blue-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "jordan-blake",
    name: "Jordan Blake",
    email: "jordan.blake@redwoodinference.com",
    initials: "JB",
    color: "bg-pink-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "marcus-lin",
    name: "Marcus Lin",
    email: "marcus.lin@redwoodinference.com",
    initials: "ML",
    color: "bg-fuchsia-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "sean-gallagher",
    name: "Sean Gallagher",
    email: "sean.gallagher@redwoodinference.com",
    initials: "SG",
    color: "bg-rose-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "logan-wright",
    name: "Logan Wright",
    email: "logan.wright@redwoodinference.com",
    initials: "LW",
    color: "bg-indigo-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "mateo-alvarez",
    name: "Mateo Alvarez",
    email: "mateo.alvarez@redwoodinference.com",
    initials: "MA",
    color: "bg-teal-600 text-white",
    role: "EMPLOYEE",
  },
  {
    id: "ben-carter",
    name: "Ben Carter",
    email: "ben.carter@redwoodinference.com",
    initials: "BC",
    color: "bg-violet-600 text-white",
    role: "EMPLOYEE",
  },
];

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
