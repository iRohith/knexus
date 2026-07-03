export type AppUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
  color: string;
};

export const appUsers: AppUser[] = [
  {
    id: "aisha-rahman",
    name: "Aisha Rahman",
    email: "aisha.rahman@redwoodinference.com",
    initials: "AR",
    color: "bg-emerald-600 text-white",
  },
  {
    id: "aditya-rao",
    name: "Aditya Rao",
    email: "aditya.rao@redwoodinference.com",
    initials: "AR",
    color: "bg-sky-600 text-white",
  },
  {
    id: "maya-chen",
    name: "Maya Chen",
    email: "maya.chen@redwoodinference.com",
    initials: "MC",
    color: "bg-violet-600 text-white",
  },
  {
    id: "alex-martinez",
    name: "Alex Martinez",
    email: "alex.martinez@redwoodinference.com",
    initials: "AM",
    color: "bg-amber-600 text-white",
  },
  {
    id: "marissa-cole",
    name: "Marissa Cole",
    email: "marissa.cole@redwoodinference.com",
    initials: "MC",
    color: "bg-rose-600 text-white",
  },
  {
    id: "kevin-osei",
    name: "Kevin Osei",
    email: "kevin.osei@redwoodinference.com",
    initials: "KO",
    color: "bg-cyan-700 text-white",
  },
  {
    id: "naomi-feldman",
    name: "Naomi Feldman",
    email: "naomi.feldman@redwoodinference.com",
    initials: "NF",
    color: "bg-indigo-600 text-white",
  },
  {
    id: "irene-choi",
    name: "Irene Choi",
    email: "irene.choi@redwoodinference.com",
    initials: "IC",
    color: "bg-lime-700 text-white",
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
