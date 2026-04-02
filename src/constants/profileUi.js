export const AVC = [
  "#1c1c1e",
  "#3a3a3c",
  "#5e5ce6",
  "#0071e3",
  "#30b0c7",
  "#34c759",
  "#ff9f0a",
  "#ff6b35",
  "#bf5af2",
  "#ff375f",
];

export const STATUS_CLASS = {
  Available: "sp",
  "Need Setup": "sp",
  "Pending Profile": "sp",
  Active: "sa",
  Flagged: "sflag",
  Banned: "sbn",
  Ready: "sa",
  Delivered: "sa",
};

export const STATUS_OPTIONS = [
  "Available",
  "Need Setup",
  "Pending Profile",
  "Active",
  "Flagged",
  "Banned",
  "Ready",
  "Delivered",
];

export const SC = {
  Available: { bg: "bg-cyan-bg", text: "text-cyan-t", dot: "bg-cyan" },
  "Need Setup": {
    bg: "bg-amber-bg",
    text: "text-amber-t",
    dot: "bg-amber",
  },
  "Pending Profile": {
    bg: "bg-amber-bg",
    text: "text-amber-t",
    dot: "bg-amber",
  },
  Active: { bg: "bg-green-bg", text: "text-green-t", dot: "bg-green" },
  Flagged: { bg: "bg-orange-bg", text: "text-orange-t", dot: "bg-orange" },
  Banned: { bg: "bg-red-bg", text: "text-red-t", dot: "bg-red" },
  Ready: { bg: "bg-blue-bg", text: "text-blue-t", dot: "bg-blue" },
  Delivered: { bg: "bg-purple-bg", text: "text-purple-t", dot: "bg-purple" },
};

export const TC = {
  Verified: "bg-accent-l text-[#0058b3]",
  Banned: "bg-red-bg text-red-t",
  Flagged: "bg-orange-bg text-orange-t",
  "Bot Suspect": "bg-purple-bg text-purple-t",
  "New User": "bg-cyan-bg text-cyan-t",
  "Pending Profile": "bg-amber-bg text-amber-t",
};
