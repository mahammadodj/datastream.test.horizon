(() => {
  const MODAL_ID = "marker-settings-modal";
  const FALLBACK_BACKDROP_CLASS = "modal-backdrop-fallback";

  const modalEl = document.getElementById(MODAL_ID);
  if (!modalEl) {
    console.warn(`[settings] Modal element #${MODAL_ID} not found; shortcut disabled.`);
    return;
  }

  const modalBody = modalEl.querySelector(".modal-body .container-fluid");
  if (!modalBody) {
    console.warn("[settings] Modal body container not found; marker settings disabled.");
    return;
  }

  modalBody.innerHTML = `
    <div class="marker-settings-panel">
      <div class="marker-settings-field">
        <label class="marker-settings-label" for="marker-settings-category">Color wells by</label>
        <div class="marker-settings-control">
          <select id="marker-settings-category" class="marker-settings-select" data-role="marker-category-select">
            <option value="">Monocolor (default)</option>
          </select>
          <button type="button" class="marker-settings-reset" data-role="marker-reset" hidden>Reset colors</button>
        </div>
      </div>
      <div class="marker-settings-placeholder" data-role="marker-placeholder">
        Select a categorical field to assign marker colors.
      </div>
      <div class="marker-settings-list" data-role="marker-color-list" hidden></div>
    </div>
  `;

  const panelEl = modalBody.querySelector(".marker-settings-panel");
  const selectEl = panelEl.querySelector('[data-role="marker-category-select"]');
  const placeholderEl = panelEl.querySelector('[data-role="marker-placeholder"]');
  const colorListEl = panelEl.querySelector('[data-role="marker-color-list"]');
  const resetBtn = panelEl.querySelector('[data-role="marker-reset"]');

  const modalState = {
    columns: [],
    activeColumn: null,
    columnColors: new Map(),
    defaultBaseColor: "#3498db"
  };

  const HEX6_REGEX = /^#([0-9a-fA-F]{6})$/;
  const HEX3_REGEX = /^#([0-9a-fA-F]{3})$/;

  function normalizeHexColor(value) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (HEX6_REGEX.test(trimmed)) return trimmed.toLowerCase();
    if (HEX3_REGEX.test(trimmed)) {
      const chars = trimmed.slice(1).split("");
      const expanded = chars.map(ch => `${ch}${ch}`).join("");
      return `#${expanded.toLowerCase()}`;
    }
    return null;
  }

  function hslToHex(h, s, l) {
    const sat = s / 100;
    const light = l / 100;
    const k = n => (n + h / 30) % 12;
    const a = sat * Math.min(light, 1 - light);
    const f = n => {
      const color = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      const value = Math.round(255 * color);
      return value.toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  function generateDistinctHexColors(count) {
    const total = Math.max(1, count);
    const colors = [];
    for (let i = 0; i < total; i += 1) {
      const hue = Math.round((360 / total) * i) % 360;
      colors.push(hslToHex(hue, 65, 55));
    }
    return colors;
  }

  function ensureColorMapping(columnInfo) {
    const existing = modalState.columnColors.get(columnInfo.name) || {};
    const colors = { ...existing };
    const palette = generateDistinctHexColors(columnInfo.values.length);
    let paletteIndex = 0;

    columnInfo.values.forEach(value => {
      const key = value.key;
      const stored = normalizeHexColor(colors[key] ?? existing[key]);
      if (stored) {
        colors[key] = stored;
        return;
      }
      const fallback = palette[paletteIndex % palette.length] || modalState.defaultBaseColor;
      paletteIndex += 1;
      colors[key] = fallback;
    });

    modalState.columnColors.set(columnInfo.name, colors);
    return { ...colors };
  }

  function applyCurrentScheme() {
    if (typeof window.applyMarkerColorScheme !== "function") return;
    const columnName = modalState.activeColumn;
    if (!columnName) {
      window.applyMarkerColorScheme({ column: null });
      return;
    }
    const colors = modalState.columnColors.get(columnName) || {};
    window.applyMarkerColorScheme({
      column: columnName,
      colors: { ...colors }
    });
  }

  function renderColorList(columnName) {
    if (!columnName) {
      colorListEl.innerHTML = "";
      colorListEl.hidden = true;
      placeholderEl.hidden = false;
      resetBtn.hidden = true;
      return;
    }

    const columnInfo = modalState.columns.find(col => col.name === columnName);
    if (!columnInfo) {
      colorListEl.innerHTML = "";
      colorListEl.hidden = true;
      placeholderEl.hidden = false;
      resetBtn.hidden = true;
      return;
    }

    const colors = ensureColorMapping(columnInfo);
    colorListEl.innerHTML = "";

    columnInfo.values.forEach(value => {
      const colorValue = colors[value.key] || modalState.defaultBaseColor;

      const row = document.createElement("div");
      row.className = "marker-color-row";

      const input = document.createElement("input");
      input.type = "color";
      input.className = "marker-color-input";
      input.dataset.role = "marker-color-input";
      input.dataset.valueKey = value.key;
      input.value = colorValue;
      input.title = `Color for ${value.label}`;

      const label = document.createElement("span");
      label.className = "marker-color-label";
      label.textContent = value.label;
      if (value.rawLabel !== undefined && value.rawLabel !== null) {
        label.title = String(value.rawLabel);
      }

      const count = document.createElement("span");
      count.className = "marker-color-count";
      if (Number.isFinite(value.count) && value.count > 0) {
        count.textContent = String(value.count);
      }

      row.appendChild(input);
      row.appendChild(label);
      if (count.textContent) {
        row.appendChild(count);
      }
      colorListEl.appendChild(row);
    });

    placeholderEl.hidden = true;
    colorListEl.hidden = false;
    resetBtn.hidden = false;
  }

  function updateDefaultColorFromMap() {
    if (typeof window.getMarkerColoringState !== "function") return;
    const colorState = window.getMarkerColoringState();
    if (colorState && typeof colorState.defaultColor === "string" && colorState.defaultColor.trim()) {
      const raw = colorState.defaultColor.trim();
      modalState.defaultBaseColor = normalizeHexColor(raw) || raw;
    }
  }

  function refreshColumns() {
    updateDefaultColorFromMap();

    const info = typeof window.getCategoricalColumnsInfo === "function"
      ? window.getCategoricalColumnsInfo() || []
      : [];
    modalState.columns = info;

    const previous = modalState.activeColumn;
    const hadPrevious = previous !== null && previous !== undefined && previous !== "";

    selectEl.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Monocolor (default)";
    selectEl.appendChild(defaultOption);

    let retainSelection = false;
    info.forEach(column => {
      const option = document.createElement("option");
      option.value = column.name;
      option.textContent = column.name;
      if (column.name === previous) {
        option.selected = true;
        retainSelection = true;
      }
      selectEl.appendChild(option);
    });

    if (retainSelection && previous) {
      modalState.activeColumn = previous;
      renderColorList(previous);
      applyCurrentScheme();
    } else {
      modalState.activeColumn = null;
      selectEl.value = "";
      renderColorList(null);
      if (hadPrevious) {
        applyCurrentScheme();
      }
    }
  }

  function handleColumnChange() {
    const value = selectEl.value;
    modalState.activeColumn = value || null;
    renderColorList(modalState.activeColumn);
    applyCurrentScheme();
  }

  function handleColorInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.role !== "marker-color-input") return;
    if (!modalState.activeColumn) return;
    const key = target.dataset.valueKey ?? "";
    const normalized = normalizeHexColor(target.value);
    if (!normalized) return;
    const colors = modalState.columnColors.get(modalState.activeColumn) || {};
    colors[key] = normalized;
    modalState.columnColors.set(modalState.activeColumn, colors);
    if (target.value !== normalized) {
      target.value = normalized;
    }
    applyCurrentScheme();
  }

  function handleResetClick(event) {
    const trigger = event.target instanceof Element ? event.target.closest('[data-role="marker-reset"]') : null;
    if (!trigger) return;
    event.preventDefault();
    if (!modalState.activeColumn) return;
    const columnInfo = modalState.columns.find(col => col.name === modalState.activeColumn);
    if (!columnInfo) return;
    if (columnInfo.values.length === 0) {
      modalState.columnColors.set(columnInfo.name, {});
      renderColorList(columnInfo.name);
      applyCurrentScheme();
      return;
    }

    const palette = generateDistinctHexColors(columnInfo.values.length);
    const resetMap = {};
    columnInfo.values.forEach((value, index) => {
      resetMap[value.key] = palette[index % palette.length] || modalState.defaultBaseColor;
    });
    modalState.columnColors.set(columnInfo.name, resetMap);
    renderColorList(columnInfo.name);
    applyCurrentScheme();
  }

  selectEl.addEventListener("change", handleColumnChange);
  panelEl.addEventListener("input", handleColorInput);
  panelEl.addEventListener("click", handleResetClick);

  document.addEventListener("efs:dataset-ready", refreshColumns);
  refreshColumns();

  let bootstrapModalInstance = null;
  let fallbackBackdropEl = null;
  let activeModalMode = "none";

  const showWithBootstrap5 = () => {
    if (!bootstrapModalInstance) {
      bootstrapModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    }
    bootstrapModalInstance.show();
    activeModalMode = "bootstrap5";
  };

  const showWithBootstrapLegacy = () => {
    window.jQuery(modalEl).modal("show");
    activeModalMode = "bootstrap-legacy";
  };

  const showWithFallback = () => {
    if (!fallbackBackdropEl) {
      fallbackBackdropEl = document.createElement("div");
      fallbackBackdropEl.className = `modal-backdrop fade in ${FALLBACK_BACKDROP_CLASS}`;
      document.body.appendChild(fallbackBackdropEl);
    } else {
      fallbackBackdropEl.style.display = "block";
      fallbackBackdropEl.classList.add("in");
    }

    modalEl.classList.add("in");
    modalEl.style.display = "block";
    modalEl.removeAttribute("aria-hidden");
    document.body.classList.add("modal-open");
    activeModalMode = "fallback";
  };

  const hideFallback = () => {
    if (activeModalMode !== "fallback") {
      return;
    }
    modalEl.classList.remove("in");
    modalEl.style.display = "none";
    modalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (fallbackBackdropEl) {
      fallbackBackdropEl.classList.remove("in");
      fallbackBackdropEl.style.display = "none";
    }
    activeModalMode = "none";
  };

  const showModal = () => {
    const hasBootstrap5 = typeof bootstrap !== "undefined" && typeof bootstrap.Modal === "function";
    const hasBootstrapLegacy =
      typeof window.jQuery !== "undefined" &&
      typeof window.jQuery.fn !== "undefined" &&
      typeof window.jQuery.fn.modal === "function";

    if (hasBootstrap5) {
      showWithBootstrap5();
    } else if (hasBootstrapLegacy) {
      showWithBootstrapLegacy();
    } else {
      console.warn("[settings] Bootstrap JS not detected, using fallback modal toggle.");
      showWithFallback();
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented) {
      return;
    }
    const isShiftS =
      event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      (event.key === "S" || event.key === "s");

    if (isShiftS) {
      event.preventDefault();
      showModal();
    }
  });

  modalEl.querySelectorAll('[data-dismiss="modal"]').forEach((el) => {
    el.addEventListener("click", (event) => {
      if (activeModalMode === "fallback") {
        event.preventDefault();
        hideFallback();
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (activeModalMode === "fallback" && event.key === "Escape") {
      event.preventDefault();
      hideFallback();
    }
  });
})();
