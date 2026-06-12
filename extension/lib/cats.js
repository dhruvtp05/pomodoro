const CAT_BREEDS = [
  { id: "default", name: "Tabby", cost: 0, color: "#E8A04A" },
  { id: "siamese", name: "Siamese", cost: 50, color: "#F0E0C8" },
  { id: "persian", name: "Persian", cost: 100, color: "#D8C8E8" },
  { id: "bengal", name: "Bengal", cost: 150, color: "#D4943C" },
  { id: "maine", name: "Maine Coon", cost: 200, color: "#A09078" },
  { id: "ragdoll", name: "Ragdoll", cost: 250, color: "#E8EEF4" },
  { id: "scottish", name: "Scottish Fold", cost: 300, color: "#B8B8C0" },
  { id: "russian", name: "Russian Blue", cost: 350, color: "#8CA0B8" },
  { id: "abyssinian", name: "Abyssinian", cost: 400, color: "#C87840" },
];

const MOOD_LABELS = {
  happy: "Happy",
  neutral: "Neutral",
  sad: "Sad",
};

function getCatSpritePath(breedId, mood) {
  const breed = breedId || "default";
  const moodKey = ["happy", "neutral", "sad"].includes(mood) ? mood : "neutral";
  return getAssetUrl(`assets/cats/${breed}-${moodKey}.svg`);
}

function getBreedById(breedId) {
  return CAT_BREEDS.find((b) => b.id === breedId) || CAT_BREEDS[0];
}
