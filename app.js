const labels = {
  en: {
    work: "Work",
    profile: "Profile",
    available: "Available for",
    selected: "Selected works",
    open: "Open case",
    images: "images",
    previous: "Previous",
    next: "Next"
  },
  zh: {
    work: "作品",
    profile: "简介",
    available: "可合作方向",
    selected: "精选作品",
    open: "查看作品",
    images: "张图",
    previous: "上一张",
    next: "下一张"
  }
};

const state = {
  site: null,
  active: "all",
  lang:
    localStorage.getItem("portfolioLang") ||
    (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en")
};

const $ = (selector) => document.querySelector(selector);
const scriptUrl = new URL(import.meta.url);
const basePath = scriptUrl.pathname.replace(/\/[^/]*$/, "").replace(/\/$/, "");

function withBase(path) {
  if (!path || /^(https?:|data:|mailto:|#)/i.test(path)) return path;
  if (!path.startsWith("/")) return path;
  return `${basePath}${path}`;
}

function text(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value[state.lang] || value.en || value.zh || "";
  }
  return value || "";
}

function categoryLabel(id) {
  const category = state.site.categories.find((item) => item.id === id);
  return text(category?.label || id);
}

function normalizeUrl(value) {
  if (!value) return "#";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes("@")) return `mailto:${value}`;
  return `https://${value}`;
}

function coverPosition(position) {
  const x = Number(position?.x ?? 50);
  const y = Number(position?.y ?? 50);
  const safeX = Math.min(100, Math.max(0, Number.isFinite(x) ? x : 50));
  const safeY = Math.min(100, Math.max(0, Number.isFinite(y) ? y : 50));
  return `${safeX}% ${safeY}%`;
}

function mediaMarkup(src, alt = "", eager = false, position = null) {
  const resolved = withBase(src || "/uploads/works/akira-02.jpg");
  const style = position ? ` style="object-position: ${coverPosition(position)}"` : "";
  if (/\.(mp4|webm|mov)$/i.test(resolved)) {
    return `<video src="${resolved}" muted autoplay loop playsinline${style}></video>`;
  }
  return `<img src="${resolved}" alt="${alt}" loading="${eager ? "eager" : "lazy"}" decoding="async"${style}>`;
}

function projectImages(project) {
  return [...new Set([project.cover, ...(project.gallery || [])].filter(Boolean))];
}

function renderStaticLabels() {
  document.documentElement.lang = state.lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = labels[state.lang][node.dataset.i18n];
  });
  $("#work-title").textContent = labels[state.lang].selected;
  $("#available-label").textContent = labels[state.lang].available;
  document.querySelectorAll("#lang-toggle button").forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === state.lang);
  });
}

function renderHeroMedia(site) {
  const hero = $("#hero-media");
  const heroProjects = site.projects.filter((project) => project.featured).slice(0, 3);
  hero.innerHTML = heroProjects
    .map((project, index) => {
      const title = text(project.title);
      return `
        <button class="hero-frame" type="button" data-id="${project.id}">
          ${mediaMarkup(project.cover, title, index === 0, project.coverPosition)}
          <span>${String(index + 1).padStart(2, "0")} / ${title}</span>
        </button>
      `;
    })
    .join("");
  hero.querySelectorAll(".hero-frame").forEach((frame) => {
    frame.addEventListener("click", () => openProject(frame.dataset.id));
  });
}

function renderProfile(site) {
  $("#profile-name").textContent = site.profile.name;
  $("#profile-role").textContent = text(site.profile.role);
  $("#profile-intro").textContent = text(site.profile.intro);
  $("#availability").textContent = text(site.profile.availability);
  $(".brand").textContent = site.profile.name;
  $("#profile-location").textContent = text(site.profile.location);
  $("#profile-email").textContent = site.profile.email;
  $("#profile-email").href = `mailto:${site.profile.email}`;
  $("#profile-social").textContent = site.profile.social;
  $("#profile-social").href = normalizeUrl(site.profile.social);
  document.title = `${site.profile.name} - ${text(site.profile.role)}`;
}

function renderFilters(site) {
  const filters = $("#filters");
  filters.innerHTML = "";
  const categories = site.categories?.length ? site.categories : [{ id: "all", label: "Everything" }];
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = category.id === state.active ? "active" : "";
    button.textContent = text(category.label);
    button.addEventListener("click", () => {
      state.active = category.id;
      renderFilters(state.site);
      renderProjects(state.site);
    });
    filters.append(button);
  });
}

