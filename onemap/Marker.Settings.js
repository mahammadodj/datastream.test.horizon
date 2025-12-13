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
      <div class="marker-settings-section">
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

      <div class="marker-settings-section">
        <div class="marker-settings-field">
          <label class="marker-settings-label" for="marker-settings-shape-category">Shape wells by</label>
          <div class="marker-settings-control">
            <select id="marker-settings-shape-category" class="marker-settings-select" data-role="marker-shape-category-select">
              <option value="">Default (Circle/Triangle)</option>
            </select>
            <button type="button" class="marker-settings-reset" data-role="marker-shape-reset" hidden>Reset shapes</button>
          </div>
        </div>
        <div class="marker-settings-placeholder" data-role="marker-shape-placeholder">
          Select a categorical field to assign marker shapes.
        </div>
        <div class="marker-settings-list" data-role="marker-shape-list" hidden></div>
      </div>
    </div>
  `;

  const panelEl = modalBody.querySelector(".marker-settings-panel");
  
  // Color Elements
  const selectEl = panelEl.querySelector('[data-role="marker-category-select"]');
  const placeholderEl = panelEl.querySelector('[data-role="marker-placeholder"]');
  const colorListEl = panelEl.querySelector('[data-role="marker-color-list"]');
  const resetBtn = panelEl.querySelector('[data-role="marker-reset"]');

  // Shape Elements
  const shapeSelectEl = panelEl.querySelector('[data-role="marker-shape-category-select"]');
  const shapePlaceholderEl = panelEl.querySelector('[data-role="marker-shape-placeholder"]');
  const shapeListEl = panelEl.querySelector('[data-role="marker-shape-list"]');
  const shapeResetBtn = panelEl.querySelector('[data-role="marker-shape-reset"]');

  const modalState = {
    columns: [],
    activeColumn: null,
    columnColors: new Map(),
    defaultBaseColor: "#3498db",
    
    // Shape State
    activeShapeColumn: null,
    columnShapes: new Map(),
    defaultBaseShape: "circle"
  };

  const AVAILABLE_SHAPES = [
    { value: 'circle', label: 'Circle (●)' },
    { value: 'triangle', label: 'Triangle (▼)' },
    { value: 'square', label: 'Square (■)' },
    { value: 'diamond', label: 'Diamond (◆)' }
  ];

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

  function ensureShapeMapping(columnInfo) {
    const existing = modalState.columnShapes.get(columnInfo.name) || {};
    const shapes = { ...existing };
    let shapeIndex = 0;

    columnInfo.values.forEach(value => {
      const key = value.key;
      if (shapes[key]) return;
      
      // Cycle through available shapes
      const fallback = AVAILABLE_SHAPES[shapeIndex % AVAILABLE_SHAPES.length].value;
      shapeIndex += 1;
      shapes[key] = fallback;
    });

    modalState.columnShapes.set(columnInfo.name, shapes);
    return { ...shapes };
  }

  function applyCurrentShapeScheme() {
    if (typeof window.applyMarkerShapeScheme !== "function") return;
    const columnName = modalState.activeShapeColumn;
    if (!columnName) {
      window.applyMarkerShapeScheme({ column: null });
      return;
    }
    const shapes = modalState.columnShapes.get(columnName) || {};
    window.applyMarkerShapeScheme({
      column: columnName,
      shapes: { ...shapes }
    });
  }

  function renderShapeList(columnName) {
    if (!columnName) {
      shapeListEl.innerHTML = "";
      shapeListEl.hidden = true;
      shapePlaceholderEl.hidden = false;
      shapeResetBtn.hidden = true;
      return;
    }

    const columnInfo = modalState.columns.find(col => col.name === columnName);
    if (!columnInfo) {
      shapeListEl.innerHTML = "";
      shapeListEl.hidden = true;
      shapePlaceholderEl.hidden = false;
      shapeResetBtn.hidden = true;
      return;
    }

    const shapes = ensureShapeMapping(columnInfo);
    shapeListEl.innerHTML = "";

    columnInfo.values.forEach(value => {
      const shapeValue = shapes[value.key] || modalState.defaultBaseShape;

      const row = document.createElement("div");
      row.className = "marker-color-row"; // Reuse existing class for layout

      const select = document.createElement("select");
      select.className = "marker-settings-select";
      select.style.width = "auto";
      select.style.marginRight = "10px";
      select.dataset.role = "marker-shape-select";
      select.dataset.valueKey = value.key;
      
      AVAILABLE_SHAPES.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === shapeValue) option.selected = true;
        select.appendChild(option);
      });

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

      row.appendChild(select);
      row.appendChild(label);
      if (count.textContent) {
        row.appendChild(count);
      }
      shapeListEl.appendChild(row);
    });

    shapePlaceholderEl.hidden = true;
    shapeListEl.hidden = false;
    shapeResetBtn.hidden = false;
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

    // Populate Color Select
    selectEl.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Monocolor (default)";
    selectEl.appendChild(defaultOption);

    // Populate Shape Select
    const previousShape = modalState.activeShapeColumn;
    const hadPreviousShape = previousShape !== null && previousShape !== undefined && previousShape !== "";
    
    shapeSelectEl.innerHTML = "";
    const defaultShapeOption = document.createElement("option");
    defaultShapeOption.value = "";
    defaultShapeOption.textContent = "Default (Circle/Triangle)";
    shapeSelectEl.appendChild(defaultShapeOption);

    let retainSelection = false;
    let retainShapeSelection = false;

    info.forEach(column => {
      // Color Option
      const option = document.createElement("option");
      option.value = column.name;
      option.textContent = column.name;
      if (column.name === previous) {
        option.selected = true;
        retainSelection = true;
      }
      selectEl.appendChild(option);

      // Shape Option
      const shapeOption = document.createElement("option");
      shapeOption.value = column.name;
      shapeOption.textContent = column.name;
      if (column.name === previousShape) {
        shapeOption.selected = true;
        retainShapeSelection = true;
      }
      shapeSelectEl.appendChild(shapeOption);
    });

    // Handle Color Selection State
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

    // Handle Shape Selection State
    if (retainShapeSelection && previousShape) {
      modalState.activeShapeColumn = previousShape;
      renderShapeList(previousShape);
      applyCurrentShapeScheme();
    } else {
      modalState.activeShapeColumn = null;
      shapeSelectEl.value = "";
      renderShapeList(null);
      if (hadPreviousShape) {
        applyCurrentShapeScheme();
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

  function handleShapeColumnChange() {
    const value = shapeSelectEl.value;
    modalState.activeShapeColumn = value || null;
    renderShapeList(modalState.activeShapeColumn);
    applyCurrentShapeScheme();
  }

  function handleShapeSelect(event) {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.dataset.role !== "marker-shape-select") return;
    if (!modalState.activeShapeColumn) return;
    
    const key = target.dataset.valueKey ?? "";
    const value = target.value;
    
    const shapes = modalState.columnShapes.get(modalState.activeShapeColumn) || {};
    shapes[key] = value;
    modalState.columnShapes.set(modalState.activeShapeColumn, shapes);
    
    applyCurrentShapeScheme();
  }

  function handleResetClick(event) {
    const trigger = event.target instanceof Element ? event.target.closest('[data-role="marker-reset"]') : null;
    const shapeTrigger = event.target instanceof Element ? event.target.closest('[data-role="marker-shape-reset"]') : null;
    
    if (trigger) {
        event.preventDefault();
        if (!modalState.activeColumn) return;
        const columnInfo = modalState.columns.find(col => col.name === modalState.activeColumn);
        if (!columnInfo) return;

        const palette = generateDistinctHexColors(columnInfo.values.length);
        const resetMap = {};
        columnInfo.values.forEach((value, index) => {
          resetMap[value.key] = palette[index % palette.length] || modalState.defaultBaseColor;
        });
        modalState.columnColors.set(columnInfo.name, resetMap);
        renderColorList(columnInfo.name);
        applyCurrentScheme();
    } else if (shapeTrigger) {
        event.preventDefault();
        if (!modalState.activeShapeColumn) return;
        const columnInfo = modalState.columns.find(col => col.name === modalState.activeShapeColumn);
        if (!columnInfo) return;

        const resetMap = {};
        let shapeIndex = 0;
        columnInfo.values.forEach((value) => {
          resetMap[value.key] = AVAILABLE_SHAPES[shapeIndex % AVAILABLE_SHAPES.length].value;
          shapeIndex++;
        });
        modalState.columnShapes.set(columnInfo.name, resetMap);
        renderShapeList(columnInfo.name);
        applyCurrentShapeScheme();
    }
  }

  selectEl.addEventListener("change", handleColumnChange);
  shapeSelectEl.addEventListener("change", handleShapeColumnChange);
  
  panelEl.addEventListener("input", handleColorInput);
  panelEl.addEventListener("change", (e) => {
      if (e.target.dataset.role === "marker-shape-select") {
          handleShapeSelect(e);
      }
  });
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
    const isShiftM =
      event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      (event.key === "M" || event.key === "m");

    if (isShiftM) {
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
