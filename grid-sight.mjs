const l = {
  TOGGLE_ACTIVATED: "grid-sight:toggle-activated",
  TOGGLE_DEACTIVATED: "grid-sight:toggle-deactivated",
  ENRICHMENT_APPLIED: "grid-sight:enrichment-applied",
  ENRICHMENT_REMOVED: "grid-sight:enrichment-removed"
}, y = () => {
  document.addEventListener(l.TOGGLE_ACTIVATED, (t) => {
    const o = t.detail.tableElement;
    o.classList.add("grid-sight-active"), console.log("Grid-Sight activated for table:", o);
  }), document.addEventListener(l.TOGGLE_DEACTIVATED, (t) => {
    const o = t.detail.tableElement;
    o.classList.remove("grid-sight-active"), console.log("Grid-Sight deactivated for table:", o);
  });
}, d = (t, e) => {
  const o = new CustomEvent(t, {
    bubbles: !0,
    detail: e
  });
  document.dispatchEvent(o);
}, b = (t) => {
  const e = [];
  if (t.forEach((r) => {
    var c;
    const n = parseFloat(((c = r.textContent) == null ? void 0 : c.trim()) || "");
    isNaN(n) ? r.style.backgroundColor = "transparent" : e.push({ cell: r, value: n });
  }), e.length === 0) return;
  const o = e.map((r) => r.value), s = Math.min(...o), i = Math.max(...o);
  e.forEach(({ cell: r, value: n }) => {
    const c = (n - s) / (i - s), a = g(c);
    r.style.backgroundColor = a;
  });
}, g = (t) => {
  const e = Math.round(t * 255), o = Math.round((1 - t) * 255);
  return `rgb(${e}, 0, ${o})`;
}, v = (t) => {
  t.forEach((e) => {
    e.style.backgroundColor = "";
  });
}, A = (t) => {
  const e = t.reduce((r, n) => r + n, 0) / t.length, s = t.map((r) => Math.pow(r - e, 2)).reduce((r, n) => r + n, 0) / t.length, i = Math.sqrt(s);
  return t.map((r) => (r - e) / (i || 1));
}, T = (t, e = 2) => {
  const o = [];
  if (t.forEach((n) => {
    var a;
    const c = parseFloat(((a = n.textContent) == null ? void 0 : a.trim()) || "");
    isNaN(c) || o.push({ cell: n, value: c });
  }), o.length === 0) return [];
  const s = o.map((n) => n.value), i = A(s);
  return o.map((n, c) => ({
    cell: n.cell,
    value: n.value,
    zScore: i[c]
  })).filter((n) => Math.abs(n.zScore) > e);
}, C = (t) => {
  t.forEach(({ cell: e, zScore: o }) => {
    e.classList.add("grid-sight-outlier"), e.setAttribute("data-zscore", o.toFixed(2));
    const s = o > 0;
    e.style.border = `2px solid ${s ? "red" : "blue"}`, e.style.position = "relative", e.title = `Z-Score: ${o.toFixed(2)}`;
  });
}, x = (t) => {
  t.forEach((e) => {
    e.classList.remove("grid-sight-outlier"), e.removeAttribute("data-zscore"), e.style.border = "", e.title = "";
  });
}, m = (t, e, o) => {
  t.preventDefault(), t.stopPropagation(), h();
  const s = document.createElement("div");
  s.className = "grid-sight-context-menu", [
    { label: "Apply Heatmap", action: () => S(e, o, t.target) },
    { label: "Detect Outliers", action: () => L(e, o, t.target) },
    { label: "Clear Enrichments", action: () => w(e, o, t.target) }
  ].forEach((r) => {
    const n = document.createElement("div");
    n.className = "grid-sight-context-menu-item", n.textContent = r.label, n.addEventListener("click", () => {
      r.action(), h();
    }), s.appendChild(n);
  }), s.style.position = "absolute", s.style.left = `${t.pageX}px`, s.style.top = `${t.pageY}px`, document.body.appendChild(s), document.addEventListener("click", h, { once: !0 });
}, h = () => {
  const t = document.querySelector(".grid-sight-context-menu");
  t && t.remove();
}, S = (t, e, o) => {
  const s = E(t, e, o);
  s.length > 0 && (b(s), d(l.ENRICHMENT_APPLIED, {
    tableElement: t,
    enrichmentType: "heatmap",
    cells: s
  }));
}, L = (t, e, o) => {
  const s = E(t, e, o);
  if (s.length > 0) {
    const i = T(s);
    C(i), d(l.ENRICHMENT_APPLIED, {
      tableElement: t,
      enrichmentType: "zscore",
      cells: s,
      outliers: i
    });
  }
}, w = (t, e, o) => {
  const s = E(t, e, o);
  s.length > 0 && (v(s), x(s), d(l.ENRICHMENT_REMOVED, {
    tableElement: t,
    cells: s
  }));
}, E = (t, e, o) => {
  const s = [];
  if (e) {
    const i = t.querySelector("thead tr");
    if (!i) return s;
    const r = Array.from(i.querySelectorAll("th"));
    let n = -1;
    if (r.forEach((a, u) => {
      a.contains(o) && (n = u);
    }), n === -1) return s;
    t.querySelectorAll("tbody tr").forEach((a) => {
      const u = a.querySelectorAll("td")[n];
      u && s.push(u);
    });
  } else {
    const i = Array.from(t.querySelectorAll("tbody tr"));
    let r = null;
    for (const c of i)
      if (c.contains(o)) {
        r = c;
        break;
      }
    if (!r) return s;
    const n = Array.from(r.querySelectorAll("td"));
    n[0] && n[0].contains(o) ? s.push(...n.slice(1)) : s.push(...n);
  }
  return s;
}, D = (t) => {
  const e = document.createElement("div");
  e.className = "grid-sight-toggle", e.setAttribute("role", "button"), e.setAttribute("tabindex", "0"), e.setAttribute("aria-label", "Toggle Grid-Sight data visualization");
  let o = !1;
  f(e, o), I(e, t), e.addEventListener("click", () => {
    o = !o, f(e, o), o ? (d(l.TOGGLE_ACTIVATED, { tableElement: t }), N(t)) : (d(l.TOGGLE_DEACTIVATED, { tableElement: t }), k(t));
  }), e.addEventListener("keydown", (s) => {
    (s.key === "Enter" || s.key === " ") && (s.preventDefault(), e.click());
  }), document.body.appendChild(e);
}, f = (t, e) => {
  e ? (t.classList.add("active"), t.setAttribute("aria-pressed", "true"), t.textContent = "GS") : (t.classList.remove("active"), t.setAttribute("aria-pressed", "false"), t.textContent = "GS");
}, I = (t, e) => {
  const o = e.getBoundingClientRect();
  t.style.position = "absolute", t.style.top = `${o.top + window.scrollY}px`, t.style.left = `${o.right + window.scrollX - 40}px`, t.style.backgroundColor = "#2c3e50", t.style.color = "white", t.style.padding = "4px 8px", t.style.borderRadius = "4px", t.style.cursor = "pointer", t.style.zIndex = "1000", t.style.fontSize = "14px", t.style.fontWeight = "bold";
}, N = (t) => {
  t.querySelectorAll("thead th").forEach((s) => {
    const i = document.createElement("span");
    i.className = "grid-sight-plus-icon", i.textContent = "+", i.style.marginLeft = "5px", i.style.cursor = "pointer", i.addEventListener("click", (r) => {
      m(r, t, !0);
    }), i.setAttribute("tabindex", "0"), i.setAttribute("role", "button"), i.setAttribute("aria-label", "Show column options"), i.addEventListener("keydown", (r) => {
      (r.key === "Enter" || r.key === " ") && (r.preventDefault(), i.click());
    }), s.appendChild(i);
  }), t.querySelectorAll("tbody tr").forEach((s) => {
    const i = s.querySelector("td");
    if (i) {
      const r = document.createElement("span");
      r.className = "grid-sight-plus-icon", r.textContent = "+", r.style.marginRight = "5px", r.style.cursor = "pointer", r.addEventListener("click", (n) => {
        m(n, t, !1);
      }), r.setAttribute("tabindex", "0"), r.setAttribute("role", "button"), r.setAttribute("aria-label", "Show row options"), r.addEventListener("keydown", (n) => {
        (n.key === "Enter" || n.key === " ") && (n.preventDefault(), r.click());
      }), i.insertBefore(r, i.firstChild);
    }
  });
}, k = (t) => {
  t.querySelectorAll(".grid-sight-plus-icon").forEach((o) => {
    o.remove();
  });
}, M = (t) => {
  const e = !!t.querySelector("thead"), o = !!t.querySelector("tbody");
  return !e || !o ? (console.error("Grid-Sight: invalid table structure - missing thead or tbody"), !1) : !0;
}, p = (t) => {
  M(t) && D(t);
}, G = () => {
  document.querySelectorAll("table").forEach((e) => {
    p(e);
  }), q();
}, q = () => {
  new MutationObserver((e) => {
    e.forEach((o) => {
      o.addedNodes.forEach((s) => {
        s.nodeName === "TABLE" && p(s), s.nodeType === Node.ELEMENT_NODE && s.querySelectorAll("table").forEach((r) => {
          p(r);
        });
      });
    });
  }).observe(document.body, {
    childList: !0,
    subtree: !0
  });
}, O = "0.1.0";
function R() {
  console.log(`Grid-Sight v${O} initialized`), y(), G();
}
typeof window < "u" && window.addEventListener("DOMContentLoaded", () => {
  R();
});
export {
  R as initialize
};
//# sourceMappingURL=grid-sight.mjs.map
