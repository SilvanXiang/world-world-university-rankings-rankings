const pageKind = document.body.dataset.page;
const address = new URL(location.href);
let language = address.searchParams.get("lang") || localStorage.getItem("wwurr-language") || "en";
language = language === "zh" ? "zh" : "en";
const initialView = address.searchParams.get("view") === "all" ? "all" : "ranked";
const state = { query: "", coverage: "all", sort: "rank", view: initialView, page: 1, expanded: null };
const pageSize = 10;
const byId = id => document.getElementById(id);
const local = pair => pair[language === "zh" ? 1 : 0];
const t = key => local(labels[key]);
let countries;

function el(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function displayName(row) {
  return language === "zh" ? row.nameZh : row.name;
}

function coverageText(row) {
  if (row.country) return t("national") + " · " + countries.of(row.country);
  if (row.area) return local(row.area);
  return t("global");
}

function translateStatic() {
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  countries = new Intl.DisplayNames([document.documentElement.lang], { type: "region" });
  for (const [attribute, target] of [["data-i18n", "textContent"], ["data-i18n-aria", "aria-label"], ["data-i18n-alt", "alt"], ["data-i18n-placeholder", "placeholder"]]) {
    document.querySelectorAll("[" + attribute + "]").forEach(element => {
      const value = t(element.getAttribute(attribute));
      if (target === "textContent") element.textContent = value;
      else element.setAttribute(target, value);
    });
  }
  document.querySelectorAll("[data-lang]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.lang === language));
  });
  const editionTitle = t("brand") + " 2027";
  document.title = pageKind === "rankings" ? editionTitle : pageKind === "method" ? t("methodTitle") + " · " + editionTitle : t("aboutNav") + " · " + t("brand");
  if (pageKind === "rankings") {
    const heading = byId("edition-title");
    const last = el("span");
    last.append(el("i", "", language === "zh" ? "排名排名" : "Rankings"), " ", el("strong", "", "2027"));
    const lines = language === "zh" ? ["世界世界大学"] : ["World World", "University Rankings"];
    heading.replaceChildren(...lines.map(line => el("span", "", line)), last);
    heading.setAttribute("aria-label", editionTitle);
  }
  document.querySelectorAll("a[href]").forEach(anchor => {
    const href = anchor.getAttribute("href");
    if (href.startsWith("#") || /^(https?:|mailto:)/i.test(href)) return;
    const url = new URL(href, location.href);
    url.searchParams.set("lang", language);
    anchor.setAttribute("href", href.split(/[?#]/)[0] + url.search + url.hash);
  });
}

function normalize(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

function visibleRows() {
  const query = normalize(state.query);
  const results = rankings.filter(row => {
    const searchText = [row.id, row.name, row.nameZh, ...row.series, ...(row.aliases || [])].join(" ");
    return (state.view === "all" || row.rank !== null) &&
      (state.coverage === "all" || row.scope === state.coverage) &&
      (!query || normalize(searchText).includes(query));
  });
  if (state.sort === "title") results.sort((a,b) => a.series[0].localeCompare(b.series[0], "en"));
  if (state.sort === "publisher") results.sort((a,b) => a.name.localeCompare(b.name, "en") || a.series[0].localeCompare(b.series[0], "en"));
  return results;
}

function populateSelect(id, options, current) {
  const select = byId(id);
  select.replaceChildren(...options.map(([value, key]) => new Option(t(key), value)));
  select.value = current;
}

function recordButton(row, className, text) {
  const button = el("button", className, text);
  const open = state.expanded === row.id;
  button.type = "button";
  button.dataset.record = row.id;
  button.setAttribute("aria-label", t(open ? "close" : "open") + " · " + local(row.series));
  button.setAttribute("aria-expanded", String(open));
  if (open) button.setAttribute("aria-controls", "detail-" + row.id);
  return button;
}

function summaryRow(row) {
  const tr = el("tr", "table-record" + (state.expanded === row.id ? " expanded" : ""));
  tr.id = "ranking-" + row.id;
  tr.dataset.top = String(row.rank !== null && row.rank <= 3);
  const rank = el("td", "rank-number", row.rank === null ? "—" : String(row.rank).padStart(2, "0"));
  if (row.rank === null) rank.setAttribute("aria-label", t("unplaced"));
  const title = el("td", "publisher-cell");
  title.append(recordButton(row, "publisher-name", local(row.series)), el("small", "publisher-meta", coverageText(row) + " · " + localizedEdition(row.edition)));
  const mobileCitation = el("span", "small-ranking", row.citation ? local(row.citation) : t("unplaced"));
  title.append(mobileCitation);
  const publisher = el("td", "issuer-cell", displayName(row));
  const citation = el("td", "citation-cell" + (row.citation ? "" : " unplaced"), row.citation ? local(row.citation) : t("unplaced"));
  const toggle = el("td", "toggle-cell");
  toggle.append(recordButton(row, "row-toggle", state.expanded === row.id ? "−" : "+"));
  tr.append(rank, title, publisher, citation, toggle);
  return tr;
}

function localizedEdition(edition) {
  if (language === "en") return edition;
  return edition.replace("October ", "10 月 / ").replace(" snapshot", " 快照").replace("FY ", "财政年度 ");
}

function evidenceRow(row) {
  const tr = el("tr", "detail-row");
  const td = el("td");
  td.colSpan = 5;
  const detail = el("div", "record-detail");
  detail.id = "detail-" + row.id;
  const head = el("div", "detail-head");
  head.append(el("h3", "", displayName(row)), el("span", "", t("sampleEdition") + " · " + localizedEdition(row.edition)));
  detail.append(head, el("p", "detail-note", local(row.note)));
  if (row.partners) detail.append(el("p", "partners", t("partners") + " · " + local(row.partners)));
  const links = el("div", "record-links");
  row.references.forEach(([key, url]) => {
    const anchor = el("a", "", t(key) + " ↗");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    links.append(anchor);
  });
  detail.append(links);
  td.append(detail);
  tr.append(td);
  return tr;
}

function pageButton(number, text, label, disabled) {
  const button = el("button", "", text);
  button.type = "button";
  button.dataset.page = number;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  return button;
}

function renderTable() {
  const result = visibleRows();
  const pages = Math.ceil(result.length / pageSize);
  state.page = Math.max(1, Math.min(state.page, pages));
  const start = (state.page - 1) * pageSize;
  const slice = result.slice(start, start + pageSize);
  const list = document.createDocumentFragment();
  for (const row of slice) {
    list.append(summaryRow(row));
    if (state.expanded === row.id) list.append(evidenceRow(row));
  }
  byId("ranking-table").tBodies[0].replaceChildren(list);
  byId("empty").hidden = result.length > 0;
  const range = start + 1 + "–" + (start + slice.length);
  byId("count").textContent = language === "zh"
    ? (result.length ? "显示第 " + range + " 份，共 " + result.length + " 份榜单" : "0 份榜单")
    : (result.length ? "Showing " + range + " of " + result.length + " rankings" : "0 rankings");
  document.querySelectorAll("[data-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.view === state.view)));
  const pager = byId("pager");
  pager.replaceChildren();
  pager.hidden = pages < 2;
  if (pages < 2) return;
  pager.append(pageButton(state.page - 1, "←", t("previous"), state.page === 1));
  for (let index = 1; index <= pages; index++) {
    const button = pageButton(index, String(index), language === "zh" ? "第 " + index + " 页" : "Page " + index, false);
    if (index === state.page) button.setAttribute("aria-current", "page");
    pager.append(button);
  }
  pager.append(pageButton(state.page + 1, "→", t("next"), state.page === pages));
}

function render() {
  translateStatic();
  if (pageKind === "rankings") {
    populateSelect("coverage", ["all", "global", "regional", "national"].map(key => [key, key]), state.coverage);
    populateSelect("sort", [["rank", "rankOrder"], ["title", "titleSort"], ["publisher", "issuerSort"]], state.sort);
    renderTable();
  }
}

function updateRecordAddress(id) {
  const url = new URL(location.href);
  if (state.view === "all") url.searchParams.set("view", "all");
  else url.searchParams.delete("view");
  url.hash = id ? "ranking-" + id : "rankings";
  history.replaceState(null, "", url);
}

function bindTable() {
  byId("search").addEventListener("input", event => {
    state.query = event.target.value;
    state.page = 1;
    renderTable();
  });
  ["coverage", "sort"].forEach(key => byId(key).addEventListener("change", event => {
    state[key] = event.target.value;
    state.page = 1;
    renderTable();
  }));
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
    state.view = button.dataset.view;
    state.page = 1;
    state.expanded = null;
    updateRecordAddress(null);
    renderTable();
  }));
  byId("ranking-table").addEventListener("click", event => {
    const button = event.target.closest("button[data-record]");
    if (!button) return;
    const id = button.dataset.record;
    state.expanded = state.expanded === id ? null : id;
    updateRecordAddress(state.expanded);
    renderTable();
    byId("ranking-" + id).querySelector("." + button.className).focus({preventScroll:true});
  });
  byId("pager").addEventListener("click", event => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled || Number(button.dataset.page) === state.page) return;
    state.page = Number(button.dataset.page);
    state.expanded = null;
    updateRecordAddress(null);
    renderTable();
    byId("rankings").scrollIntoView({block:"start"});
    byId("ranking-table").querySelector(".publisher-name").focus({preventScroll:true});
  });
  byId("clear").addEventListener("click", () => {
    state.query = "";
    state.coverage = "all";
    state.page = 1;
    byId("search").value = "";
    byId("coverage").value = "all";
    renderTable();
    byId("search").focus();
  });
}

document.querySelectorAll("[data-lang]").forEach(button => button.addEventListener("click", () => {
  language = button.dataset.lang;
  localStorage.setItem("wwurr-language", language);
  const url = new URL(location.href);
  url.searchParams.set("lang", language);
  history.replaceState(null, "", url);
  render();
}));
if (pageKind === "rankings") {
  bindTable();
  const target = rankings.find(row => "#ranking-" + row.id === location.hash);
  if (target) {
    if (target.rank === null) state.view = "all";
    state.page = Math.floor(visibleRows().indexOf(target) / pageSize) + 1;
    state.expanded = target.id;
  }
}
render();
if (pageKind === "rankings" && state.expanded) byId("ranking-" + state.expanded).scrollIntoView({block:"start"});
