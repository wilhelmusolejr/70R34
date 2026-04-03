export const imageAssets = [
  {
    id: "cafe-starter-pack",
    name: "Cafe Starter Pack",
    images: [
      "/mock-images/cafe-starter-pack/avatar.svg",
      "/mock-images/cafe-starter-pack/cover.svg",
      "/mock-images/cafe-starter-pack/post-1.svg",
      "/mock-images/cafe-starter-pack/post-2.svg",
    ],
    possibleProfiles: 2,
    usedBy: 1,
    profileUrl: "https://facebook.com/cafestarter.demo",
    imageUsers: {
      "/mock-images/cafe-starter-pack/avatar.svg": ["Celia Hart"],
      "/mock-images/cafe-starter-pack/cover.svg": ["Celia Hart"],
      "/mock-images/cafe-starter-pack/post-1.svg": ["Celia Hart", "Marco Vale"],
      "/mock-images/cafe-starter-pack/post-2.svg": ["Marco Vale"],
    },
  },
  {
    id: "wellness-brand-kit",
    name: "Wellness Brand Kit",
    images: [
      "/mock-images/wellness-brand-kit/avatar.svg",
      "/mock-images/wellness-brand-kit/cover.svg",
      "/mock-images/wellness-brand-kit/story-1.svg",
      "/mock-images/wellness-brand-kit/story-2.svg",
      "/mock-images/wellness-brand-kit/story-3.svg",
    ],
    possibleProfiles: 3,
    usedBy: 2,
    profileUrl: "https://facebook.com/wellnesskit.demo",
    imageUsers: {
      "/mock-images/wellness-brand-kit/avatar.svg": ["Ava Bloom", "Rhea Stone"],
      "/mock-images/wellness-brand-kit/cover.svg": ["Ava Bloom"],
      "/mock-images/wellness-brand-kit/story-1.svg": ["Ava Bloom", "Rhea Stone"],
      "/mock-images/wellness-brand-kit/story-2.svg": ["Rhea Stone"],
      "/mock-images/wellness-brand-kit/story-3.svg": ["Ava Bloom"],
    },
  },
];

export function getImageAssetById(assetId) {
  return imageAssets.find((asset) => asset.id === assetId) || null;
}
