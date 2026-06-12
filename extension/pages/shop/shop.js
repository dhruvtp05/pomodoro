const breedGrid = document.getElementById("breed-grid");
const kibbleCountEl = document.getElementById("kibble-count");
const shopMessage = document.getElementById("shop-message");

document.addEventListener("DOMContentLoaded", () => {
  initPageNav("shop");
  renderShop();
});

async function renderShop() {
  const data = await chrome.storage.local.get(["kibble", "ownedCats", "activeCatBreed"]);
  const kibble = data.kibble ?? 0;
  const ownedCats = data.ownedCats ?? ["default"];
  const activeCatBreed = data.activeCatBreed ?? "default";

  kibbleCountEl.textContent = kibble;
  breedGrid.innerHTML = "";

  CAT_BREEDS.forEach((breed) => {
    const owned = ownedCats.includes(breed.id);
    const isActive = activeCatBreed === breed.id;

    const card = document.createElement("div");
    card.className = "breed-card";
    if (owned) card.classList.add("owned");
    if (isActive) card.classList.add("active");

    const img = document.createElement("img");
    img.src = getCatSpritePath(breed.id, "neutral");
    img.alt = breed.name;

    const info = document.createElement("div");
    info.className = "breed-info";
    info.innerHTML = `
      <div class="breed-name">${breed.name}</div>
      <div class="breed-cost">${breed.cost === 0 ? "Free starter cat" : `${breed.cost} kibble`}</div>
    `;

    const btn = document.createElement("button");
    btn.className = "buy-btn";

    if (isActive) {
      btn.textContent = "Active";
      btn.disabled = true;
    } else if (owned) {
      btn.textContent = "Equip";
      btn.addEventListener("click", () => equipCat(breed.id));
    } else if (kibble >= breed.cost) {
      btn.textContent = "Buy";
      btn.addEventListener("click", () => buyCat(breed));
    } else {
      btn.textContent = "Need more";
      btn.disabled = true;
    }

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(btn);
    breedGrid.appendChild(card);
  });
}

async function buyCat(breed) {
  const data = await chrome.storage.local.get(["kibble", "ownedCats"]);
  const kibble = data.kibble ?? 0;
  const ownedCats = data.ownedCats ?? ["default"];

  if (kibble < breed.cost) {
    setMessage("Not enough kibble.");
    return;
  }

  if (ownedCats.includes(breed.id)) {
    setMessage("You already own this cat.");
    return;
  }

  await chrome.storage.local.set({
    kibble: kibble - breed.cost,
    ownedCats: [...ownedCats, breed.id],
    activeCatBreed: breed.id,
  });

  setMessage(`Purchased ${breed.name}!`);
  await renderShop();
}

async function equipCat(breedId) {
  await chrome.storage.local.set({ activeCatBreed: breedId });
  const breed = getBreedById(breedId);
  setMessage(`${breed.name} equipped!`);
  await renderShop();
}

function setMessage(text) {
  shopMessage.textContent = text;
}
