document.addEventListener("DOMContentLoaded", function () {
  const themeToggle = document.getElementById("theme-toggle");
  const body = document.body;
  const scrollTopBtn = document.getElementById("scroll-top");

  if (themeToggle && body) {
    themeToggle.addEventListener("click", function () {
      const currentTheme =
        body.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      body.setAttribute("data-theme", newTheme);

      const icon = themeToggle.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-sun", newTheme === "light");
        icon.classList.toggle("fa-moon", newTheme === "dark");
      }

      localStorage.setItem("theme", newTheme);
    });

    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");

    body.setAttribute("data-theme", initialTheme);

    const initialIcon = themeToggle.querySelector("i");
    if (initialIcon) {
      initialIcon.classList.toggle("fa-sun", initialTheme === "light");
      initialIcon.classList.toggle("fa-moon", initialTheme === "dark");
    }
  }

  if (scrollTopBtn) {
    window.addEventListener("scroll", function () {
      if (window.pageYOffset > 300) {
        scrollTopBtn.classList.add("visible");
      } else {
        scrollTopBtn.classList.remove("visible");
      }
    });

    scrollTopBtn.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  }
});
