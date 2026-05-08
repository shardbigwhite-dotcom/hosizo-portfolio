const config = {
  owner: "shardbigwhite-dotcom",
  repo: "hosizo-portfolio",
  branch: "gh-pages",
  sitePath: "site.json"
};

let site = null;
let siteSha = null;

const $ = (selector) => document.querySelector(selector);
const toast = $("#toast");
const tokenInput = $("#github-token");
const rememberInput = $("#remember-token");
const ownerInput = $("#repo-owner");
const repoInput = $("#repo-name");
const branchInput = $("#repo-branch");

tokenInput.value = localStorage.getItem("hosizoGithubToken") || "";
rememberInput.checked = Boolean(tokenInput.value);

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 3000);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function slug(value, fallback = "media") {
  return (
    String(value || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || fallback
  );
}

function localized(value = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { en: value.en || value.zh || "", zh: value.zh || value.en || "" };
  }
  return { en: value, zh: value };
}

function localizedList(value = []) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { en: value.en || [], zh: value.zh || [] };
  }
  return { en: value, zh: value };
}

function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `..${path}`;
}

function clampPercent(value, fallback = 50) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function coverPosition(position) {
  return {
    x: clampPercent(position?.x),
    y: clampPercent(position?.y)
  };
}

function coverPositionStyle(position) {
  const safe = coverPosition(position);
  return `${safe.x}% ${safe.y}%`;
}

function mediaMarkup(path, alt = "", position = null) {
  if (!path) return `<div class="empty-media">No media</div>`;
  const url = escapeHtml(mediaUrl(path));
  const style = position ? ` style="object-position: ${coverPositionStyle(position)}"` : "";
  if (/\.(mp4|webm|mov)$/i.test(path)) {
    return `<video src="${url}" muted autoplay loop playsinline${style}></video>`;
  }
  return `<img src="${url}" alt="${escapeHtml(alt)}"${style}>`;
}

