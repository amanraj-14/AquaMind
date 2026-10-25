const getStarted = document.getElementById("getStarted");
const loginBtn = document.getElementById("loginBtn");

getStarted.addEventListener("click", () => {
  alert("Welcome to AquaMind!");
});

loginBtn.addEventListener("click", () => {
  alert("Login page coming soon.");
});
function showSection(sectionId) {
  const overviewSection = document.getElementById("overviewSection");
  const zoneMapSection = document.getElementById("zoneMapSection");

  if (sectionId === "zoneMapSection") {
    overviewSection.style.display = "none";
    zoneMapSection.style.display = "block";
  } else {
    overviewSection.style.display = "block";
    zoneMapSection.style.display = "none";
  }
}
