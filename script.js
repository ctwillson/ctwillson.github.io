(() => {
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const orbitStage = document.querySelector("[data-orbit-stage]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const updateHeader = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 18);
  };

  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  if (!reducedMotion.matches) {
    window.addEventListener(
      "pointermove",
      (event) => {
        const x = (event.clientX / window.innerWidth) * 100;
        const y = (event.clientY / window.innerHeight) * 100;
        root.style.setProperty("--pointer-x", `${x.toFixed(2)}%`);
        root.style.setProperty("--pointer-y", `${y.toFixed(2)}%`);
      },
      { passive: true },
    );

    orbitStage?.addEventListener("pointermove", (event) => {
      const bounds = orbitStage.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      orbitStage.style.setProperty("--tilt-x", `${(x * 6).toFixed(2)}deg`);
      orbitStage.style.setProperty("--tilt-y", `${(y * -6).toFixed(2)}deg`);
    });

    orbitStage?.addEventListener("pointerleave", () => {
      orbitStage.style.setProperty("--tilt-x", "0deg");
      orbitStage.style.setProperty("--tilt-y", "0deg");
    });
  }

  const revealItems = [...document.querySelectorAll("[data-reveal]")];

  if (!("IntersectionObserver" in window) || reducedMotion.matches) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
  );

  revealItems.forEach((item) => observer.observe(item));
})();