function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(value.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function githubHeaders() {
  const token = tokenInput.value.trim();
  if (!token) throw new Error("请先输入 GitHub token。");
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function repoConfig() {
  return {
    owner: ownerInput.value.trim() || config.owner,
    repo: repoInput.value.trim() || config.repo,
    branch: branchInput.value.trim() || config.branch
  };
}

async function githubGetContent(path) {
  const { owner, repo, branch } = repoConfig();
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}?ref=${encodeURIComponent(branch)}`,
    { headers: githubHeaders() }
  );
  if (!response.ok) throw new Error(`读取失败：${response.status}`);
  return response.json();
}

async function githubPutContent(path, content, message, sha = null) {
  const { owner, repo, branch } = repoConfig();
  const body = { branch, message, content };
  if (sha) body.sha = sha;
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}`,
    {
      method: "PUT",
      headers: { ...githubHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `保存失败：${response.status}`);
  }
  return response.json();
}

async function loadSite() {
  if (rememberInput.checked) localStorage.setItem("hosizoGithubToken", tokenInput.value.trim());
  else localStorage.removeItem("hosizoGithubToken");

  const file = await githubGetContent(config.sitePath);
  siteSha = file.sha;
  site = JSON.parse(base64ToUtf8(file.content));
  site.projects.forEach(normalizeProject);
  renderAll();
  showToast("已加载线上内容");
}

function setByPath(root, parts, value) {
  let cursor = root;
  parts.slice(0, -1).forEach((part) => {
    if (/^\d+$/.test(part)) {
      cursor = cursor[Number(part)];
      return;
    }
    cursor[part] = cursor[part] || {};
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
}

function normalizeProject(project) {
  project.gallery = Array.isArray(project.gallery) ? project.gallery.filter(Boolean) : [];
  if (project.cover && !project.gallery.includes(project.cover)) project.gallery.unshift(project.cover);
  if (!project.cover && project.gallery[0]) project.cover = project.gallery[0];
  project.coverPosition = coverPosition(project.coverPosition);
  return project;
}

function input(label, value, path, multiline = false) {
  const safeValue = escapeHtml(value || "");
  const dataPath = path.join(".");
  return `
    <label>
      <span>${label}</span>
      ${
        multiline
          ? `<textarea data-path="${dataPath}">${safeValue}</textarea>`
          : `<input data-path="${dataPath}" value="${safeValue}">`
      }
    </label>
  `;
}

function localizedInput(label, value, path, multiline = false) {
  const pair = localized(value);
  return `
    ${input(`${label} EN`, pair.en, [...path, "en"], multiline)}
    ${input(`${label} 中文`, pair.zh, [...path, "zh"], multiline)}
  `;
}

function listInput(label, value, index) {
  const pair = localizedList(value);
  return `
    ${input(`${label} EN`, pair.en.join(", "), ["projects", index, "tagsText", "en"])}
    ${input(`${label} 中文`, pair.zh.join(", "), ["projects", index, "tagsText", "zh"])}
  `;
}

function categorySelect(value, index) {
  const options = site.categories
    .filter((category) => category.id !== "all")
    .map((category) => {
      const label = localized(category.label);
      return `<option value="${category.id}" ${category.id === value ? "selected" : ""}>${escapeHtml(label.zh || label.en)}</option>`;
    })
    .join("");
  return `
    <label>
      <span>分类</span>
      <select data-path="projects.${index}.category">${options}</select>
    </label>
  `;
}

function coverPositionControls(position, index) {
  const safe = coverPosition(position);
  return `
    <div class="crop-controls">
      <label class="range-field">
        <span>封面横向焦点 <strong data-cover-value="${index}.x">${safe.x}%</strong></span>
        <input type="range" min="0" max="100" value="${safe.x}" data-cover-position="${index}.x">
      </label>
      <label class="range-field">
        <span>封面纵向焦点 <strong data-cover-value="${index}.y">${safe.y}%</strong></span>
        <input type="range" min="0" max="100" value="${safe.y}" data-cover-position="${index}.y">
      </label>
    </div>
  `;
}

function renderProfile() {
  $("#profile-form").innerHTML = [
    input("名称", site.profile.name, ["profile", "name"]),
    input("邮箱", site.profile.email, ["profile", "email"]),
    input("社交链接", site.profile.social, ["profile", "social"]),
    localizedInput("身份", site.profile.role, ["profile", "role"]),
    localizedInput("位置", site.profile.location, ["profile", "location"]),
    localizedInput("首页简介", site.profile.intro, ["profile", "intro"], true),
    localizedInput("可合作方向", site.profile.availability, ["profile", "availability"], true)
  ].join("");
}

function renderProjects() {
  site.projects.forEach(normalizeProject);
  $("#projects-form").innerHTML = site.projects
    .map((project, index) => {
      const title = localized(project.title).zh || localized(project.title).en || "未命名作品";
      const tags = localizedList(project.tags);
      project.tagsText = project.tagsText || { en: tags.en.join(", "), zh: tags.zh.join(", ") };
      return `
        <article class="project-card">
          <aside class="cover-box">
            <div class="cover-media" data-cover-preview="${index}">${mediaMarkup(project.cover, title, project.coverPosition)}</div>
            ${coverPositionControls(project.coverPosition, index)}
            <label class="upload-label">
              <span>上传并设为封面</span>
              <input type="file" accept="image/*,video/*" data-cover-upload="${index}">
            </label>
            <button class="secondary" type="button" data-add-gallery-url="${index}">添加图片路径</button>
            <p>${project.gallery.length} 张图库图片</p>
          </aside>
          <div class="project-fields">
            ${localizedInput("标题", project.title, ["projects", index, "title"])}
            ${localizedInput("副标题", project.subtitle, ["projects", index, "subtitle"])}
            ${input("年份", project.year, ["projects", index, "year"])}
            ${categorySelect(project.category, index)}
            ${input("封面路径", project.cover, ["projects", index, "cover"])}
            ${localizedInput("说明", project.description, ["projects", index, "description"], true)}
            ${localizedInput("署名/备注", project.credits, ["projects", index, "credits"])}
            ${listInput("标签，逗号分隔", project.tags, index)}
            <label class="remember">
              <input type="checkbox" data-featured="${index}" ${project.featured ? "checked" : ""}>
              <span>首页重点展示</span>
            </label>
            <div class="project-actions">
              <button class="secondary" type="button" data-duplicate="${index}">复制</button>
              <button class="danger" type="button" data-remove-project="${index}">删除作品</button>
            </div>
            <div class="gallery-block">
              <div class="media-actions">
                <h3>图库</h3>
                <label class="upload-label">
                  <span>上传图库图片</span>
                  <input type="file" accept="image/*,video/*" multiple data-gallery-upload="${index}">
                </label>
              </div>
              <div class="gallery-grid">
                ${project.gallery
                  .map(
                    (src, imageIndex) => `
                      <div class="gallery-item ${project.cover === src ? "is-cover" : ""}">
                        <div class="thumb">${mediaMarkup(src, `${title} ${imageIndex + 1}`)}</div>
                        <input value="${escapeHtml(src)}" data-gallery-path="${index}.${imageIndex}">
                        <div class="thumb-actions">
                          <button type="button" data-set-cover="${index}.${imageIndex}">设封面</button>
                          <button type="button" data-move-image="${index}.${imageIndex}.-1">上移</button>
                          <button type="button" data-move-image="${index}.${imageIndex}.1">下移</button>
                          <button class="danger" type="button" data-remove-image="${index}.${imageIndex}">删除</button>
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function bindInputs() {
  document.querySelectorAll("[data-path]").forEach((field) => {
    field.addEventListener("input", () => setByPath(site, field.dataset.path.split("."), field.value));
    field.addEventListener("change", () => setByPath(site, field.dataset.path.split("."), field.value));
  });

  document.querySelectorAll("[data-featured]").forEach((field) => {
    field.addEventListener("change", () => {
      site.projects[Number(field.dataset.featured)].featured = field.checked;
    });
  });
}

function bindCoverPositionControls() {
  document.querySelectorAll("[data-cover-position]").forEach((field) => {
    field.addEventListener("input", () => {
      const [projectIndex, axis] = field.dataset.coverPosition.split(".");
      const project = site.projects[Number(projectIndex)];
      project.coverPosition = coverPosition(project.coverPosition);
      project.coverPosition[axis] = clampPercent(field.value);

      const valueNode = document.querySelector(`[data-cover-value="${field.dataset.coverPosition}"]`);
      if (valueNode) valueNode.textContent = `${project.coverPosition[axis]}%`;

      const preview = document.querySelector(
        `[data-cover-preview="${projectIndex}"] img, [data-cover-preview="${projectIndex}"] video`
      );
      if (preview) preview.style.objectPosition = coverPositionStyle(project.coverPosition);
    });
  });
}

async function uploadFile(file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "jpg";
  const base = slug(file.name.replace(/\.[^.]+$/, ""), "image");
  const suffix = Math.random().toString(36).slice(2, 8);
  const path = `uploads/online/${Date.now()}-${suffix}-${base}.${ext}`;
  const content = arrayBufferToBase64(await file.arrayBuffer());
  await githubPutContent(path, content, `Upload ${file.name}`);
  return `/${path}`;
}

function bindUploads() {
  document.querySelectorAll("[data-cover-upload]").forEach((field) => {
    field.addEventListener("change", async () => {
      const file = field.files?.[0];
      if (!file) return;
      try {
        showToast("正在上传封面...");
        const path = await uploadFile(file);
        const project = site.projects[Number(field.dataset.coverUpload)];
        project.cover = path;
        if (!project.gallery.includes(path)) project.gallery.unshift(path);
        renderAll();
        showToast("封面已上传");
      } catch (error) {
        showToast(error.message, true);
      }
    });
  });

  document.querySelectorAll("[data-gallery-upload]").forEach((field) => {
    field.addEventListener("change", async () => {
      const files = [...(field.files || [])];
      if (!files.length) return;
      const project = site.projects[Number(field.dataset.galleryUpload)];
      try {
        showToast(`正在上传 ${files.length} 个文件...`);
        for (const file of files) {
          const path = await uploadFile(file);
          project.gallery.push(path);
          if (!project.cover) project.cover = path;
        }
        renderAll();
        showToast("图库已上传");
      } catch (error) {
        showToast(error.message, true);
      }
    });
  });
}

function bindProjectActions() {
  document.querySelectorAll("[data-remove-project]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirm("确定删除这个作品？")) return;
      site.projects.splice(Number(button.dataset.removeProject), 1);
      renderAll();
    });
  });

  document.querySelectorAll("[data-duplicate]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.duplicate);
      const clone = JSON.parse(JSON.stringify(site.projects[index]));
      clone.id = `${clone.id || "project"}-${Date.now()}`;
      clone.featured = false;
      site.projects.splice(index + 1, 0, clone);
      renderAll();
    });
  });

  document.querySelectorAll("[data-add-gallery-url]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = prompt("输入图片/视频路径，例如 /uploads/works/example.jpg");
      if (!value) return;
      const project = site.projects[Number(button.dataset.addGalleryUrl)];
      project.gallery.push(value.trim());
      if (!project.cover) project.cover = value.trim();
      renderAll();
    });
  });
}