function renderProjects(site) {
  const grid = $("#work-grid");
  const projects = site.projects.filter(
    (project) => state.active === "all" || project.category === state.active
  );
  grid.innerHTML = projects
    .map((project, index) => {
      const images = projectImages(project);
      const tags = [categoryLabel(project.category), project.year, ...(text(project.tags) || []).slice(0, 2)];
      const title = text(project.title);
      return `
        <article class="project-tile ${project.featured ? "featured" : ""}" data-id="${project.id}">
          <div class="tile-media">${mediaMarkup(project.cover, title, index < 2, project.coverPosition)}</div>
          <div class="tile-copy">
            <div class="tile-kicker">
              <span>${String(index + 1).padStart(2, "0")}</span>
              <span>${images.length} ${labels[state.lang].images}</span>
            </div>
            <h3>${title}</h3>
            <p>${text(project.subtitle)}</p>
            <div class="tag-row">${tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
            <button type="button">${labels[state.lang].open}</button>
          </div>
        </article>
      `;
    })
    .join("");
  grid.querySelectorAll(".project-tile").forEach((tile) => {
    tile.addEventListener("click", () => openProject(tile.dataset.id));
  });
}

function openProject(id) {
  const project = state.site.projects.find((item) => item.id === id);
  if (!project) return;

  const title = text(project.title);
  const images = projectImages(project);
  let activeImage = 0;

  $("#dialog-content").innerHTML = `
    <div class="dialog-stage">
      <div class="dialog-media" id="dialog-media"></div>
      <button class="dialog-nav prev" type="button" aria-label="${labels[state.lang].previous}">‹</button>
      <button class="dialog-nav next" type="button" aria-label="${labels[state.lang].next}">›</button>
    </div>
    <aside class="dialog-copy">
      <p>${categoryLabel(project.category)} / ${project.year}</p>
      <h2>${title}</h2>
      <h3>${text(project.subtitle)}</h3>
      <p>${text(project.description)}</p>
      <small>${text(project.credits)}</small>
      <div class="dialog-tags">${(text(project.tags) || []).map((tag) => `<span>${tag}</span>`).join("")}</div>
      <div class="thumb-strip" id="thumb-strip"></div>
    </aside>
  `;

  const renderImage = () => {
    const imagePosition = images[activeImage] === project.cover ? project.coverPosition : null;
    $("#dialog-media").innerHTML = mediaMarkup(images[activeImage], title, true, imagePosition);
    $("#thumb-strip").innerHTML = images
      .map(
        (src, index) => `
          <button type="button" class="${index === activeImage ? "active" : ""}" data-index="${index}">
            ${mediaMarkup(src, `${title} ${index + 1}`, false, src === project.cover ? project.coverPosition : null)}
          </button>
        `
      )
      .join("");
    $("#thumb-strip").querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        activeImage = Number(button.dataset.index);
        renderImage();
      });
    });
  };

  const step = (direction) => {
    activeImage = (activeImage + direction + images.length) % images.length;
    renderImage();
  };

  $(".dialog-nav.prev").addEventListener("click", (event) => {
    event.stopPropagation();
    step(-1);
  });
  $(".dialog-nav.next").addEventListener("click", (event) => {
    event.stopPropagation();
    step(1);
  });

  renderImage();
  $("#project-dialog").showModal();
}

function renderAll() {
  renderStaticLabels();
  renderProfile(state.site);
  renderHeroMedia(state.site);
  renderFilters(state.site);
  renderProjects(state.site);
}

document.querySelectorAll("#lang-toggle button").forEach((button) => {
  button.addEventListener("click", () => {
    state.lang = button.dataset.lang;
    localStorage.setItem("portfolioLang", state.lang);
    renderAll();
  });
});

$("#dialog-close").addEventListener("click", () => $("#project-dialog").close());
$("#project-dialog").addEventListener("click", (event) => {
  if (event.target.id === "project-dialog") $("#project-dialog").close();
});
$("#project-dialog").addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") $(".dialog-nav.prev")?.click();
  if (event.key === "ArrowRight") $(".dialog-nav.next")?.click();
});

async function loadSite() {
  const staticPath = `${basePath}/site.json`;
  try {
    const staticResponse = await fetch(staticPath);
    if (staticResponse.ok && staticResponse.headers.get("content-type")?.includes("application/json")) {
      return staticResponse.json();
    }
  } catch (_error) {
    // Local server mode falls back to the editable API below.
  }

  const apiResponse = await fetch(`${basePath}/api/site`);
  if (!apiResponse.ok) throw new Error("Unable to load site content.");
  return apiResponse.json();
}

loadSite().then((site) => {
  state.site = site;
  renderAll();
});