function bindGalleryActions() {
  document.querySelectorAll("[data-gallery-path]").forEach((field) => {
    field.addEventListener("change", () => {
      const [projectIndex, imageIndex] = field.dataset.galleryPath.split(".").map(Number);
      const project = site.projects[projectIndex];
      const oldPath = project.gallery[imageIndex];
      project.gallery[imageIndex] = field.value.trim();
      if (project.cover === oldPath) project.cover = project.gallery[imageIndex];
      renderAll();
    });
  });

  document.querySelectorAll("[data-set-cover]").forEach((button) => {
    button.addEventListener("click", () => {
      const [projectIndex, imageIndex] = button.dataset.setCover.split(".").map(Number);
      site.projects[projectIndex].cover = site.projects[projectIndex].gallery[imageIndex];
      renderAll();
    });
  });

  document.querySelectorAll("[data-remove-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const [projectIndex, imageIndex] = button.dataset.removeImage.split(".").map(Number);
      const project = site.projects[projectIndex];
      const [removed] = project.gallery.splice(imageIndex, 1);
      if (project.cover === removed) project.cover = project.gallery[0] || "";
      renderAll();
    });
  });

  document.querySelectorAll("[data-move-image]").forEach((button) => {
    button.addEventListener("click", () => {
      const [projectIndex, imageIndex, direction] = button.dataset.moveImage.split(".").map(Number);
      const project = site.projects[projectIndex];
      const target = imageIndex + direction;
      if (target < 0 || target >= project.gallery.length) return;
      [project.gallery[imageIndex], project.gallery[target]] = [project.gallery[target], project.gallery[imageIndex]];
      renderAll();
    });
  });
}

function prepareSite() {
  site.projects.forEach((project) => {
    normalizeProject(project);
    project.id = project.id || slug(localized(project.title).en, "project");
    const currentTags = localizedList(project.tags);
    const tagText = project.tagsText || {
      en: currentTags.en.join(", "),
      zh: currentTags.zh.join(", ")
    };
    project.tags = {
      en: String(tagText.en || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      zh: String(tagText.zh || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    };
    delete project.tagsText;
  });
}

async function saveSite() {
  if (!site) {
    showToast("请先加载线上内容。", true);
    return;
  }
  try {
    prepareSite();
    const content = utf8ToBase64(`${JSON.stringify(site, null, 2)}\n`);
    const result = await githubPutContent(config.sitePath, content, "Update portfolio content", siteSha);
    siteSha = result.content.sha;
    showToast("已保存到线上，稍等刷新网站即可看到更新");
  } catch (error) {
    showToast(error.message, true);
  }
}

function renderAll() {
  if (!site) return;
  renderProfile();
  renderProjects();
  bindInputs();
  bindCoverPositionControls();
  bindUploads();
  bindProjectActions();
  bindGalleryActions();
}

$("#load-site").addEventListener("click", () => loadSite().catch((error) => showToast(error.message, true)));
$("#save-site").addEventListener("click", saveSite);
$("#add-project").addEventListener("click", () => {
  if (!site) {
    showToast("请先加载线上内容。", true);
    return;
  }
  site.projects.unshift({
    id: `project-${Date.now()}`,
    title: { en: "New Project", zh: "新作品" },
    subtitle: { en: "", zh: "" },
    year: String(new Date().getFullYear()),
    category: site.categories.find((category) => category.id !== "all")?.id || "object",
    cover: "",
    coverPosition: { x: 50, y: 50 },
    featured: false,
    gallery: [],
    description: { en: "", zh: "" },
    credits: { en: "", zh: "" },
    tags: { en: [], zh: [] }
  });
  renderAll();
});

fetch("../site.json")
  .then((response) => response.json())
  .then((data) => {
    site = data;
    site.projects.forEach(normalizeProject);
    renderAll();
    showToast("已载入预览内容，输入 token 后可保存");
  })
  .catch(() => {
    showToast("输入 token 后点击加载线上内容。");
  });
