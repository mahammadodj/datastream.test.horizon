const map = L.map(
	'onemap-map',{
		center: [40.21838483721167, 51.07054395510173],
		...{
			"zoom": 14,
			"zoomControl": false,
			"preferCanvas": false,
			"attributionControl": 0,
		}
	}
);

// add defaults for recenter use
window._efsDefaultCenter = L.latLng(40.21838483721167, 51.07054395510173);
window._efsDefaultZoom = 14;

// NEW: Add tile data
var fieldContours = L.tileLayer('/tile/{z}/{x}/{y}.png', {
	tms: true,
	opacity: 1.0,
	minZoom: 10,
    minNativeZoom: 14,
	maxZoom: 18,
	noWrap: true,
	attribution: '© Azneft IB',
    className: 'field-contours-layer', // Add class for CSS targeting
    bounds: [[40.18237971314974, 51.01761966086437], [40.25439042443973, 51.12346843969878]]
});

// NEW: Simple Animated Particle Layer for Wind/Waves
L.ParticleLayer = L.Layer.extend({
    options: {
        color: 'rgba(100, 150, 255, 0.8)',
        velocityScale: 1,
        particles: 800
    },

    initialize: function(options) {
        L.setOptions(this, options);
        this._particles = [];
        this._weatherSpeed = null;
        this._weatherDir = null;
    },

    setWeather: function(speed, direction) {
        this._weatherSpeed = speed;
        this._weatherDir = direction;
    },

    onAdd: function(map) {
        this._map = map;
        this._canvas = L.DomUtil.create('canvas', 'particle-overlay');
        this._canvas.style.position = 'absolute';
        this._canvas.style.pointerEvents = 'none';
        this._canvas.style.zIndex = 500; // Below markers but above tiles
        map.getPanes().overlayPane.appendChild(this._canvas);
        
        this._resize();
        map.on('resize', this._resize, this);
        map.on('moveend', this._reset, this);
        map.on('zoomend', this._reset, this);
        
        this._initParticles();
        this._animate();
    },

    onRemove: function(map) {
        map.getPanes().overlayPane.removeChild(this._canvas);
        map.off('resize', this._resize, this);
        map.off('moveend', this._reset, this);
        map.off('zoomend', this._reset, this);
        if (this._animId) cancelAnimationFrame(this._animId);
    },

    _resize: function() {
        var size = this._map.getSize();
        this._canvas.width = size.x;
        this._canvas.height = size.y;
        var pos = this._map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(this._canvas, pos);
    },

    _reset: function() {
        this._resize();
        this._initParticles();
    },

    _initParticles: function() {
        this._particles = [];
        var w = this._canvas.width;
        var h = this._canvas.height;
        for (var i = 0; i < this.options.particles; i++) {
            this._particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                age: Math.random() * 100
            });
        }
    },

    _animate: function() {
        if (!this._map) return;
        var ctx = this._canvas.getContext('2d');
        
        // Fade out trails
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
        
        // Draw new positions
        ctx.globalCompositeOperation = 'source-over';
        
        // Adjust color based on theme if needed, or use option
        var isDark = document.body.classList.contains('dark-theme');
        ctx.strokeStyle = isDark ? 'rgba(200, 230, 255, 0.8)' : (this.options.darkColor || this.options.color);
        ctx.lineWidth = 1.5;
        
        var w = this._canvas.width;
        var h = this._canvas.height;
        
        ctx.beginPath();
        for (var i = 0; i < this._particles.length; i++) {
            var p = this._particles[i];
            var oldX = p.x;
            var oldY = p.y;
            
            var angle, speed;

            if (this._weatherSpeed !== null && this._weatherDir !== null) {
                // Real data mode
                // Convert Meteo Direction (FROM, 0=N, CW) to Canvas Flow (TO, 0=E, CW)
                // Canvas Angle = (MeteoDir - 270) degrees
                var flowAngle = (this._weatherDir - 270) * (Math.PI / 180);
                
                // Add slight noise for particle effect
                var noise = (Math.cos(p.x * 0.002) + Math.sin(p.y * 0.002));
                angle = flowAngle + noise * 0.2;
                
                // Scale speed (heuristic)
                speed = this._weatherSpeed * 0.15 * this.options.velocityScale;
                if (speed < 0.5) speed = 0.5;
            } else {
                // Mock Vector Field: Perlin-ish noise based on position
                // Scale coords to make pattern larger
                var scale = 0.002;
                angle = (Math.cos(p.x * scale) + Math.sin(p.y * scale)) * Math.PI;
                
                // Add some flow direction based on layer type
                if (this.options.type === 'wind') {
                    angle += 0.5; // General wind direction
                } else {
                    angle -= 0.5; // Wave direction
                }
                speed = 2 * this.options.velocityScale;
            }
            
            p.x += Math.cos(angle) * speed;
            p.y += Math.sin(angle) * speed;
            p.age++;
            
            if (p.age > 100 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
                p.x = Math.random() * w;
                p.y = Math.random() * h;
                p.age = 0;
                oldX = p.x;
                oldY = p.y;
            }
            
            ctx.moveTo(oldX, oldY);
            ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        
        this._animId = requestAnimationFrame(this._animate.bind(this));
    }
});

// Define base maps
const basemaps = {
    "Standard": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }),
    "Satellite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
        maxNativeZoom: 10 // Reduced to 10 to ensure visibility of offshore structures
    }),
    "Dark Mode": L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }),
    "Light Mode": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }),
    "Ocean / Bathymetry": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Tiles &copy; Esri &mdash; Source: GEBCO, NOAA, CHS, OSU, UNH, CSUMB, National Geographic, DeLorme, NAVTEQ, and Esri',
        maxZoom: 19,
        maxNativeZoom: 10 // Reduced to 10 to prevent "Map data not available" errors in open ocean
    })
};

// NEW: Define Overlays
const windLayer = new L.ParticleLayer({ type: 'wind', color: 'rgba(100, 150, 255, 0.8)', darkColor: 'rgba(0, 102, 204, 0.8)' });
const waveLayer = new L.ParticleLayer({ type: 'wave', color: 'rgba(0, 255, 200, 0.8)', darkColor: 'rgba(0, 153, 153, 0.8)', velocityScale: 0.8 });

const overlays = {
    "Field Contours": fieldContours,
    "Wind Speed/Direction": windLayer,
    "Wave Height": waveLayer
};

// Add default layer
basemaps["Standard"].addTo(map);
fieldContours.addTo(map); // Ensure it is added on top of the base map

// Add Layers Control
L.control.layers(basemaps, overlays, { position: 'topright' }).addTo(map);

// Handle theme switching
map.on('baselayerchange', function(e) {
    if (e.name === "Dark Mode" || e.name === "Satellite") {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    if (typeof updateChartTheme === 'function') updateChartTheme();
    if (typeof updateTableTheme === 'function') updateTableTheme();
    if (typeof updateDashboardTheme === 'function') updateDashboardTheme();
});

var filter_sidebar = L.control.sidebar('onemap-sidebar-filter', {
	position: 'left',
	autoPan: true,
	closeButton: false, // Disable default close button to use tab icon instead
    maxWidth: 500       // NEW: Limit filter sidebar width
}).addTo(map);

filter_sidebar.show();

// NEW: Right Sidebar for Details
const detailsContainer = document.createElement('div');
detailsContainer.id = 'onemap-sidebar-details';
detailsContainer.innerHTML = `
    <div style="padding: 0 0 20px 24px; height: 100%; display: flex; flex-direction: column; overflow-y: auto;">
        <h2 id="details-well-name" style="margin-top: 2px;">Well Details</h2>
        <div id="details-controls" style="margin-bottom: 10px; display: flex; gap: 10px; flex-wrap: wrap;"></div>
        <div id="details-chart-container" class="chart-dashboard-frame" style="position: relative; height: 300px; width: 100%; flex-shrink: 0; margin-bottom: 20px;">
            <div id="chart-placeholder" class="chart-placeholder-text" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;">Select a well for rate analysis</div>
            <canvas id="productionChart"></canvas>
            <button id="details-time-btn" class="chart-action-btn" style="position: absolute; bottom: 4px; left: 4px; z-index: 10; font-size: 11px; padding: 2px 6px;">Time ⚙</button>
        </div>

        <div id="extra-charts-area" style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 20px;"></div>

        <div id="add-plot-btn" style="
            border: 3px dashed #e0e0e0; 
            border-radius: 4px; 
            height: 300px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            cursor: pointer; 
            color: #999; 
            font-size: 14px;
            flex-shrink: 0;
            background: #fafafa;
            transition: all 0.2s;
        ">
            Click to add plot
        </div>

        <div id="details-loading" style="display:none; text-align: center; padding: 20px;">Loading data...</div>
        <div id="details-error" style="color: red; display:none; text-align: center; padding: 20px;"></div>
    </div>
`;
const mapContent = document.getElementById('map-content');
if (mapContent) {
    mapContent.appendChild(detailsContainer);
} else {
    document.body.appendChild(detailsContainer);
}

// NEW: Add Plot Button Interactions
const addPlotBtn = document.getElementById('add-plot-btn');
addPlotBtn.addEventListener('mouseover', () => {
    const isDark = document.body.classList.contains('dark-theme');
    addPlotBtn.style.borderColor = isDark ? '#666' : '#ccc';
    addPlotBtn.style.color = isDark ? '#aaa' : '#666';
    addPlotBtn.style.background = isDark ? '#333' : '#f0f0f0';
});
addPlotBtn.addEventListener('mouseout', () => {
    const isDark = document.body.classList.contains('dark-theme');
    addPlotBtn.style.borderColor = isDark ? '#444' : '#e0e0e0';
    addPlotBtn.style.color = isDark ? '#888' : '#999';
    addPlotBtn.style.background = isDark ? '#2b2b2b' : '#fafafa';
});
// Click handler will be assigned in showWellDetails where data is available

// Handle Time Config Button click
document.getElementById('details-time-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (productionChart) showAxisConfig(productionChart, 'x', e);
});

var details_sidebar = L.control.sidebar('onemap-sidebar-details', {
    position: 'right',
    autoPan: false,
    closeButton: true,
    tabText: 'Details',
    maxWidth: 900       // NEW: Increased width limit
}).addTo(map);

// NEW: Bottom Sidebar for Analysis
const bottomContainer = document.createElement('div');
bottomContainer.id = 'onemap-sidebar-bottom';
bottomContainer.innerHTML = `
    <div style="padding: 10px; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-shrink: 0;">
            <h3 style="margin: 0;">Analysis - Rates Data</h3>
            <div style="display: flex; gap: 10px; align-items: center;">
                <span id="rates-status" style="font-size: 12px; color: #666;"></span>
                <button id="btn-columns" class="btn btn-secondary btn-sm" style="font-size: 12px;">Columns</button>
                <button id="btn-save-rates" class="btn btn-success btn-sm" style="font-size: 12px; display: none;">Save Changes</button>
                <button id="btn-refresh-rates" class="btn btn-primary btn-sm" style="font-size: 12px;">Refresh</button>
            </div>
        </div>

        <!-- Formula Builder Removed -->
        
        <div id="rates-table-wrapper" style="flex: 1; overflow: auto; border: 1px solid #ddd; border-radius: 4px; background: white;">
            <table class="table table-striped table-hover table-sm" style="margin: 0; font-size: 11px; width: 100%;">
                <thead style="position: sticky; top: 0; background: #f8f9fa; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                    <tr id="rates-table-header">
                        <th style="padding: 8px;">No data loaded</th>
                    </tr>
                </thead>
                <tbody id="rates-table-body"></tbody>
            </table>
        </div>

        <div id="rates-pagination" style="margin-top: 10px; display: flex; gap: 10px; align-items: center; justify-content: center; flex-shrink: 0; display: none;">
            <button id="btn-prev-page" class="btn btn-secondary btn-sm" style="font-size: 11px;" disabled>Previous</button>
            <span id="page-info" style="font-size: 12px;">Page 1</span>
            <button id="btn-next-page" class="btn btn-secondary btn-sm" style="font-size: 11px;">Next</button>
            <select id="rows-per-page" style="margin-left: 10px; font-size: 11px; padding: 2px;">
                <option value="50">50 rows</option>
                <option value="100" selected>100 rows</option>
                <option value="500">500 rows</option>
            </select>
        </div>
    </div>
`;
const mapContentForBottom = document.getElementById('map-content');
if (mapContentForBottom) {
    mapContentForBottom.appendChild(bottomContainer);
} else {
    document.body.appendChild(bottomContainer);
}

// Analysis Data Logic
let allRatesData = [];
let userFormulas = []; // Store user defined formulas: { name, formula }
let hiddenColumns = new Set(); // Store hidden column names
let filteredRatesData = [];
let activeFilters = {};
let currentSort = { col: null, dir: 'asc' };
let currentPage = 1;
let rowsPerPage = 100;
let pendingChanges = {}; // Key: "well|date", Value: { well, date, ...updates }

// NEW: Inject Dark Theme Styles for Table
const injectDarkTableStyles = () => {
    if (document.getElementById('dark-table-styles')) return;
    const style = document.createElement('style');
    style.id = 'dark-table-styles';
    style.textContent = `
        .dark-theme #rates-table-wrapper {
            background-color: #2b2b2b;
            border-color: #444;
        }
        .dark-theme .table {
            color: #eee;
            border-color: #444;
            --bs-table-bg: #2b2b2b;
            --bs-table-striped-bg: #323232;
            --bs-table-striped-color: #eee;
            --bs-table-hover-bg: #444;
            --bs-table-hover-color: #fff;
        }
        .dark-theme .table > :not(caption) > * > * {
            background-color: #2b2b2b !important;
            color: #eee !important;
            border-color: #444 !important;
        }
        .dark-theme .table-striped > tbody > tr:nth-of-type(odd) > * {
            background-color: #323232 !important;
            color: #eee !important;
            box-shadow: none !important;
        }
        .dark-theme .table-hover > tbody > tr:hover > * {
            background-color: #444 !important;
            color: #fff !important;
        }
        .dark-theme .table td.read-only {
            background-color: transparent !important;
            color: #aaa !important;
        }
        .dark-theme .table tr.modified > * {
            background-color: #4a4a20 !important;
        }
        /* Light theme overrides for specific classes */
        .table td.read-only {
            background-color: #f9f9f9;
            color: #666;
        }
        .table tr.modified > * {
            background-color: #fff3cd;
        }
        /* Selection Styles */
        .table td.selected-cell {
            background-color: rgba(0, 117, 255, 0.2) !important;
            border: 1px solid #0075ff !important;
        }
        .dark-theme .table td.selected-cell {
            background-color: rgba(0, 117, 255, 0.3) !important;
            border: 1px solid #66b0ff !important;
        }
    `;
    document.head.appendChild(style);
};
injectDarkTableStyles();

// Selection Logic Variables
let isSelecting = false;
let selectionStart = null; // { row: index, col: index }
let selectionEnd = null;   // { row: index, col: index }

function enableTableSelection() {
    const table = document.querySelector('#rates-table-wrapper table');
    if (!table) return;

    const tbody = document.getElementById('rates-table-body');

    // Helper to get cell coordinates
    const getCoords = (cell) => {
        const row = cell.parentElement.rowIndex - 1; // Adjust for header
        const col = cell.cellIndex;
        return { row, col };
    };

    // Helper to clear selection
    const clearSelection = () => {
        const selected = tbody.querySelectorAll('.selected-cell');
        selected.forEach(cell => cell.classList.remove('selected-cell'));
        selectionStart = null;
        selectionEnd = null;
    };

    // Helper to update selection visual
    const updateSelection = () => {
        if (!selectionStart || !selectionEnd) return;
        
        const minRow = Math.min(selectionStart.row, selectionEnd.row);
        const maxRow = Math.max(selectionStart.row, selectionEnd.row);
        const minCol = Math.min(selectionStart.col, selectionEnd.col);
        const maxCol = Math.max(selectionStart.col, selectionEnd.col);

        const rows = tbody.rows;
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].cells;
            for (let j = 0; j < cells.length; j++) {
                const cell = cells[j];
                if (i >= minRow && i <= maxRow && j >= minCol && j <= maxCol) {
                    cell.classList.add('selected-cell');
                } else {
                    cell.classList.remove('selected-cell');
                }
            }
        }
    };

    tbody.addEventListener('mousedown', (e) => {
        const cell = e.target.closest('td');
        if (!cell) return;
        
        // Left click only
        if (e.button !== 0) return;

        // If cell is currently being edited, don't start row/col selection
        if (cell.isContentEditable) return;

        isSelecting = true;
        clearSelection();
        selectionStart = getCoords(cell);
        selectionEnd = selectionStart;
        updateSelection();
        
        // Prevent text selection
        e.preventDefault();
    });

    tbody.addEventListener('mouseover', (e) => {
        if (!isSelecting) return;
        const cell = e.target.closest('td');
        if (!cell) return;

        selectionEnd = getCoords(cell);
        updateSelection();
    });

    document.addEventListener('mouseup', () => {
        isSelecting = false;
    });

    // Copy Handler
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            if (!selectionStart || !selectionEnd) return;
            
            // Check if focus is not in an input
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

            e.preventDefault();
            
            const minRow = Math.min(selectionStart.row, selectionEnd.row);
            const maxRow = Math.max(selectionStart.row, selectionEnd.row);
            const minCol = Math.min(selectionStart.col, selectionEnd.col);
            const maxCol = Math.max(selectionStart.col, selectionEnd.col);

            let csv = '';
            const rows = tbody.rows;
            
            for (let i = minRow; i <= maxRow; i++) {
                let rowStr = [];
                const cells = rows[i].cells;
                for (let j = minCol; j <= maxCol; j++) {
                    rowStr.push(cells[j].innerText);
                }
                csv += rowStr.join('\t') + '\n';
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(csv).then(() => {
                    // Visual feedback?
                    const status = document.getElementById('rates-status');
                    if (status) {
                        status.textContent = 'Copied to clipboard!';
                        setTimeout(() => status.textContent = '', 2000);
                    }
                });
            }
        }
    });
}

// Call this once
document.addEventListener('DOMContentLoaded', enableTableSelection);

function renderRatesTable() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredRatesData.slice(start, end);
    
    const tbody = document.getElementById('rates-table-body');
    tbody.innerHTML = '';
    
    if (pageData.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = Object.keys(allRatesData[0] || {}).length || 1;
        td.textContent = 'No matching records found';
        td.style.textAlign = 'center';
        td.style.padding = '20px';
        tr.appendChild(td);
        tbody.appendChild(tr);
        
        // Update Pagination UI for empty state
        document.getElementById('page-info').textContent = `Page 0 of 0 (0 rows)`;
        document.getElementById('btn-prev-page').disabled = true;
        document.getElementById('btn-next-page').disabled = true;
        return;
    }

    // Render Rows
    const columns = Object.keys(allRatesData[0]).filter(col => !hiddenColumns.has(col));
    
    pageData.forEach(row => {
        const tr = document.createElement('tr');
        const rowKey = `${row.well}|${row.date}`;
        
        // Check if this row has pending changes
        const hasChanges = pendingChanges[rowKey];
        if (hasChanges) {
            tr.classList.add('modified');
        }

        columns.forEach(col => {
            const td = document.createElement('td');
            td.dataset.col = col; // Store column name for context menu
            // Use pending value if exists, else original
            let displayValue = hasChanges && hasChanges[col] !== undefined ? hasChanges[col] : row[col];
            td.textContent = displayValue !== null ? displayValue : '';
            td.style.whiteSpace = 'nowrap';
            
            // Make editable (except well and date which are keys)
            if (col !== 'well' && col !== 'date') {
                // Double click to edit
                td.ondblclick = function() {
                    td.contentEditable = true;
                    td.focus();
                };
                
                td.onblur = function() {
                    td.contentEditable = false;
                    const newValue = td.textContent;
                    const originalValue = row[col];
                    
                    // Simple change detection
                    if (newValue != originalValue) {
                        if (!pendingChanges[rowKey]) {
                            pendingChanges[rowKey] = { well: row.well, date: row.date };
                        }
                        pendingChanges[rowKey][col] = newValue;
                        tr.classList.add('modified');
                        document.getElementById('btn-save-rates').style.display = 'inline-block';
                    }
                };
                // Prevent newlines
                td.onkeydown = function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        td.blur();
                    }
                };
            } else {
                td.classList.add('read-only');
            }
            
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // Update Pagination UI
    const totalPages = Math.ceil(filteredRatesData.length / rowsPerPage);
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages} (${filteredRatesData.length} rows)`;
    document.getElementById('btn-prev-page').disabled = currentPage === 1;
    document.getElementById('btn-next-page').disabled = currentPage === totalPages;
}

function setupAnalysisTab() {
    const refreshBtn = document.getElementById('btn-refresh-rates');
    const columnsBtn = document.getElementById('btn-columns');
    const saveBtn = document.getElementById('btn-save-rates');
    const statusSpan = document.getElementById('rates-status');
    const prevBtn = document.getElementById('btn-prev-page');
    const nextBtn = document.getElementById('btn-next-page');
    const rowsSelect = document.getElementById('rows-per-page');
    const paginationDiv = document.getElementById('rates-pagination');

    // NEW: Columns Visibility Modal
    columnsBtn.onclick = () => {
        if (!allRatesData.length) return;
        
        const isDark = document.body.classList.contains('dark-theme');
        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '10001', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
        });

        const content = document.createElement('div');
        Object.assign(content.style, {
            backgroundColor: isDark ? '#333' : 'white', padding: '20px', borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)', width: '300px', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column', color: isDark ? '#eee' : '#333'
        });

        const title = document.createElement('h3');
        title.textContent = 'Show/Hide Columns';
        title.style.marginTop = '0';
        content.appendChild(title);

        const list = document.createElement('div');
        list.style.flex = '1';
        list.style.overflowY = 'auto';
        list.style.marginBottom = '15px';

        Object.keys(allRatesData[0]).forEach(col => {
            const row = document.createElement('div');
            row.style.padding = '5px 0';
            
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = !hiddenColumns.has(col);
            cb.id = `col-vis-${col}`;
            
            const lbl = document.createElement('label');
            lbl.htmlFor = `col-vis-${col}`;
            lbl.textContent = col;
            lbl.style.marginLeft = '8px';
            
            cb.onchange = () => {
                if (cb.checked) hiddenColumns.delete(col);
                else hiddenColumns.add(col);
            };
            
            row.appendChild(cb);
            row.appendChild(lbl);
            list.appendChild(row);
        });
        content.appendChild(list);

        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close & Apply';
        closeBtn.style.padding = '5px 10px';
        closeBtn.onclick = () => {
            document.body.removeChild(modal);
            buildTableHeaders();
            renderRatesTable();
        };
        content.appendChild(closeBtn);

        modal.appendChild(content);
        document.body.appendChild(modal);
    };

    // NEW: Table Context Menu
    const tableWrapper = document.getElementById('rates-table-wrapper');
    if (tableWrapper) {
        tableWrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.closeAllChartMenus) window.closeAllChartMenus();

            // Identify clicked column
            let target = e.target;
            let colName = null;
            while (target && target !== tableWrapper) {
                if (target.tagName === 'TD' || target.tagName === 'TH') {
                    colName = target.dataset.col;
                    break;
                }
                target = target.parentElement;
            }

            let tableMenu = document.getElementById('table-context-menu');
            // Recreate menu every time to handle dynamic items
            if (tableMenu) tableMenu.remove();
            
            const isDark = document.body.classList.contains('dark-theme');
            tableMenu = document.createElement('div');
            tableMenu.id = 'table-context-menu';
            Object.assign(tableMenu.style, {
                display: 'none', position: 'fixed', zIndex: '10000',
                backgroundColor: isDark ? '#333' : 'white', 
                border: isDark ? '1px solid #555' : '1px solid #ccc',
                boxShadow: '2px 2px 5px rgba(0,0,0,0.2)', borderRadius: '4px',
                padding: '5px 0', minWidth: '160px', fontFamily: 'Arial, sans-serif', fontSize: '13px',
                color: isDark ? '#eee' : '#333'
            });
            
            const createItem = (text, icon, onClick) => {
                const item = document.createElement('div');
                Object.assign(item.style, {
                    padding: '8px 15px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', gap: '8px', color: isDark ? '#eee' : '#333'
                });
                item.innerHTML = `<span style="width:16px;text-align:center;">${icon}</span> ${text}`;
                item.onmouseover = () => item.style.backgroundColor = isDark ? '#444' : '#f0f0f0';
                item.onmouseout = () => item.style.backgroundColor = isDark ? '#333' : 'white';
                item.onclick = () => {
                    tableMenu.style.display = 'none';
                    onClick();
                };
                return item;
            };

            tableMenu.appendChild(createItem('Add new formula', 'ƒ', () => {
                if (window.showFormulaModal) window.showFormulaModal();
            }));

            if (colName) {
                // Hide Column Option
                tableMenu.appendChild(createItem(`Hide column '${colName}'`, '👁️', () => {
                    hiddenColumns.add(colName);
                    buildTableHeaders();
                    renderRatesTable();
                }));

                // Delete Custom Column Option
                const isCustom = userFormulas.some(f => f.name === colName);
                if (isCustom) {
                    tableMenu.appendChild(createItem(`Delete column '${colName}'`, '🗑️', () => {
                        if (confirm(`Are you sure you want to delete column "${colName}"?`)) {
                            // Remove from data
                            allRatesData.forEach(row => delete row[colName]);
                            // Remove from formulas
                            const idx = userFormulas.findIndex(f => f.name === colName);
                            if (idx > -1) userFormulas.splice(idx, 1);
                            // Remove from hidden set if there
                            hiddenColumns.delete(colName);
                            
                            buildTableHeaders();
                            applyFiltersAndSort();
                        }
                    }));
                }
            }
            
            document.body.appendChild(tableMenu);
            
            tableMenu.style.left = `${e.clientX}px`;
            tableMenu.style.top = `${e.clientY}px`;
            tableMenu.style.display = 'block';

            const closeMenu = (event) => {
                if (tableMenu && !tableMenu.contains(event.target)) {
                    tableMenu.remove();
                    document.removeEventListener('mousedown', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('mousedown', closeMenu), 0);
        });
    }

    const updateSortIcons = () => {
        if (!allRatesData.length) return;
        Object.keys(allRatesData[0]).forEach(col => {
            const icon = document.getElementById(`sort-icon-${col}`);
            if (icon) {
                if (currentSort.col === col) {
                    icon.textContent = currentSort.dir === 'asc' ? ' ▲' : ' ▼';
                    icon.style.color = '#333';
                    icon.style.opacity = '1';
                } else {
                    icon.textContent = ' ↕';
                    icon.style.color = '#ccc';
                    icon.style.opacity = '0.5';
                }
            }
        });
    };

    const applyFiltersAndSort = () => {
        // 1. Filter
        let result = allRatesData.filter(row => {
            return Object.entries(activeFilters).every(([key, value]) => {
                if (!value) return true;
                const rowValue = String(row[key] || '').toLowerCase();
                return rowValue.includes(value.toLowerCase());
            });
        });

        // 2. Sort
        if (currentSort.col) {
            result.sort((a, b) => {
                let valA = a[currentSort.col];
                let valB = b[currentSort.col];
                
                // Try numeric sort
                const numA = parseFloat(valA);
                const numB = parseFloat(valB);
                if (!isNaN(numA) && !isNaN(numB)) {
                    valA = numA;
                    valB = numB;
                } else {
                    valA = String(valA || '').toLowerCase();
                    valB = String(valB || '').toLowerCase();
                }

                if (valA < valB) return currentSort.dir === 'asc' ? -1 : 1;
                if (valA > valB) return currentSort.dir === 'asc' ? 1 : -1;
                return 0;
            });
        }

        filteredRatesData = result;
        currentPage = 1;
        renderRatesTable();
        updateSortIcons();
    };

    const buildTableHeaders = () => {
        const theadTr = document.getElementById('rates-table-header');
        theadTr.innerHTML = '';
        if (!allRatesData.length) return;

        // Helper to detect type
        const detectType = (col) => {
            for (let i = 0; i < Math.min(allRatesData.length, 50); i++) {
                const val = allRatesData[i][col];
                if (val === null || val === undefined || val === '') continue;
                if (typeof val === 'number') return 'Numeric';
                if (!isNaN(parseFloat(val)) && isFinite(val)) return 'Numeric';
                // Simple date check (DD.MM.YYYY or YYYY-MM-DD)
                if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(val) || /^\d{4}[./-]\d{1,2}[./-]\d{1,2}/.test(val)) return 'Date';
                return 'String';
            }
            return 'String';
        };

        Object.keys(allRatesData[0]).forEach(col => {
            if (hiddenColumns.has(col)) return;

            const th = document.createElement('th');
            th.dataset.col = col; // Store column name for context menu
            th.style.padding = '8px';
            th.style.verticalAlign = 'top';
            th.style.minWidth = '100px';
            
            // Header Container
            const headerDiv = document.createElement('div');
            headerDiv.style.display = 'flex';
            headerDiv.style.justifyContent = 'space-between';
            headerDiv.style.alignItems = 'center';
            headerDiv.style.marginBottom = '5px';

            // Title Container (Label + Type)
            const titleContainer = document.createElement('div');
            titleContainer.style.display = 'flex';
            titleContainer.style.flexDirection = 'column';

            // Label (Click to toggle filter)
            const label = document.createElement('span');
            label.textContent = col.charAt(0).toUpperCase() + col.slice(1);
            label.style.cursor = 'pointer';
            label.style.fontWeight = 'bold';
            label.title = 'Click to show/hide filter';

            // Type Label
            const typeLabel = document.createElement('span');
            typeLabel.textContent = `(${detectType(col)})`;
            typeLabel.style.fontSize = '9px';
            typeLabel.style.color = '#999';
            typeLabel.style.fontWeight = 'normal';
            
            titleContainer.appendChild(label);
            titleContainer.appendChild(typeLabel);
            
            // Icons Container
            const iconsContainer = document.createElement('div');
            iconsContainer.style.display = 'flex';
            iconsContainer.style.alignItems = 'center';
            iconsContainer.style.opacity = '0'; // Hide by default
            iconsContainer.style.transition = 'opacity 0.2s';

            // Show icons on hover
            th.onmouseenter = () => iconsContainer.style.opacity = '1';
            th.onmouseleave = () => iconsContainer.style.opacity = '0';

            // Copy Icon
            const copyIcon = document.createElement('span');
            copyIcon.innerHTML = '📋';
            copyIcon.style.cursor = 'pointer';
            copyIcon.style.marginLeft = '5px';
            copyIcon.style.fontSize = '12px';
            copyIcon.title = 'Copy column values';
            
            copyIcon.onclick = (e) => {
                e.stopPropagation();
                const values = filteredRatesData.map(row => {
                    const val = row[col];
                    return val === null || val === undefined ? '' : val;
                }).join('\n');
                
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(values).then(() => {
                        const originalHTML = copyIcon.innerHTML;
                        copyIcon.innerHTML = '✅';
                        setTimeout(() => copyIcon.innerHTML = originalHTML, 1000);
                    }).catch(err => {
                        console.error('Failed to copy: ', err);
                        alert('Failed to copy values');
                    });
                } else {
                    // Fallback
                    const textArea = document.createElement("textarea");
                    textArea.value = values;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        const originalHTML = copyIcon.innerHTML;
                        copyIcon.innerHTML = '✅';
                        setTimeout(() => copyIcon.innerHTML = originalHTML, 1000);
                    } catch (err) {
                        console.error('Fallback copy failed', err);
                        alert('Failed to copy values');
                    }
                    document.body.removeChild(textArea);
                }
            };

            // Sort Icon (Click to sort)
            const sortIcon = document.createElement('span');
            sortIcon.id = `sort-icon-${col}`;
            sortIcon.textContent = ' ↕';
            sortIcon.style.cursor = 'pointer';
            sortIcon.style.marginLeft = '5px';
            sortIcon.style.fontSize = '12px';
            sortIcon.style.color = '#ccc';
            sortIcon.title = 'Click to sort';

            iconsContainer.appendChild(copyIcon);
            iconsContainer.appendChild(sortIcon);

            // Input (Hidden by default)
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Filter...';
            input.style.width = '100%';
            input.style.fontSize = '10px';
            input.style.padding = '2px 4px';
            input.style.border = '1px solid #ccc';
            input.style.borderRadius = '3px';
            input.style.display = 'none'; // Hidden initially
            input.style.marginTop = '5px';
            
            // Events
            label.onclick = () => {
                const isHidden = input.style.display === 'none';
                input.style.display = isHidden ? 'block' : 'none';
                if (isHidden) input.focus();
            };

            sortIcon.onclick = (e) => {
                e.stopPropagation();
                if (currentSort.col === col) {
                    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.col = col;
                    currentSort.dir = 'asc';
                }
                applyFiltersAndSort();
            };

            input.oninput = (e) => {
                activeFilters[col] = e.target.value;
                applyFiltersAndSort();
            };

            // Assemble
            headerDiv.appendChild(titleContainer);
            headerDiv.appendChild(iconsContainer);
            th.appendChild(headerDiv);
            th.appendChild(input);
            theadTr.appendChild(th);
        });
    };

    const applyFormulaToData = (name, formula) => {
        if (!allRatesData.length) return;
        
        try {
            const keys = Object.keys(allRatesData[0]);
            const keyMap = {};
            keys.forEach(k => keyMap[k.toLowerCase()] = k);

            let parsedFormula = formula.replace(/[a-zA-Z_]\w*/g, (match) => {
                const lower = match.toLowerCase();
                if (keyMap.hasOwnProperty(lower)) {
                    const actualKey = keyMap[lower];
                    return `(parseFloat(row['${actualKey}']) || 0)`;
                }
                return match;
            });

            const evalFunc = new Function('row', `return ${parsedFormula};`);
            
            allRatesData.forEach(row => {
                try {
                    const val = evalFunc(row);
                    row[name] = typeof val === 'number' ? Math.round(val * 100) / 100 : val;
                } catch (e) {
                    row[name] = null;
                }
            });
        } catch (err) {
            console.error('Error applying formula:', err);
        }
    };

    const fetchData = async () => {
        refreshBtn.disabled = true;
        statusSpan.textContent = 'Fetching data...';
        pendingChanges = {}; // Clear changes on reload
        saveBtn.style.display = 'none';
        
        try {
            const res = await fetch('/rates');
            if (!res.ok) throw new Error('Failed to fetch rates');
            
            allRatesData = await res.json();
            
            // Re-apply user formulas
            userFormulas.forEach(f => {
                applyFormulaToData(f.name, f.formula);
            });
            
            if (allRatesData.length > 0) {
                filteredRatesData = [...allRatesData];
                buildTableHeaders();
                applyFiltersAndSort();
                
                statusSpan.textContent = `Loaded ${allRatesData.length} records`;
                paginationDiv.style.display = 'flex';
            } else {
                statusSpan.textContent = 'No data found';
            }
        } catch (err) {
            console.error(err);
            statusSpan.textContent = 'Error loading data';
            statusSpan.style.color = 'red';
        } finally {
            refreshBtn.disabled = false;
        }
    };

    // Add Column Logic
    window.showFormulaModal = function() {
        const isDark = document.body.classList.contains('dark-theme');
        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: '10001', display: 'flex',
            justifyContent: 'center', alignItems: 'center'
        });

        const content = document.createElement('div');
        Object.assign(content.style, {
            backgroundColor: isDark ? '#333' : 'white', padding: '20px', borderRadius: '5px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3)', width: '400px', color: isDark ? '#eee' : '#333',
            position: 'relative'
        });

        const title = document.createElement('h3');
        title.textContent = 'Add New Formula';
        title.style.marginTop = '0';

        const nameGroup = document.createElement('div');
        nameGroup.style.marginBottom = '15px';
        const nameLabel = document.createElement('label');
        nameLabel.textContent = 'Column Name:';
        nameLabel.style.display = 'block';
        nameLabel.style.marginBottom = '5px';
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.style.width = '100%';
        nameInput.style.padding = '5px';
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);

        const formulaGroup = document.createElement('div');
        formulaGroup.style.marginBottom = '15px';
        formulaGroup.style.position = 'relative'; // For absolute positioning of suggestions
        const formulaLabel = document.createElement('label');
        formulaLabel.textContent = 'Formula (type "/" to see parameters):';
        formulaLabel.style.display = 'block';
        formulaLabel.style.marginBottom = '5px';
        
        const formulaInput = document.createElement('div');
        formulaInput.contentEditable = true;
        Object.assign(formulaInput.style, {
            width: '100%', padding: '5px', border: '1px solid #ccc',
            backgroundColor: isDark ? '#2b2b2b' : 'white',
            color: isDark ? '#eee' : '#333', minHeight: '28px',
            borderRadius: '2px', whiteSpace: 'pre-wrap', overflow: 'hidden',
            display: 'inline-block', verticalAlign: 'bottom'
        });
        formulaInput.onfocus = () => formulaInput.style.outline = '2px solid #3498db';
        formulaInput.onblur = () => formulaInput.style.outline = 'none';

        formulaGroup.appendChild(formulaLabel);
        formulaGroup.appendChild(formulaInput);

        // Suggestions Box
        const suggestionsBox = document.createElement('div');
        Object.assign(suggestionsBox.style, {
            position: 'absolute', top: '100%', left: '0', width: '100%',
            maxHeight: '150px', overflowY: 'auto', backgroundColor: isDark ? '#444' : 'white',
            border: '1px solid #ccc', zIndex: '10002', display: 'none',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        });
        formulaGroup.appendChild(suggestionsBox);

        // Autocomplete Logic
        let activeSuggestionIndex = -1;

        const getAvailableParams = () => {
            if (allRatesData.length === 0) return [];
            return Object.keys(allRatesData[0]);
        };

        const showSuggestions = (query) => {
            const params = getAvailableParams();
            const matches = params.filter(p => p.toLowerCase().includes(query.toLowerCase()));
            
            suggestionsBox.innerHTML = '';
            activeSuggestionIndex = -1;

            if (matches.length === 0) {
                const noMatch = document.createElement('div');
                noMatch.textContent = 'No such parameter found';
                noMatch.style.padding = '5px 10px';
                noMatch.style.color = 'red';
                noMatch.style.fontStyle = 'italic';
                suggestionsBox.appendChild(noMatch);
            } else {
                matches.forEach((match, index) => {
                    const item = document.createElement('div');
                    item.textContent = match;
                    Object.assign(item.style, {
                        padding: '5px 10px', cursor: 'pointer',
                        backgroundColor: isDark ? '#444' : 'white',
                        color: isDark ? '#eee' : '#333'
                    });
                    
                    item.onmouseover = () => {
                        item.style.backgroundColor = isDark ? '#555' : '#f0f0f0';
                    };
                    item.onmouseout = () => {
                        item.style.backgroundColor = isDark ? '#444' : 'white';
                    };
                    
                    item.onmousedown = (e) => {
                        e.preventDefault(); // Prevent blur
                        insertParameter(match);
                    };
                    
                    suggestionsBox.appendChild(item);
                });
            }
            suggestionsBox.style.display = 'block';
        };

        const insertParameter = (param) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            
            if (textNode.nodeType === Node.TEXT_NODE) {
                const textBefore = textNode.textContent.substring(0, range.startOffset);
                const slashIndex = textBefore.lastIndexOf('/');
                
                if (slashIndex !== -1) {
                    range.setStart(textNode, slashIndex);
                    range.deleteContents();
                    
                    const span = document.createElement('span');
                    span.textContent = param;
                    span.style.color = '#2ecc71';
                    span.style.fontWeight = 'bold';
                    span.contentEditable = "false";
                    
                    range.insertNode(span);
                    
                    // Insert a non-breaking space after to ensure cursor has a place to be
                    const space = document.createTextNode('\u00A0');
                    range.setStartAfter(span);
                    range.setEndAfter(span);
                    range.insertNode(space);
                    
                    range.setStartAfter(space);
                    range.setEndAfter(space);
                    
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
            suggestionsBox.style.display = 'none';
            formulaInput.focus();
        };

        formulaInput.addEventListener('input', (e) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            
            if (textNode.nodeType === Node.TEXT_NODE) {
                const textBefore = textNode.textContent.substring(0, range.startOffset);
                const lastSlash = textBefore.lastIndexOf('/');
                
                if (lastSlash !== -1) {
                    const query = textBefore.substring(lastSlash + 1);
                    if (/^[a-zA-Z0-9_]*$/.test(query)) {
                        showSuggestions(query);
                        return;
                    }
                }
            }
            suggestionsBox.style.display = 'none';
        });

        formulaInput.addEventListener('keydown', (e) => {
            if (suggestionsBox.style.display === 'block') {
                const items = suggestionsBox.querySelectorAll('div');
                const isError = items.length === 1 && items[0].style.color === 'red';
                
                if (!isError && items.length > 0) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                        updateActiveItem(items);
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                        updateActiveItem(items);
                    } else if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        if (activeSuggestionIndex > -1) {
                            items[activeSuggestionIndex].onmousedown(e);
                        } else {
                            items[0].onmousedown(e);
                        }
                    } else if (e.key === 'Escape') {
                        suggestionsBox.style.display = 'none';
                    }
                }
            }
        });

        const updateActiveItem = (items) => {
            items.forEach((item, idx) => {
                if (idx === activeSuggestionIndex) {
                    item.style.backgroundColor = '#3498db';
                    item.style.color = 'white';
                } else {
                    item.style.backgroundColor = isDark ? '#444' : 'white';
                    item.style.color = isDark ? '#eee' : '#333';
                }
            });
            if (activeSuggestionIndex > -1) {
                items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
            }
        };

        // Hide on click outside
        document.addEventListener('click', (e) => {
            if (!formulaGroup.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        }, { capture: true });


        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.justifyContent = 'flex-end';
        btnGroup.style.gap = '10px';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => document.body.removeChild(modal);

        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.style.backgroundColor = '#3498db';
        addBtn.style.color = 'white';
        addBtn.style.border = 'none';
        addBtn.style.padding = '5px 15px';
        addBtn.style.borderRadius = '3px';
        addBtn.style.cursor = 'pointer';

        addBtn.onclick = () => {
            const name = nameInput.value.trim();
            const formula = formulaInput.textContent.replace(/\u00A0/g, ' ').trim();

            if (!name || !formula) {
                alert('Please enter both a column name and a formula.');
                return;
            }

            if (allRatesData.length === 0) {
                alert('No data available to calculate columns.');
                return;
            }

            if (allRatesData[0].hasOwnProperty(name)) {
                alert(`Column "${name}" already exists. Please choose a different name.`);
                return;
            }

            // Save formula for persistence
            const existingIdx = userFormulas.findIndex(f => f.name === name);
            if (existingIdx > -1) {
                userFormulas[existingIdx] = { name, formula };
            } else {
                userFormulas.push({ name, formula });
            }

            applyFormulaToData(name, formula);

            buildTableHeaders();
            applyFiltersAndSort();
            
            statusSpan.textContent = `Added column "${name}"`;
            statusSpan.style.color = 'blue';
            document.body.removeChild(modal);
        };

        btnGroup.appendChild(cancelBtn);
        btnGroup.appendChild(addBtn);

        content.appendChild(title);
        content.appendChild(nameGroup);
        content.appendChild(formulaGroup);
        content.appendChild(btnGroup);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        nameInput.focus();
    }

    refreshBtn.onclick = fetchData;

    saveBtn.onclick = async () => {
        const updates = Object.values(pendingChanges);
        if (updates.length === 0) return;

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const res = await fetch('/rates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });

            if (!res.ok) throw new Error('Failed to save changes');

            const result = await res.json();
            statusSpan.textContent = `Saved ${result.updated} records successfully`;
            statusSpan.style.color = 'green';
            
            // Reload data to reflect changes and clear pending state
            fetchData(); 
            
        } catch (err) {
            console.error(err);
            statusSpan.textContent = 'Error saving data';
            statusSpan.style.color = 'red';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Changes';
        }
    };

    // Auto-load data on startup
    fetchData();

    prevBtn.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderRatesTable();
            document.getElementById('rates-table-wrapper').scrollTop = 0;
        }
    };

    nextBtn.onclick = () => {
        const totalPages = Math.ceil(filteredRatesData.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderRatesTable();
            document.getElementById('rates-table-wrapper').scrollTop = 0;
        }
    };

    rowsSelect.onchange = (e) => {
        rowsPerPage = parseInt(e.target.value);
        currentPage = 1;
        renderRatesTable();
    };
}

// NEW: Analytical Dashboard Logic
function setupAnalyticalDashboard() {
    const dashboard = document.getElementById('dashboard-content');
    if (!dashboard) return;

    // Make dashboard a relative container for absolute positioning of charts
    dashboard.style.position = 'relative';
    dashboard.style.overflow = 'auto';
    // dashboard.style.backgroundColor = '#f5f5f5'; // Let theme handle background

    // Context Menu
    dashboard.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        if (window.closeAllChartMenus) window.closeAllChartMenus();

        // Remove existing menu
        const existingMenu = document.getElementById('dashboard-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'dashboard-context-menu';
        const isDark = document.body.classList.contains('dark-theme');
        
        Object.assign(menu.style, {
            position: 'fixed',
            left: `${e.clientX}px`,
            top: `${e.clientY}px`,
            backgroundColor: isDark ? '#333' : 'white',
            border: isDark ? '1px solid #555' : '1px solid #ccc',
            boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
            borderRadius: '4px',
            padding: '5px 0',
            zIndex: '10000',
            minWidth: '150px',
            color: isDark ? '#eee' : '#333',
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px'
        });

        const options = [
            { label: 'Pie Chart', type: 'pie', icon: '🥧' },
            { label: 'Scatter Plot', type: 'scatter', icon: '∴' },
            { label: 'Line Plot', type: 'line', icon: '📈' },
            { label: 'Area Chart', type: 'area', icon: '⛰️' },
            { label: 'Bar Plot', type: 'bar', icon: '📊' },
            { label: 'Box Plot', type: 'box', icon: '◰' },
            { label: 'Bubble Plot', type: 'bubble', icon: '🫧' },
            { label: 'Gantt Chart', type: 'gantt', icon: '📅' },
            { label: 'Tree Map', type: 'treemap', icon: '🔲' },
            { label: 'Radar Chart', type: 'radar', icon: '🕸️' },
            { label: 'Data Table', type: 'table', icon: '📋' },
            { label: 'Layout Container', type: 'container', icon: '📦' }
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '8px 15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            });
            item.innerHTML = `<span style="width:20px;text-align:center;">${opt.icon}</span> ${opt.label}`;
            
            item.onmouseover = () => item.style.backgroundColor = isDark ? '#444' : '#f0f0f0';
            item.onmouseout = () => item.style.backgroundColor = 'transparent';
            
            item.onclick = () => {
                // Calculate relative position in dashboard
                const rect = dashboard.getBoundingClientRect();
                const x = e.clientX - rect.left + dashboard.scrollLeft;
                const y = e.clientY - rect.top + dashboard.scrollTop;
                
                if (opt.type === 'container') {
                    createLayoutContainer(x, y);
                } else {
                    createDashboardChart(opt.type, x, y);
                }
                menu.remove();
            };
            
            menu.appendChild(item);
        });

        document.body.appendChild(menu);

        // Close on click outside
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    });

    // Add Theme Control Widget
    createDashboardThemeControl(dashboard);
    
    // Add Dashboard Controls (Remove All, etc.)
    createDashboardControls(dashboard);
}

function createDashboardControls(container) {
    const control = document.createElement('div');
    control.className = 'dashboard-controls';
    
    Object.assign(control.style, {
        position: 'absolute',
        top: '10px',
        left: '10px', // Position to the left to avoid overlap with theme control
        zIndex: '1000',
        display: 'flex',
        gap: '10px'
    });

    const clearBtn = document.createElement('button');
    clearBtn.id = 'dashboard-clear-btn';
    clearBtn.innerHTML = '🗑️ Remove All';
    clearBtn.title = 'Remove all plots from dashboard';
    Object.assign(clearBtn.style, {
        padding: '5px 10px',
        backgroundColor: '#fff',
        border: '2px solid rgba(0,0,0,0.2)',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#333',
        boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
        height: '34px', // Match theme control height approx
        display: 'none', // Initially hidden
        alignItems: 'center',
        gap: '5px'
    });
    
    clearBtn.onmouseover = () => clearBtn.style.backgroundColor = '#f0f0f0';
    clearBtn.onmouseout = () => clearBtn.style.backgroundColor = '#fff';

    clearBtn.onclick = () => {
        if(confirm('Are you sure you want to remove all plots?')) {
            const charts = container.querySelectorAll('.dashboard-chart-container, .dashboard-layout-container');
            charts.forEach(c => c.remove());
            updateDashboardControlsVisibility();
        }
    };

    control.appendChild(clearBtn);
    container.appendChild(control);
}

// Helper to toggle visibility of dashboard controls
function updateDashboardControlsVisibility() {
    const btn = document.getElementById('dashboard-clear-btn');
    const dashboard = document.getElementById('dashboard-content');
    if (btn && dashboard) {
        const hasCharts = dashboard.querySelectorAll('.dashboard-chart-container, .dashboard-layout-container').length > 0;
        btn.style.display = hasCharts ? 'flex' : 'none';
    }
}

function createDashboardThemeControl(container) {
    const control = document.createElement('div');
    control.className = 'dashboard-theme-control';
    
    // Style to mimic Leaflet Layers Control
    Object.assign(control.style, {
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: '1000',
        backgroundColor: '#fff',
        border: '2px solid rgba(0,0,0,0.2)',
        borderRadius: '5px',
        backgroundClip: 'padding-box',
        cursor: 'pointer',
        boxShadow: '0 1px 5px rgba(0,0,0,0.4)'
    });

    // Icon
    const icon = document.createElement('div');
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" style="margin:3px;"><path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z" fill="#333"/></svg>';
    Object.assign(icon.style, {
        width: '30px',
        height: '30px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    });
    control.appendChild(icon);

    // List
    const list = document.createElement('div');
    Object.assign(list.style, {
        display: 'none',
        padding: '10px',
        backgroundColor: '#fff',
        color: '#333',
        borderRadius: '5px',
        minWidth: '150px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px'
    });
    control.appendChild(list);

    // Hover behavior
    control.onmouseenter = () => {
        list.style.display = 'block';
        icon.style.display = 'none';
    };
    control.onmouseleave = () => {
        list.style.display = 'none';
        icon.style.display = 'flex';
    };

    // Populate themes
    const themes = ["Standard", "Satellite", "Dark Mode", "Light Mode", "Ocean / Bathymetry"];
    
    themes.forEach(name => {
        const row = document.createElement('div');
        Object.assign(row.style, {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '5px',
            cursor: 'pointer'
        });

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'dashboard_theme';
        radio.style.marginRight = '8px';
        
        // Set initial checked state
        if (document.body.classList.contains('dark-theme') && name === "Dark Mode") radio.checked = true;
        else if (!document.body.classList.contains('dark-theme') && name === "Standard") radio.checked = true;

        // Click handler
        const selectTheme = () => {
            if (typeof basemaps !== 'undefined' && typeof map !== 'undefined') {
                const layer = basemaps[name];
                if (layer) {
                    // Remove all existing basemaps
                    Object.values(basemaps).forEach(l => {
                        if (map.hasLayer(l)) map.removeLayer(l);
                    });
                    // Add selected
                    map.addLayer(layer);
                    // Trigger theme update
                    map.fire('baselayerchange', { layer: layer, name: name });
                    
                    // Update radio buttons in this control
                    const allRadios = list.querySelectorAll('input[type="radio"]');
                    allRadios.forEach(r => r.checked = false);
                    radio.checked = true;
                }
            }
        };

        radio.onclick = selectTheme;
        row.onclick = (e) => {
            if (e.target !== radio) {
                radio.checked = true;
                selectTheme();
            }
        };

        const label = document.createElement('span');
        label.innerText = name;

        row.appendChild(radio);
        row.appendChild(label);
        list.appendChild(row);
    });

    // Sync with map events
    if (typeof map !== 'undefined') {
        map.on('baselayerchange', (e) => {
            const radios = list.querySelectorAll('input[type="radio"]');
            radios.forEach(r => {
                if (r.nextSibling.innerText === e.name) {
                    r.checked = true;
                }
            });
        });
    }

    container.appendChild(control);
}

function createDashboardChart(type, x, y, parentElement = null) {
    const dashboard = document.getElementById('dashboard-content');
    const isDark = document.body.classList.contains('dark-theme');
    
    const colors = [
        'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)', 
        'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'
    ];
    const borders = [
        'rgba(255, 99, 132, 1)', 'rgba(54, 162, 235, 1)', 'rgba(255, 206, 86, 1)', 
        'rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'
    ];

    const container = document.createElement('div');
    container.className = 'dashboard-chart-container';
    
    if (parentElement) {
        // Flexbox child style
        Object.assign(container.style, {
            position: 'relative',
            flex: '0 0 auto', // Don't grow/shrink automatically to allow manual resizing
            width: '300px',
            height: '300px',
            backgroundColor: isDark ? '#2b2b2b' : 'white',
            border: isDark ? '1px solid #444' : '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            margin: '5px',
            resize: 'both',
            overflow: 'hidden'
        });
    } else {
        // Absolute positioning style (default)
        Object.assign(container.style, {
            position: 'absolute',
            left: `${x}px`,
            top: `${y}px`,
            width: '400px',
            height: '300px',
            backgroundColor: isDark ? '#2b2b2b' : 'white',
            border: isDark ? '1px solid #444' : '1px solid #ddd',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            padding: '10px',
            resize: 'both',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });
    }

    // Header with drag handle and close button
    const header = document.createElement('div');
    header.className = 'dashboard-chart-header';
    Object.assign(header.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '5px',
        cursor: parentElement ? 'default' : 'move', // No drag if in container
        borderBottom: isDark ? '1px solid #444' : '1px solid #eee',
        paddingBottom: '5px',
        color: isDark ? '#eee' : '#333'
    });
    
    const title = document.createElement('span');
    title.textContent = `${type.charAt(0).toUpperCase() + type.slice(1)} Chart`;
    Object.assign(title.style, {
        fontWeight: 'bold',
        fontSize: '12px',
        cursor: 'text',
        padding: '2px 5px',
        borderRadius: '3px',
        border: '1px solid transparent',
        minWidth: '50px',
        outline: 'none'
    });
    title.contentEditable = true;
    title.spellcheck = false;
    title.title = "Click to rename";

    // Prevent drag when editing title
    title.onmousedown = (e) => e.stopPropagation();
    
    // Visual feedback on hover/focus
    title.onmouseover = () => { if(document.activeElement !== title) title.style.border = '1px dashed #999'; };
    title.onmouseout = () => { if(document.activeElement !== title) title.style.border = '1px solid transparent'; };
    title.onfocus = () => { 
        title.style.border = '1px solid #0075ff'; 
        title.style.backgroundColor = isDark ? '#444' : '#fff';
        title.style.color = isDark ? '#fff' : '#000';
    };
    title.onblur = () => { 
        title.style.border = '1px solid transparent'; 
        title.style.backgroundColor = 'transparent';
        title.style.color = isDark ? '#eee' : '#333';
    };
    
    // Blur on Enter
    title.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            title.blur();
        }
    };
    
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '10px';
    controls.style.alignItems = 'center';

    // Add Event Button for Gantt
    if (type === 'gantt') {
        const addBtn = document.createElement('span');
        addBtn.innerHTML = '+';
        Object.assign(addBtn.style, {
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
            title: 'Add Event',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px'
        });
        
        addBtn.onclick = () => {
            const name = prompt("Enter event name:", "New Task");
            if (name) {
                const start = parseFloat(prompt("Enter start time:", "0"));
                const end = parseFloat(prompt("Enter end time:", "5"));
                if (!isNaN(start) && !isNaN(end)) {
                    const chart = Chart.getChart(canvas);
                    if (chart) {
                        chart.data.labels.push(name);
                        chart.data.datasets[0].data.push([start, end]);
                        const colorIndex = (chart.data.labels.length - 1) % colors.length;
                        if (Array.isArray(chart.data.datasets[0].backgroundColor)) {
                            chart.data.datasets[0].backgroundColor.push(colors[colorIndex]);
                        }
                        chart.update();
                    }
                }
            }
        };
        controls.appendChild(addBtn);
    }

    // Full View Button
    const fullBtn = document.createElement('span');
    fullBtn.innerHTML = '⤢';
    fullBtn.style.cursor = 'pointer';
    fullBtn.style.fontSize = '14px';
    fullBtn.title = 'Toggle Full View';
    
    let isFull = false;
    let originalStyles = {};

    fullBtn.onclick = () => {
        isFull = !isFull;
        if (isFull) {
            originalStyles = {
                position: container.style.position,
                left: container.style.left,
                top: container.style.top,
                width: container.style.width,
                height: container.style.height,
                zIndex: container.style.zIndex,
                margin: container.style.margin,
                flex: container.style.flex
            };
            Object.assign(container.style, {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100vw',
                height: '100vh',
                zIndex: '10000',
                margin: '0',
                flex: 'none'
            });
            fullBtn.innerHTML = '↙';
        } else {
            Object.assign(container.style, originalStyles);
            fullBtn.innerHTML = '⤢';
        }
        // Trigger resize for charts
        const canvas = container.querySelector('canvas');
        if (canvas) {
             const chart = Chart.getChart(canvas);
             if (chart) chart.resize();
        }
    };

    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '16px';
    closeBtn.onclick = () => container.remove();
    
    controls.appendChild(fullBtn);
    controls.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(controls);
    container.appendChild(header);

    // Canvas for Chart.js
    const canvasContainer = document.createElement('div');
    canvasContainer.style.flex = '1';
    canvasContainer.style.width = '100%';
    canvasContainer.style.position = 'relative';
    canvasContainer.style.minHeight = '0'; // Fix for flex shrinking

    // Handle Data Table
    if (type === 'table') {
        canvasContainer.style.overflow = 'auto';
        
        // Startup Screen
        const startupDiv = document.createElement('div');
        Object.assign(startupDiv.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '15px',
            color: isDark ? '#eee' : '#333',
            padding: '20px'
        });

        const msg = document.createElement('div');
        msg.innerText = "Choose data source:";
        msg.style.fontWeight = 'bold';
        
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '10px';

        const createBtn = document.createElement('button');
        createBtn.innerText = 'Default Table';
        Object.assign(createBtn.style, {
            padding: '8px 15px',
            cursor: 'pointer',
            backgroundColor: isDark ? '#444' : '#f0f0f0',
            border: '1px solid #888',
            borderRadius: '4px',
            color: isDark ? '#eee' : '#333'
        });
        
        const uploadBtn = document.createElement('button');
        uploadBtn.innerText = 'Import CSV/XLSX';
        Object.assign(uploadBtn.style, {
            padding: '8px 15px',
            cursor: 'pointer',
            backgroundColor: '#0075ff',
            border: '1px solid #005bb5',
            borderRadius: '4px',
            color: 'white'
        });

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.csv, .xlsx, .xls';
        fileInput.style.display = 'none';

        btnGroup.appendChild(createBtn);
        btnGroup.appendChild(uploadBtn);
        startupDiv.appendChild(msg);
        startupDiv.appendChild(btnGroup);
        canvasContainer.appendChild(startupDiv);

        const initTable = (data = null) => {
            startupDiv.remove();
            
            const table = document.createElement('table');
            Object.assign(table.style, {
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px',
                color: isDark ? '#eee' : '#333'
            });
            
            if (data && data.length > 0) {
                data.forEach((row, i) => {
                    const tr = document.createElement('tr');
                    row.forEach((val, j) => {
                        const cell = i === 0 ? document.createElement('th') : document.createElement('td');
                        cell.contentEditable = true;
                        Object.assign(cell.style, {
                            border: isDark ? '1px solid #555' : '1px solid #ddd',
                            padding: '4px',
                            minWidth: '50px',
                            textAlign: 'center',
                            backgroundColor: i === 0 ? (isDark ? '#444' : '#f9f9f9') : 'transparent'
                        });
                        cell.innerText = val;
                        tr.appendChild(cell);
                    });
                    table.appendChild(tr);
                });
            } else {
                for(let i=0; i<6; i++) {
                    const tr = document.createElement('tr');
                    for(let j=0; j<5; j++) {
                        const cell = i === 0 ? document.createElement('th') : document.createElement('td');
                        cell.contentEditable = true;
                        Object.assign(cell.style, {
                            border: isDark ? '1px solid #555' : '1px solid #ddd',
                            padding: '4px',
                            minWidth: '50px',
                            textAlign: 'center',
                            backgroundColor: i === 0 ? (isDark ? '#444' : '#f9f9f9') : 'transparent'
                        });
                        if (i === 0) cell.innerText = `Col ${j+1}`;
                        tr.appendChild(cell);
                    }
                    table.appendChild(tr);
                }
            }
            
            canvasContainer.appendChild(table);
            
            // Paste Logic
            table.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text');
                const rows = text.trim().split(/\r\n|\n|\r/);
                
                const selection = window.getSelection();
                if (!selection.rangeCount) return;
                let target = selection.getRangeAt(0).startContainer;
                if (target.nodeType === 3) target = target.parentNode;
                
                if (target.tagName !== 'TD' && target.tagName !== 'TH') return;
                
                const startRow = target.parentNode.rowIndex;
                const startCol = target.cellIndex;
                
                rows.forEach((rowText, r) => {
                    const cols = rowText.split('\t');
                    let tr = table.rows[startRow + r];
                    if (!tr) {
                        tr = table.insertRow();
                        for(let k=0; k<table.rows[0].cells.length; k++) {
                            const td = document.createElement('td');
                            td.contentEditable = true;
                            Object.assign(td.style, {
                                border: isDark ? '1px solid #555' : '1px solid #ddd',
                                padding: '4px',
                                minWidth: '50px',
                                textAlign: 'center'
                            });
                            tr.appendChild(td);
                        }
                    }
                    
                    cols.forEach((val, c) => {
                        let cell = tr.cells[startCol + c];
                        if (!cell) {
                             const td = document.createElement('td');
                            td.contentEditable = true;
                            Object.assign(td.style, {
                                border: isDark ? '1px solid #555' : '1px solid #ddd',
                                padding: '4px',
                                minWidth: '50px',
                                textAlign: 'center'
                            });
                            tr.appendChild(td);
                            cell = td;
                        }
                        cell.innerText = val;
                    });
                });
            });

            // Table Context Menu (Row/Col Operations)
            table.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();

                let target = e.target;
                if (target.nodeType === 3) target = target.parentNode;
                if (target.tagName !== 'TD' && target.tagName !== 'TH') return;

                const rowIndex = target.parentNode.rowIndex;
                const colIndex = target.cellIndex;

                const existingMenu = document.getElementById('table-context-menu');
                if (existingMenu) existingMenu.remove();

                const menu = document.createElement('div');
                menu.id = 'table-context-menu';
                Object.assign(menu.style, {
                    position: 'fixed',
                    left: `${e.clientX}px`,
                    top: `${e.clientY}px`,
                    backgroundColor: isDark ? '#333' : 'white',
                    border: isDark ? '1px solid #555' : '1px solid #ccc',
                    boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
                    borderRadius: '4px',
                    padding: '5px 0',
                    zIndex: '10002',
                    minWidth: '150px',
                    color: isDark ? '#eee' : '#333',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '13px'
                });

                const actions = [
                    { label: 'Insert Row Above', action: () => insertRow(rowIndex) },
                    { label: 'Insert Row Below', action: () => insertRow(rowIndex + 1) },
                    { label: 'Delete Row', action: () => deleteRow(rowIndex) },
                    { type: 'separator' },
                    { label: 'Insert Column Left', action: () => insertCol(colIndex) },
                    { label: 'Insert Column Right', action: () => insertCol(colIndex + 1) },
                    { label: 'Delete Column', action: () => deleteCol(colIndex) },
                    { type: 'separator' },
                    { label: 'Download CSV', action: () => downloadCSV() }
                ];

                actions.forEach(opt => {
                    if (opt.type === 'separator') {
                        const sep = document.createElement('div');
                        sep.style.borderTop = isDark ? '1px solid #555' : '1px solid #eee';
                        sep.style.margin = '5px 0';
                        menu.appendChild(sep);
                        return;
                    }

                    const item = document.createElement('div');
                    item.innerText = opt.label;
                    Object.assign(item.style, {
                        padding: '5px 15px',
                        cursor: 'pointer'
                    });
                    
                    item.onmouseover = () => item.style.backgroundColor = isDark ? '#444' : '#f0f0f0';
                    item.onmouseout = () => item.style.backgroundColor = 'transparent';
                    
                    item.onclick = () => {
                        opt.action();
                        menu.remove();
                    };
                    menu.appendChild(item);
                });

                document.body.appendChild(menu);

                const closeMenu = () => {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                };
                setTimeout(() => document.addEventListener('click', closeMenu), 0);

                function insertRow(index) {
                    const newRow = table.insertRow(index);
                    const colCount = table.rows[0].cells.length;
                    for(let i=0; i<colCount; i++) {
                        const cell = newRow.insertCell(i);
                        cell.contentEditable = true;
                        Object.assign(cell.style, {
                            border: isDark ? '1px solid #555' : '1px solid #ddd',
                            padding: '4px',
                            minWidth: '50px',
                            textAlign: 'center'
                        });
                    }
                }

                function deleteRow(index) {
                    if (table.rows.length > 1) {
                        table.deleteRow(index);
                    }
                }

                function insertCol(index) {
                    for(let i=0; i<table.rows.length; i++) {
                        const row = table.rows[i];
                        const cell = row.insertCell(index);
                        cell.contentEditable = true;
                        Object.assign(cell.style, {
                            border: isDark ? '1px solid #555' : '1px solid #ddd',
                            padding: '4px',
                            minWidth: '50px',
                            textAlign: 'center',
                            backgroundColor: i === 0 ? (isDark ? '#444' : '#f9f9f9') : 'transparent'
                        });
                        if (i === 0) cell.innerText = `New Col`;
                    }
                }

                function deleteCol(index) {
                    if (table.rows[0].cells.length > 1) {
                        for(let i=0; i<table.rows.length; i++) {
                            table.rows[i].deleteCell(index);
                        }
                    }
                }

                function downloadCSV() {
                    let csv = [];
                    for (let i = 0; i < table.rows.length; i++) {
                        let row = [], cols = table.rows[i].cells;
                        for (let j = 0; j < cols.length; j++) {
                            // Escape double quotes and wrap in quotes if needed
                            let data = cols[j].innerText.replace(/"/g, '""');
                            if (data.search(/("|,|\n)/g) >= 0) {
                                data = '"' + data + '"';
                            }
                            row.push(data);
                        }
                        csv.push(row.join(","));
                    }
                    const csvString = csv.join("\n");
                    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", "table_data.csv");
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
            });
        };

        createBtn.onclick = () => initTable(null);
        uploadBtn.onclick = () => fileInput.click();

        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.name.endsWith('.csv')) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const text = evt.target.result;
                    const rows = text.trim().split(/\r\n|\n|\r/).map(row => row.split(','));
                    initTable(rows);
                };
                reader.readAsText(file);
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                if (typeof XLSX === 'undefined') {
                    const script = document.createElement('script');
                    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
                    script.onload = () => processExcel(file);
                    script.onerror = () => {
                        alert("Could not load Excel parser. Please use CSV.");
                        initTable(null);
                    };
                    document.head.appendChild(script);
                } else {
                    processExcel(file);
                }
            }
        };

        const processExcel = (file) => {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, {header: 1});
                initTable(json);
            };
            reader.readAsArrayBuffer(file);
        };

        container.appendChild(canvasContainer);
        if (parentElement) parentElement.appendChild(container);
        else dashboard.appendChild(container);
        
        if (!parentElement) addDragLogic(header, container);
        return;
    }

    // Handle Tree Map separately (HTML implementation)
    if (type === 'treemap') {
        canvasContainer.style.display = 'flex';
        canvasContainer.style.flexWrap = 'wrap';
        canvasContainer.style.overflow = 'hidden';
        
        const treeData = [
            { label: 'Engineering', val: 40, color: 'rgba(255, 99, 132, 0.7)' },
            { label: 'Sales', val: 25, color: 'rgba(54, 162, 235, 0.7)' },
            { label: 'HR', val: 15, color: 'rgba(255, 206, 86, 0.7)' },
            { label: 'Marketing', val: 10, color: 'rgba(75, 192, 192, 0.7)' },
            { label: 'Legal', val: 10, color: 'rgba(153, 102, 255, 0.7)' }
        ];
        
        treeData.forEach(d => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                flex: d.val,
                backgroundColor: d.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                border: '1px solid rgba(255,255,255,0.5)',
                boxSizing: 'border-box',
                minWidth: '50px',
                minHeight: '50px',
                flexBasis: d.val + '%' // Approximate
            });
            item.innerHTML = `<div style="text-align:center;font-size:12px;">${d.label}<br>${d.val}%</div>`;
            canvasContainer.appendChild(item);
        });
        
        container.appendChild(canvasContainer);
        if (parentElement) parentElement.appendChild(container);
        else dashboard.appendChild(container);
        
        // Add drag logic only if not in container
        if (!parentElement) addDragLogic(header, container);
        return;
    }

    const canvas = document.createElement('canvas');
    canvasContainer.appendChild(canvas);
    container.appendChild(canvasContainer);
    if (parentElement) parentElement.appendChild(container);
    else dashboard.appendChild(container);

    // Configure Chart Data based on Type
    let chartType = type;
    let chartData = {};
    let chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                labels: { color: isDark ? '#eee' : '#666' }
            },
            zoom: {
                zoom: {
                    wheel: { enabled: true },
                    pinch: { enabled: true },
                    mode: 'xy'
                },
                pan: {
                    enabled: true,
                    mode: 'xy'
                }
            }
        }
    };

    if (type === 'bubble') {
        chartData = {
            datasets: [{
                label: 'Bubble Dataset',
                data: [
                    { x: 20, y: 30, r: 15 }, { x: 40, y: 10, r: 10 }, { x: 25, y: 20, r: 8 },
                    { x: 35, y: 40, r: 12 }, { x: 15, y: 25, r: 20 }
                ],
                backgroundColor: colors[0],
                borderColor: borders[0]
            }]
        };
    } else if (type === 'radar') {
        chartData = {
            labels: ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency'],
            datasets: [{
                label: 'Model A',
                data: [65, 59, 90, 81, 56],
                fill: true,
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                borderColor: 'rgba(255, 99, 132, 1)',
                pointBackgroundColor: 'rgba(255, 99, 132, 1)',
            }, {
                label: 'Model B',
                data: [28, 48, 40, 19, 96],
                fill: true,
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
            }]
        };
        chartOptions.scales = {
            r: {
                grid: { color: isDark ? '#444' : '#ddd' },
                pointLabels: { color: isDark ? '#eee' : '#666' },
                ticks: { backdropColor: 'transparent', color: isDark ? '#eee' : '#666' }
            }
        };
    } else if (type === 'gantt') {
        chartType = 'bar';
        chartOptions.indexAxis = 'y';
        chartData = {
            labels: ['Planning', 'Design', 'Development', 'Testing'],
            datasets: [{
                label: 'Project Schedule',
                data: [
                    [1, 5], [5, 10], [8, 18], [15, 25]
                ],
                backgroundColor: colors.slice(0, 4)
            }]
        };
        chartOptions.scales = {
            x: { min: 0, max: 30, grid: { color: isDark ? '#444' : '#ddd' }, ticks: { color: isDark ? '#eee' : '#666' } },
            y: { grid: { color: isDark ? '#444' : '#ddd' }, ticks: { color: isDark ? '#eee' : '#666' } }
        };
    } else if (type === 'area') {
        chartType = 'line';
        chartData = {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Growth Area',
                data: [10, 25, 20, 35, 30, 45],
                fill: true,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.4
            }]
        };
        chartOptions.scales = {
            x: { ticks: { color: isDark ? '#eee' : '#666' }, grid: { color: isDark ? '#444' : '#ddd' } },
            y: { ticks: { color: isDark ? '#eee' : '#666' }, grid: { color: isDark ? '#444' : '#ddd' } }
        };
    } else if (type === 'box') {
        chartType = 'boxplot';
        chartData = {
            labels: ['Group A', 'Group B', 'Group C'],
            datasets: [{
                label: 'Distribution',
                data: [
                    [10, 12, 15, 18, 20, 22, 25],
                    [15, 18, 20, 25, 28, 30, 35],
                    [5, 8, 10, 12, 15, 18, 20]
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1,
                outlierColor: '#999999',
                padding: 10,
                itemRadius: 0
            }]
        };
        chartOptions.scales = {
            x: { ticks: { color: isDark ? '#eee' : '#666' }, grid: { color: isDark ? '#444' : '#ddd' } },
            y: { ticks: { color: isDark ? '#eee' : '#666' }, grid: { color: isDark ? '#444' : '#ddd' } }
        };
    } else {
        // Standard Types
        chartData = {
            labels: ['A', 'B', 'C', 'D', 'E'],
            datasets: [{
                label: 'Sample Data',
                data: [12, 19, 3, 5, 2],
                backgroundColor: type === 'pie' || type === 'doughnut' ? colors : colors[1],
                borderColor: type === 'pie' || type === 'doughnut' ? borders : borders[1],
                borderWidth: 1
            }]
        };
        if (type !== 'pie' && type !== 'doughnut') {
             chartOptions.scales = {
                x: { ticks: { color: isDark ? '#eee' : '#666' }, grid: { color: isDark ? '#444' : '#ddd' } },
                y: { ticks: { color: isDark ? '#eee' : '#666' }, grid: { color: isDark ? '#444' : '#ddd' } }
            };
        }
    }

    // Initialize Chart
    const chartInstance = new Chart(canvas, {
        type: chartType,
        data: chartData,
        options: chartOptions
    });

    // Add ResizeObserver to handle container resizing
    const resizeObserver = new ResizeObserver(() => {
        chartInstance.resize();
    });
    resizeObserver.observe(container);

    // Cleanup observer on close
    closeBtn.onclick = () => {
        resizeObserver.disconnect();
        container.remove();
        updateDashboardControlsVisibility();
    };

    if (!parentElement) addDragLogic(header, container);

    // Gantt Chart Interactivity (Drag to extend)
    if (type === 'gantt') {
        let dragging = false;
        let dragIndex = -1;
        
        canvas.onmousedown = (e) => {
            const chartInstance = Chart.getChart(canvas);
            if (!chartInstance) return;
            
            const points = chartInstance.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
            if (points.length) {
                const index = points[0].index;
                const element = points[0].element;
                
                // Check if click is near the right edge (end time)
                // element.x is the right edge pixel for horizontal bar
                if (Math.abs(e.offsetX - element.x) < 15) { // 15px tolerance
                    dragging = true;
                    dragIndex = index;
                    canvas.style.cursor = 'ew-resize';
                }
            }
        };
        
        canvas.onmousemove = (e) => {
            const chartInstance = Chart.getChart(canvas);
            if (!chartInstance) return;

            if (dragging && dragIndex !== -1) {
                const newVal = chartInstance.scales.x.getValueForPixel(e.offsetX);
                // Update end time. Data is [start, end]
                const startVal = chartInstance.data.datasets[0].data[dragIndex][0];
                if (newVal > startVal) {
                    chartInstance.data.datasets[0].data[dragIndex][1] = newVal;
                    chartInstance.update('none'); // Efficient update
                }
            } else {
                // Hover effect
                const points = chartInstance.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
                if (points.length) {
                    const element = points[0].element;
                    if (Math.abs(e.offsetX - element.x) < 15) {
                        canvas.style.cursor = 'ew-resize';
                    } else {
                        canvas.style.cursor = 'default';
                    }
                } else {
                    canvas.style.cursor = 'default';
                }
            }
        };
        
        canvas.onmouseup = () => {
            if (dragging) {
                dragging = false;
                dragIndex = -1;
                canvas.style.cursor = 'default';
                const chartInstance = Chart.getChart(canvas);
                if (chartInstance) chartInstance.update();
            }
        };
        
        canvas.onmouseout = () => {
            if (dragging) {
                dragging = false;
                dragIndex = -1;
                const chartInstance = Chart.getChart(canvas);
                if (chartInstance) chartInstance.update();
            }
        };
    }
    
    updateDashboardControlsVisibility();
}

function createLayoutContainer(x, y) {
    const dashboard = document.getElementById('dashboard-content');
    const isDark = document.body.classList.contains('dark-theme');
    
    const container = document.createElement('div');
    container.className = 'dashboard-layout-container';
    Object.assign(container.style, {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: '600px',
        height: '400px',
        backgroundColor: isDark ? '#252525' : '#f9f9f9',
        border: isDark ? '2px dashed #555' : '2px dashed #ccc',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '5px 10px',
        backgroundColor: isDark ? '#333' : '#eee',
        borderBottom: isDark ? '1px solid #444' : '1px solid #ddd',
        cursor: 'move',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        color: isDark ? '#eee' : '#333',
        fontWeight: 'bold',
        fontSize: '13px'
    });
    
    const title = document.createElement('span');
    title.textContent = '📦 Layout Container (Right-click inside to add plots)';
    Object.assign(title.style, {
        cursor: 'text',
        padding: '2px 5px',
        borderRadius: '3px',
        border: '1px solid transparent',
        minWidth: '50px',
        outline: 'none'
    });
    title.contentEditable = true;
    title.spellcheck = false;
    title.title = "Click to rename";

    // Prevent drag when editing title
    title.onmousedown = (e) => e.stopPropagation();
    
    // Visual feedback on hover/focus
    title.onmouseover = () => { if(document.activeElement !== title) title.style.border = '1px dashed #999'; };
    title.onmouseout = () => { if(document.activeElement !== title) title.style.border = '1px solid transparent'; };
    title.onfocus = () => { 
        title.style.border = '1px solid #0075ff'; 
        title.style.backgroundColor = isDark ? '#444' : '#fff';
        title.style.color = isDark ? '#fff' : '#000';
    };
    title.onblur = () => { 
        title.style.border = '1px solid transparent'; 
        title.style.backgroundColor = 'transparent';
        title.style.color = isDark ? '#eee' : '#333';
    };
    
    // Blur on Enter
    title.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            title.blur();
        }
    };

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '10px';
    controls.style.alignItems = 'center';

    // Full View Button
    const fullBtn = document.createElement('span');
    fullBtn.innerHTML = '⤢';
    fullBtn.style.cursor = 'pointer';
    fullBtn.style.fontSize = '14px';
    fullBtn.title = 'Toggle Full View';
    
    let isFull = false;
    let originalStyles = {};

    fullBtn.onclick = () => {
        isFull = !isFull;
        if (isFull) {
            originalStyles = {
                position: container.style.position,
                left: container.style.left,
                top: container.style.top,
                width: container.style.width,
                height: container.style.height,
                zIndex: container.style.zIndex,
                margin: container.style.margin
            };
            Object.assign(container.style, {
                position: 'fixed',
                left: '0',
                top: '0',
                width: '100vw',
                height: '100vh',
                zIndex: '10000',
                margin: '0'
            });
            fullBtn.innerHTML = '↙';
        } else {
            Object.assign(container.style, originalStyles);
            fullBtn.innerHTML = '⤢';
        }
        // Trigger resize for all child charts
        const canvases = container.querySelectorAll('canvas');
        canvases.forEach(canvas => {
             const chart = Chart.getChart(canvas);
             if (chart) chart.resize();
        });
    };
    
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '16px';
    closeBtn.onclick = () => {
        container.remove();
        updateDashboardControlsVisibility();
    };
    
    controls.appendChild(fullBtn);
    controls.appendChild(closeBtn);

    header.appendChild(title);
    header.appendChild(controls);
    container.appendChild(header);

    // Content Area
    const content = document.createElement('div');
    Object.assign(content.style, {
        flex: '1',
        display: 'flex',
        flexWrap: 'wrap',
        padding: '10px',
        gap: '10px',
        overflow: 'auto',
        alignContent: 'flex-start'
    });
    container.appendChild(content);

    // Context Menu for Container
    content.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent dashboard menu

        if (window.closeAllChartMenus) window.closeAllChartMenus();

        // Remove existing menu
        const existingMenu = document.getElementById('dashboard-context-menu');
        if (existingMenu) existingMenu.remove();

        const menu = document.createElement('div');
        menu.id = 'dashboard-context-menu';
        Object.assign(menu.style, {
            position: 'fixed',
            left: `${e.clientX}px`,
            top: `${e.clientY}px`,
            backgroundColor: isDark ? '#333' : 'white',
            border: isDark ? '1px solid #555' : '1px solid #ccc',
            boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
            borderRadius: '4px',
            padding: '5px 0',
            zIndex: '10001',
            minWidth: '150px',
            color: isDark ? '#eee' : '#333',
            fontFamily: 'Arial, sans-serif',
            fontSize: '13px'
        });

        const options = [
            { label: 'Pie Chart', type: 'pie', icon: '🥧' },
            { label: 'Scatter Plot', type: 'scatter', icon: '∴' },
            { label: 'Line Plot', type: 'line', icon: '📈' },
            { label: 'Area Chart', type: 'area', icon: '⛰️' },
            { label: 'Bar Plot', type: 'bar', icon: '📊' },
            { label: 'Box Plot', type: 'box', icon: '◰' },
            { label: 'Bubble Plot', type: 'bubble', icon: '🫧' },
            { label: 'Gantt Chart', type: 'gantt', icon: '📅' },
            { label: 'Tree Map', type: 'treemap', icon: '🔲' },
            { label: 'Radar Chart', type: 'radar', icon: '🕸️' },
            { label: 'Data Table', type: 'table', icon: '📋' }
        ];

        options.forEach(opt => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '8px 15px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            });
            item.innerHTML = `<span style="width:20px;text-align:center;">${opt.icon}</span> ${opt.label}`;
            
            item.onmouseover = () => item.style.backgroundColor = isDark ? '#444' : '#f0f0f0';
            item.onmouseout = () => item.style.backgroundColor = 'transparent';
            
            item.onclick = () => {
                createDashboardChart(opt.type, 0, 0, content);
                menu.remove();
            };
            menu.appendChild(item);
        });

        document.body.appendChild(menu);
        const closeMenu = () => {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    });

    // Resize Handle
    const resizer = document.createElement('div');
    Object.assign(resizer.style, {
        width: '15px',
        height: '15px',
        position: 'absolute',
        right: '0',
        bottom: '0',
        cursor: 'se-resize',
        zIndex: '10',
        background: 'linear-gradient(135deg, transparent 50%, #888 50%)', // Visual indicator
        borderBottomRightRadius: '8px'
    });
    container.appendChild(resizer);

    // Drag Logic
    addDragLogic(header, container);
    // Resize Logic
    addResizeLogic(resizer, container);
    
    dashboard.appendChild(container);
    updateDashboardControlsVisibility();
}

function addResizeLogic(resizer, container) {
    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent drag
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(container).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(container).height, 10);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!isResizing) return;
        const width = startWidth + (e.clientX - startX);
        const height = startHeight + (e.clientY - startY);
        container.style.width = width + 'px';
        container.style.height = height + 'px';
    }

    function onMouseUp() {
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

function addDragLogic(header, container) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.onmousedown = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = container.offsetLeft;
        initialTop = container.offsetTop;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    function onMouseMove(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        container.style.left = `${initialLeft + dx}px`;
        container.style.top = `${initialTop + dy}px`;
    }

    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

function updateDashboardTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    const dashboard = document.getElementById('dashboard-content');
    if (dashboard) {
        dashboard.style.backgroundColor = isDark ? '#1e1e1e' : '#f5f5f5';
    }

    // Update Layout Containers
    const layoutContainers = document.querySelectorAll('.dashboard-layout-container');
    layoutContainers.forEach(container => {
        container.style.backgroundColor = isDark ? '#252525' : '#f9f9f9';
        container.style.borderColor = isDark ? '#555' : '#ccc';
        
        // Update header (first child)
        const header = container.firstElementChild;
        if (header) {
            header.style.backgroundColor = isDark ? '#333' : '#eee';
            header.style.borderBottomColor = isDark ? '#444' : '#ddd';
            header.style.color = isDark ? '#eee' : '#333';
        }
    });

    // Update existing charts
    const charts = document.querySelectorAll('.dashboard-chart-container');
    charts.forEach(container => {
        container.style.backgroundColor = isDark ? '#2b2b2b' : 'white';
        container.style.borderColor = isDark ? '#444' : '#ddd';
        
        const header = container.querySelector('.dashboard-chart-header');
        if (header) {
            header.style.borderBottomColor = isDark ? '#444' : '#eee';
            header.style.color = isDark ? '#eee' : '#333';
        }

        // Update Chart.js instance
        const canvas = container.querySelector('canvas');
        if (canvas) {
            const chart = Chart.getChart(canvas);
            if (chart) {
                const textColor = isDark ? '#eee' : '#666';
                const gridColor = isDark ? '#444' : '#ddd';
                
                if (chart.options.plugins.legend) {
                    if (!chart.options.plugins.legend.labels) chart.options.plugins.legend.labels = {};
                    chart.options.plugins.legend.labels.color = textColor;
                }
                
                if (chart.scales.x) {
                    if (!chart.scales.x.ticks) chart.scales.x.ticks = {};
                    chart.scales.x.ticks.color = textColor;
                    if (!chart.scales.x.grid) chart.scales.x.grid = {};
                    chart.scales.x.grid.color = gridColor;
                }
                if (chart.scales.y) {
                    if (!chart.scales.y.ticks) chart.scales.y.ticks = {};
                    chart.scales.y.ticks.color = textColor;
                    if (!chart.scales.y.grid) chart.scales.y.grid = {};
                    chart.scales.y.grid.color = gridColor;
                }
                chart.update();
            }
        }
    });
}

// Initialize logic immediately (elements exist)
setupAnalysisTab();
setupAnalyticalDashboard();

var bottom_sidebar = L.control.sidebar('onemap-sidebar-bottom', {
    position: 'bottom',
    autoPan: false,
    closeButton: true,
    tabText: 'Analysis'
}).addTo(map);

// NEW: Handle Sidebar Overlaps
function updateBottomSidebarLayout() {
    const bottomEl = bottom_sidebar.getContainer().parentElement; // .leaflet-sidebar.bottom
    if (!bottomEl) return;

    let leftOffset = 0;
    let rightOffset = 0;

    if (filter_sidebar.isVisible()) {
        const leftEl = filter_sidebar.getContainer().parentElement;
        leftOffset = leftEl.offsetWidth;
    }

    if (details_sidebar.isVisible()) {
        const rightEl = details_sidebar.getContainer().parentElement;
        rightOffset = rightEl.offsetWidth;
    }

    bottomEl.style.left = leftOffset + 'px';
    bottomEl.style.width = `calc(100% - ${leftOffset + rightOffset}px)`;
}

// Listen to events
filter_sidebar.on('show shown hide hidden resize', updateBottomSidebarLayout);
details_sidebar.on('show shown hide hidden resize', updateBottomSidebarLayout);
bottom_sidebar.on('show', updateBottomSidebarLayout);

// Initial check
updateBottomSidebarLayout();

// Load Chart.js and plugins dynamically
const loadScript = (src) => {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
};

// Load sequentially to ensure dependencies are met
loadScript('https://cdn.jsdelivr.net/npm/chart.js')
    .then(() => loadScript('https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js'))
    .then(() => loadScript('https://cdn.jsdelivr.net/npm/hammerjs@2.0.8'))
    .then(() => loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1'))
    .then(() => loadScript('https://unpkg.com/@sgratzl/chartjs-chart-boxplot@3.6.0/build/index.umd.min.js'))
    .catch(err => console.error('Failed to load chart libraries', err));

let productionChart = null;
let extraCharts = []; // NEW: Store extra charts

function getThemeColors() {
    const isDark = document.body.classList.contains('dark-theme');
    return {
        textColor: isDark ? '#ccc' : '#666',
        gridColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
    };
}

function updateChartTheme() {
    const { textColor, gridColor } = getThemeColors();
    const isDark = document.body.classList.contains('dark-theme');
    
    const applyTheme = (chart) => {
        if (!chart) return;
        Object.keys(chart.scales).forEach(key => {
            const scale = chart.scales[key];
            if (!scale.options.ticks) scale.options.ticks = {};
            scale.options.ticks.color = textColor;
            
            if (!scale.options.grid) scale.options.grid = {};
            scale.options.grid.color = gridColor;
            
            // Update axis titles
            if (scale.options.title) {
                scale.options.title.color = textColor;
            }
        });
        
        if (chart.options.plugins.legend) {
             if (!chart.options.plugins.legend.labels) chart.options.plugins.legend.labels = {};
             chart.options.plugins.legend.labels.color = textColor;
        }
        
        chart.update();
    };

    if (typeof productionChart !== 'undefined') applyTheme(productionChart);
    if (window.fullChart) applyTheme(window.fullChart);

    // Update Extra Charts
    if (typeof extraCharts !== 'undefined') {
        extraCharts.forEach(ec => {
            applyTheme(ec.chart);
            // Update container styles
            if (ec.container) {
                ec.container.style.backgroundColor = isDark ? '#2b2b2b' : '#fff';
                ec.container.style.border = isDark ? '1px solid #444' : '1px solid #eee';
                
                // Update toolbar buttons
                const buttons = ec.container.querySelectorAll('button');
                buttons.forEach(btn => btn.style.color = textColor);
            }
        });
    }

    // NEW: Update Add Plot Button
    const addPlotBtn = document.getElementById('add-plot-btn');
    if (addPlotBtn) {
        addPlotBtn.style.borderColor = isDark ? '#444' : '#e0e0e0';
        addPlotBtn.style.backgroundColor = isDark ? '#2b2b2b' : '#fafafa';
        addPlotBtn.style.color = isDark ? '#888' : '#999';
    }
}

function updateTableTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    const wrapper = document.getElementById('rates-table-wrapper');
    const header = document.getElementById('rates-table-header');
    const status = document.getElementById('rates-status');
    
    if (wrapper) {
        wrapper.style.backgroundColor = isDark ? '#2b2b2b' : 'white';
        wrapper.style.borderColor = isDark ? '#444' : '#ddd';
    }
    if (header && header.parentElement) {
        header.parentElement.style.backgroundColor = isDark ? '#333' : '#f8f9fa';
        header.parentElement.style.color = isDark ? '#eee' : '#333';
        // Update header cells border
        const ths = header.querySelectorAll('th');
        ths.forEach(th => {
            th.style.borderColor = isDark ? '#444' : '#dee2e6';
            th.style.color = isDark ? '#eee' : '#333';
        });
    }
    if (status) {
        status.style.color = isDark ? '#aaa' : '#666';
    }
    
    // Re-render table to update row colors
    if (typeof renderRatesTable === 'function') renderRatesTable();
}

// NEW: Context Menu & Marker Logic
const ctxMenu = document.createElement('div');
ctxMenu.id = 'chart-context-menu';
Object.assign(ctxMenu.style, {
    display: 'none', position: 'fixed', zIndex: '10000',
    backgroundColor: 'white', border: '1px solid #ccc',
    boxShadow: '2px 2px 5px rgba(0,0,0,0.2)', borderRadius: '4px',
    padding: '5px 0', minWidth: '160px', fontFamily: 'Arial, sans-serif', fontSize: '13px'
});

// NEW: Global helper to close all menus
window.closeAllChartMenus = function() {
    ctxMenu.style.display = 'none';
    document.querySelectorAll('.chart-settings-panel').forEach(el => el.remove());
    const selMenu = document.getElementById('selection-menu');
    if (selMenu) selMenu.style.display = 'none';
    const tableMenu = document.getElementById('table-context-menu');
    if (tableMenu) tableMenu.style.display = 'none';
    const dashMenu = document.getElementById('dashboard-context-menu');
    if (dashMenu) dashMenu.remove();
};

// NEW: Close menus on sidebar click
detailsContainer.addEventListener('click', () => {
    window.closeAllChartMenus();
});

let activeChartContext = null; // { chart, xValue }

const createMenuItem = (text, icon, onClick) => {
    const item = document.createElement('div');
    Object.assign(item.style, {
        padding: '8px 15px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: '8px', color: '#333'
    });
    item.innerHTML = `<span style="width:16px;text-align:center;">${icon}</span> ${text}`;
    item.onmouseover = () => item.style.backgroundColor = '#f0f0f0';
    item.onmouseout = () => item.style.backgroundColor = 'white';
    item.onclick = (e) => {
        e.stopPropagation();
        ctxMenu.style.display = 'none';
        if (activeChartContext) onClick(activeChartContext);
    };
    return item;
};

ctxMenu.appendChild(createMenuItem('Reset Zoom', '⟲', ({ chart }) => {
    // 1. Try standard reset first
    if (typeof chart.resetZoom === 'function') {
        chart.resetZoom();
    }

    // 2. Force clear any lingering min/max overrides from "Zoom to box"
    const clearScales = (scales) => {
        if (!scales) return;
        Object.keys(scales).forEach(key => {
            const scale = scales[key];
            if (scale) {
                scale.min = undefined;
                scale.max = undefined;
                delete scale.min;
                delete scale.max;
            }
        });
    };

    if (chart.options?.scales) clearScales(chart.options.scales);
    if (chart.config?.options?.scales) clearScales(chart.config.options.scales);
    
    // 3. Force update to apply auto-scaling
    chart.update();
}));

ctxMenu.appendChild(createMenuItem('Save new date marker', '⚑', ({ chart, xValue }) => {
    if (!chart._markers) chart._markers = [];
    const nextNum = chart._markers.length + 1;
    const label = prompt("Enter marker label:", `Event ${nextNum}`);
    if (label) {
        chart._markers.push({ date: xValue, label });
        chart.update();
    }
}));

ctxMenu.appendChild(createMenuItem('Clear all markers', '✕', ({ chart }) => {
    if (chart._markers && chart._markers.length > 0) {
        if (confirm('Clear all event markers?')) {
            chart._markers = [];
            chart.update();
        }
    } else {
        alert('No markers to clear.');
    }
}));



ctxMenu.appendChild(createMenuItem('Plot statistics', '🖩', ({ chart }) => {
    const { min, max } = chart.scales.x;
    const datasets = chart.data.datasets;
    let statsMsg = `Statistics (Visible Range):\n`;
    
    datasets.forEach(ds => {
        // Filter data within range
        const values = ds.data.filter((v, i) => {
            const d = new Date(chart.data.labels[i]).getTime();
            return d >= min && d <= max;
        });
        
        if (values.length > 0) {
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            statsMsg += `\n${ds.label}:\n  Avg: ${avg.toFixed(2)}\n  Min: ${minVal.toFixed(2)}\n  Max: ${maxVal.toFixed(2)}`;
        }
    });
    alert(statsMsg);
}));

document.body.appendChild(ctxMenu);
document.addEventListener('click', () => ctxMenu.style.display = 'none');
document.addEventListener('contextmenu', (e) => {
    if (!ctxMenu.contains(e.target)) ctxMenu.style.display = 'none';
});

const markerPlugin = {
    id: 'markers',
    afterDatasetsDraw: (chart) => {
        if (!chart._markers || chart._markers.length === 0) return;
        const ctx = chart.ctx;
        const xAxis = chart.scales.x;
        const yAxis = chart.scales.y;

        ctx.save();
        chart._markers.forEach(m => {
            const x = xAxis.getPixelForValue(m.date);
            if (x >= xAxis.left && x <= xAxis.right) {
                // Draw Line
                ctx.beginPath();
                ctx.moveTo(x, yAxis.top);
                ctx.lineTo(x, yAxis.bottom);
                ctx.strokeStyle = '#ff6384';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.stroke();

                // Draw Label
                ctx.fillStyle = '#ff6384';
                ctx.font = '10px Arial';
                ctx.fillText(m.label, x + 4, yAxis.top + 10);
            }
        });
        ctx.restore();
    }
};

const cursorPlugin = {
    id: 'cursor',
    afterDatasetsDraw: (chart) => {
        const activeElements = chart.getActiveElements();
        if (activeElements.length > 0) {
            const ctx = chart.ctx;
            const x = activeElements[0].element.x;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;
            const leftX = chart.scales.x.left;
            const rightX = chart.scales.x.right;

            ctx.save();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.setLineDash([5, 5]);

            // Vertical Line
            ctx.beginPath();
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.stroke();

            // Horizontal Lines for each active point
            activeElements.forEach(el => {
                const y = el.element.y;
                ctx.beginPath();
                ctx.moveTo(leftX, y);
                ctx.lineTo(rightX, y);
                ctx.stroke();
            });

            ctx.restore();
        }
    }
};

// --- Date Picker Implementation ---

function injectDatePickerStyles() {
    if (document.getElementById('datepicker-styles')) return;
    const style = document.createElement('style');
    style.id = 'datepicker-styles';
    style.textContent = `
        .chart-settings-panel { background: white; color: #333; border: 1px solid #ccc; }
        .dark-theme .chart-settings-panel { background: #2b2b2b; color: #eee; border: 1px solid #444; }
        .dp-container { display: flex; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; }
        .dp-sidebar { width: 100px; border-right: 1px solid #ddd; padding: 5px; display: flex; flex-direction: column; gap: 2px; }
        .dark-theme .dp-sidebar { border-right: 1px solid #444; }
        
        /* Generic Input/Button Styles for Settings Panel */
        .csp-label { font-weight: bold; color: #666; margin-bottom: 8px; font-size: 11px; text-transform: uppercase; }
        .dark-theme .csp-label { color: #aaa; }
        
        .csp-input { flex: 1; padding: 6px; border: 1px solid #ccc; border-radius: 2px; background: white; color: black; }
        .dark-theme .csp-input { border: 1px solid #555; background: #1e1e1e; color: #eee; }
        
        .csp-btn { padding: 6px 14px; cursor: pointer; border-radius: 2px; border: 1px solid #ccc; background: #f0f0f0; color: black; }
        .dark-theme .csp-btn { border: 1px solid #555; background: #333; color: #eee; }
        
        .csp-btn.primary { border: none; background: #0078d4; color: white; }
        
        .dp-sidebar button { text-align: left; background: none; border: none; padding: 4px 6px; cursor: pointer; font-size: 11px; color: inherit; border-radius: 4px; }
        .dp-sidebar button:hover { background-color: #f0f0f0; }
        .dark-theme .dp-sidebar button:hover { background-color: #3d3d3d; }
        .dp-main { padding: 10px; display: flex; flex-direction: column; gap: 10px; }
        .dp-calendars { display: flex; gap: 10px; }
        .dp-calendar { width: 180px; }
        .dp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; font-weight: bold; font-size: 12px; }
        .dp-nav-btn { background: none; border: none; cursor: pointer; font-size: 14px; color: inherit; padding: 0 4px; }
        .dp-month-select, .dp-year-select { border: 1px solid #ddd; border-radius: 3px; padding: 1px 2px; font-size: 11px; background: white; color: #333; cursor: pointer; }
        .dark-theme .dp-month-select, .dark-theme .dp-year-select { background: #333; color: #eee; border: 1px solid #555; }
        .dp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; text-align: center; font-size: 11px; }
        .dp-day-header { font-weight: bold; color: #888; padding-bottom: 2px; font-size: 10px; }
        .dp-cell { padding: 4px 0; cursor: pointer; border-radius: 2px; }
        .dp-cell:hover { background-color: #eee; }
        .dark-theme .dp-cell:hover { background-color: #444; }
        .dp-cell.selected { background-color: #0078d4; color: white; }
        .dp-cell.in-range { background-color: #e6f2ff; }
        .dark-theme .dp-cell.in-range { background-color: #004c87; }
        .dp-cell.other-month { color: #ccc; }
        .dark-theme .dp-cell.other-month { color: #666; }
        .dp-time-row { display: flex; gap: 10px; justify-content: space-between; margin-top: 5px; }
        .dp-time-input { display: flex; align-items: center; gap: 2px; border: 1px solid #ddd; padding: 2px 4px; border-radius: 4px; font-size: 11px; }
        .dark-theme .dp-time-input { border: 1px solid #555; background: #1e1e1e; }
        .dp-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 10px; }
        .dark-theme .dp-footer { border-top: 1px solid #444; }
        .dp-range-display { display: flex; gap: 5px; font-size: 11px; }
        .dp-range-input { padding: 2px 4px; border: 1px solid #ddd; border-radius: 4px; width: 120px; text-align: center; }
        .dark-theme .dp-range-input { border: 1px solid #555; background: #1e1e1e; color: #eee; }
        .dp-actions { display: flex; gap: 5px; }
        .dp-btn { padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; border: 1px solid #ddd; background: white; color: #333; }
        .dark-theme .dp-btn { border: 1px solid #555; background: #333; color: #eee; }
        .dp-btn.primary { background: #0078d4; color: white; border: none; }
    `;
    document.head.appendChild(style);
}

function createTimePickerUI(container, chart, scale, onClose) {
    injectDatePickerStyles();
    container.innerHTML = '';
    container.className = 'chart-settings-panel dp-container';
    
    // State
    let startDate = new Date(scale.min);
    let endDate = new Date(scale.max);
    
    // View State (Calendars)
    let leftYear = startDate.getFullYear();
    let leftMonth = startDate.getMonth();
    let rightYear = endDate.getFullYear();
    let rightMonth = endDate.getMonth();

    // Ensure right calendar is at least one month ahead visually if same month
    if (leftYear === rightYear && leftMonth === rightMonth) {
        if (rightMonth === 11) { rightYear++; rightMonth = 0; }
        else { rightMonth++; }
    }

    // --- DOM Elements ---
    const sidebar = document.createElement('div');
    sidebar.className = 'dp-sidebar';
    
    const main = document.createElement('div');
    main.className = 'dp-main';

    container.appendChild(sidebar);
    container.appendChild(main);

    // --- Sidebar Presets ---
    const presets = [
        { label: 'Past hour', get: () => [Date.now() - 3600000, Date.now()] },
        { label: 'Past day', get: () => [Date.now() - 86400000, Date.now()] },
        { label: 'Past week', get: () => [Date.now() - 604800000, Date.now()] },
        { label: 'Past month', get: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return [d.getTime(), Date.now()]; } },
        { label: 'Past 3 months', get: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); return [d.getTime(), Date.now()]; } },
        { label: 'Past 6 months', get: () => { const d = new Date(); d.setMonth(d.getMonth() - 6); return [d.getTime(), Date.now()]; } },
        { label: 'Past year', get: () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return [d.getTime(), Date.now()]; } },
        { label: 'Past 2 years', get: () => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return [d.getTime(), Date.now()]; } },
        { label: 'All Time', get: () => {
             // Find min/max from data
             let min = Infinity, max = -Infinity;
             chart.data.datasets.forEach(ds => {
                 ds.data.forEach((v, i) => {
                     const t = new Date(chart.data.labels[i]).getTime();
                     if (t < min) min = t;
                     if (t > max) max = t;
                 });
             });
             return [min, max];
        }}
    ];

    presets.forEach(p => {
        const btn = document.createElement('button');
        btn.textContent = p.label;
        btn.onclick = () => {
            const [start, end] = p.get();
            startDate = new Date(start);
            endDate = new Date(end);
            // Update view to show these dates
            leftYear = startDate.getFullYear();
            leftMonth = startDate.getMonth();
            rightYear = endDate.getFullYear();
            rightMonth = endDate.getMonth();
            if (leftYear === rightYear && leftMonth === rightMonth) {
                if (rightMonth === 11) { rightYear++; rightMonth = 0; }
                else { rightMonth++; }
            }
            render();
        };
        sidebar.appendChild(btn);
    });

    // --- Main Content ---
    const calendarsDiv = document.createElement('div');
    calendarsDiv.className = 'dp-calendars';
    
    const timeRow = document.createElement('div');
    timeRow.className = 'dp-time-row';

    const footer = document.createElement('div');
    footer.className = 'dp-footer';

    main.appendChild(calendarsDiv);
    main.appendChild(timeRow);
    main.appendChild(footer);

    // --- Render Function ---
    function render() {
        calendarsDiv.innerHTML = '';
        timeRow.innerHTML = '';
        footer.innerHTML = '';

        // Calendars
        calendarsDiv.appendChild(createCalendar(leftYear, leftMonth, 'left'));
        calendarsDiv.appendChild(createCalendar(rightYear, rightMonth, 'right'));

        // Time Inputs
        const createTimeInput = (date, onChange) => {
            const div = document.createElement('div');
            div.className = 'dp-time-input';
            
            const pad = n => n.toString().padStart(2, '0');
            
            const hInput = document.createElement('input'); hInput.value = pad(date.getHours()); hInput.style.width = '20px'; hInput.style.border='none'; hInput.style.textAlign='center'; hInput.style.background='transparent'; hInput.style.color='inherit';
            const mInput = document.createElement('input'); mInput.value = pad(date.getMinutes()); mInput.style.width = '20px'; mInput.style.border='none'; mInput.style.textAlign='center'; mInput.style.background='transparent'; mInput.style.color='inherit';
            const sInput = document.createElement('input'); sInput.value = pad(date.getSeconds()); sInput.style.width = '20px'; sInput.style.border='none'; sInput.style.textAlign='center'; sInput.style.background='transparent'; sInput.style.color='inherit';

            const updateTime = () => {
                let h = parseInt(hInput.value) || 0; h = Math.max(0, Math.min(23, h));
                let m = parseInt(mInput.value) || 0; m = Math.max(0, Math.min(59, m));
                let s = parseInt(sInput.value) || 0; s = Math.max(0, Math.min(59, s));
                
                const newDate = new Date(date);
                newDate.setHours(h, m, s);
                onChange(newDate);
            };

            [hInput, mInput, sInput].forEach(inp => {
                inp.onchange = updateTime;
                inp.onfocus = () => inp.select();
            });

            div.appendChild(hInput);
            div.appendChild(document.createTextNode(':'));
            div.appendChild(mInput);
            div.appendChild(document.createTextNode(':'));
            div.appendChild(sInput);
            return div;
        };

        timeRow.appendChild(createTimeInput(startDate, (d) => { startDate = d; render(); }));
        timeRow.appendChild(createTimeInput(endDate, (d) => { endDate = d; render(); }));

        // Footer
        const rangeDisplay = document.createElement('div');
        rangeDisplay.className = 'dp-range-display';
        
        const fmt = d => `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
        
        const startDisplay = document.createElement('div');
        startDisplay.className = 'dp-range-input';
        startDisplay.textContent = fmt(startDate);
        
        const endDisplay = document.createElement('div');
        endDisplay.className = 'dp-range-input';
        endDisplay.textContent = fmt(endDate);
        
        rangeDisplay.appendChild(startDisplay);
        rangeDisplay.appendChild(endDisplay);
        
        const actions = document.createElement('div');
        actions.className = 'dp-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'dp-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = onClose;
        
        const applyBtn = document.createElement('button');
        applyBtn.className = 'dp-btn primary';
        applyBtn.textContent = 'Apply';
        applyBtn.onclick = () => {
            if (startDate < endDate) {
                chart.zoomScale(scale.id, {min: startDate.getTime(), max: endDate.getTime()}, 'default');
                onClose();
            } else {
                alert('Start date must be before end date');
            }
        };
        
        actions.appendChild(cancelBtn);
        actions.appendChild(applyBtn);
        
        footer.appendChild(rangeDisplay);
        footer.appendChild(actions);
    }

    function createCalendar(year, month, side) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dp-calendar';
        
        // Header
        const header = document.createElement('div');
        header.className = 'dp-header';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'dp-nav-btn';
        prevBtn.textContent = '‹';
        prevBtn.onclick = () => {
            if (side === 'left') {
                leftMonth--; if(leftMonth<0){leftMonth=11; leftYear--;}
            } else {
                rightMonth--; if(rightMonth<0){rightMonth=11; rightYear--;}
            }
            render();
        };

        const nextBtn = document.createElement('button');
        nextBtn.className = 'dp-nav-btn';
        nextBtn.textContent = '›';
        nextBtn.onclick = () => {
            if (side === 'left') {
                leftMonth++; if(leftMonth>11){leftMonth=0; leftYear++;}
            } else {
                rightMonth++; if(rightMonth>11){rightMonth=0; rightYear++;}
            }
            render();
        };

        const title = document.createElement('span');
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        title.textContent = `${monthNames[month]} ${year}`;

        header.appendChild(prevBtn);
        header.appendChild(title);
        header.appendChild(nextBtn);
        wrapper.appendChild(header);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'dp-grid';
        
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
            const el = document.createElement('div');
            el.className = 'dp-day-header';
            el.textContent = d;
            grid.appendChild(el);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Prev Month Days
        for (let i = 0; i < firstDay; i++) {
            const d = daysInPrevMonth - firstDay + i + 1;
            const el = document.createElement('div');
            el.className = 'dp-cell other-month';
            el.textContent = d;
            grid.appendChild(el);
        }

        // Current Month Days
        for (let i = 1; i <= daysInMonth; i++) {
            const el = document.createElement('div');
            el.className = 'dp-cell';
            el.textContent = i;
            
            const currentTs = new Date(year, month, i).getTime();
            const startTs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
            const endTs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

            if (currentTs === startTs || currentTs === endTs) {
                el.classList.add('selected');
            } else if (currentTs > startTs && currentTs < endTs) {
                el.classList.add('in-range');
            }

            el.onclick = () => {
                const newDate = new Date(year, month, i);
                const newTs = newDate.getTime();
                const distToStart = Math.abs(newTs - startTs);
                const distToEnd = Math.abs(newTs - endTs);
                
                if (newTs < startTs) {
                    startDate = newDate;
                    startDate.setHours(0,0,0,0);
                } else if (newTs > endTs) {
                    endDate = newDate;
                    endDate.setHours(23,59,59,999);
                } else {
                    if (distToStart <= distToEnd) {
                        startDate = newDate;
                    } else {
                        endDate = newDate;
                    }
                }
                render();
            };
            
            grid.appendChild(el);
        }

        wrapper.appendChild(grid);
        return wrapper;
    }

    render();
}

function showAxisConfig(chart, scaleId, triggerEvent) {
    window.closeAllChartMenus();
    injectDatePickerStyles();

    const scale = chart.scales[scaleId];
    const isTime = scale.type === 'time' || scale.axis === 'x';
    
    const menu = document.createElement('div');
    menu.className = 'chart-settings-panel';
    Object.assign(menu.style, {
        position: 'absolute',
        zIndex: 10001,
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        borderRadius: '4px',
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        minWidth: '220px',
        display: 'flex',
        flexDirection: 'column'
    });

    // Position logic
    if (triggerEvent && triggerEvent.target) {
        const rect = triggerEvent.target.getBoundingClientRect();
        menu.style.left = rect.left + 'px';
        // Position above the button
        menu.style.bottom = (window.innerHeight - rect.top + 5) + 'px';
    } else {
        menu.style.bottom = '30px';
        menu.style.left = '4px';
    }
    
    // Drag functionality
    menu.style.cursor = 'move';
    
    // Prevent closing when clicking inside
    menu.addEventListener('click', (e) => e.stopPropagation());

    let isDragging = false;
    let startX, startY, startLeft, startTop;

    menu.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent closing

        // Don't drag if clicking inputs, buttons, or selects
        if (['INPUT', 'BUTTON', 'SELECT'].includes(e.target.tagName)) {
             return;
        }

        // If transform is present, resolve it to absolute pixels to prevent jump
        if (menu.style.transform && menu.style.transform.includes('translate')) {
            const rect = menu.getBoundingClientRect();
            menu.style.transform = 'none';
            menu.style.left = rect.left + 'px';
            menu.style.top = rect.top + 'px';
            menu.style.bottom = 'auto';
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // Convert bottom to top if necessary for absolute positioning
        if (menu.style.bottom && menu.style.bottom !== 'auto') {
            menu.style.top = menu.offsetTop + 'px';
            menu.style.bottom = 'auto';
        }
        
        startLeft = menu.offsetLeft;
        startTop = menu.offsetTop;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;
        
        // Constrain to window
        const maxLeft = window.innerWidth - menu.offsetWidth;
        const maxTop = window.innerHeight - menu.offsetHeight;
        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        menu.style.left = newLeft + 'px';
        menu.style.top = newTop + 'px';
    };

    const onMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    if (isTime) {
        createTimePickerUI(menu, chart, scale, () => menu.remove());
        
        // Append to body to avoid clipping issues
        document.body.appendChild(menu);
        
        // Position near the axis ONLY if not triggered by a specific event (button click)
        if (!triggerEvent) {
            if (chart.canvas) {
                const rect = chart.canvas.getBoundingClientRect();
                const axisCenterX = rect.left + scale.left + scale.width / 2;
                const axisCenterY = rect.top + scale.top + scale.height / 2;
                
                menu.style.left = axisCenterX + 'px';
                menu.style.top = axisCenterY + 'px';
                menu.style.transform = 'translate(-50%, -50%)';
            } else {
                menu.style.left = '50%';
                menu.style.top = '50%';
                menu.style.transform = 'translate(-50%, -50%)';
            }
            menu.style.bottom = 'auto';
        }
        
        menu.style.zIndex = '10001';

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('mousedown', closeHandler);
                }
            };
            document.addEventListener('mousedown', closeHandler);
        }, 100);
        return;
    }

    // Content
    const content = document.createElement('div');
    content.style.padding = '10px';

    const label = document.createElement('div');
    label.textContent = isTime ? 'TIME RANGE' : 'VALUE RANGE';
    label.className = 'csp-label';
    content.appendChild(label);

    const inputsRow = document.createElement('div');
    Object.assign(inputsRow.style, {
        display: 'flex',
        gap: '10px',
        marginBottom: '0'
    });

    const formatValue = (v) => {
        if (isTime) {
            const d = new Date(v);
            const pad = (n) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        } else {
            return typeof v === 'number' ? v.toFixed(2) : v;
        }
    };

    const createInput = (val) => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = formatValue(val);
        input.className = 'csp-input';
        return input;
    };

    const startInput = createInput(scale.min);
    const endInput = createInput(scale.max);

    inputsRow.appendChild(startInput);
    inputsRow.appendChild(endInput);
    content.appendChild(inputsRow);

    // Auto-apply on change
    const applyChange = () => {
        let newMin = parseFloat(startInput.value);
        let newMax = parseFloat(endInput.value);
        
        if (!isNaN(newMin) && !isNaN(newMax) && newMin < newMax) {
            chart.zoomScale(scaleId, {min: newMin, max: newMax}, 'default');
        }
    };

    startInput.addEventListener('change', applyChange);
    endInput.addEventListener('change', applyChange);
    
    // Allow Enter key to trigger change
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            startInput.blur(); // Triggers change
            endInput.blur();
        }
    };
    startInput.addEventListener('keydown', handleEnter);
    endInput.addEventListener('keydown', handleEnter);

    menu.appendChild(content);
    
    // Append to body to avoid clipping issues
    document.body.appendChild(menu);
    
    // Position near the axis
    if (chart.canvas) {
        const rect = chart.canvas.getBoundingClientRect();
        const axisCenterX = rect.left + scale.left + scale.width / 2;
        const axisCenterY = rect.top + scale.top + scale.height / 2;
        
        menu.style.left = axisCenterX + 'px';
        menu.style.top = axisCenterY + 'px';
        menu.style.transform = 'translate(-50%, -50%)';
    } else {
        menu.style.left = '50%';
        menu.style.top = '50%';
        menu.style.transform = 'translate(-50%, -50%)';
    }
    
    menu.style.bottom = 'auto';
    menu.style.zIndex = '10001';

    // Close on outside click
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('mousedown', closeHandler);
            }
        };
        document.addEventListener('mousedown', closeHandler);
    }, 100);
}

const inlineLegendPlugin = {
    id: 'inlineLegend',
    afterDatasetsDraw: (chart) => {
        if (!chart.options.plugins.inlineLegend || !chart.options.plugins.inlineLegend.enabled) return;
        
        const ctx = chart.ctx;
        const {top, right} = chart.chartArea;

        ctx.save();
        ctx.font = 'bold 12px Arial';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';

        let y = top + 10;
        const lineHeight = 14;

        // Calculate offset for right-side axes
        let rightOffset = 0;
        Object.values(chart.scales).forEach(scale => {
            if (scale.position === 'right') {
                rightOffset += scale.width || 0;
            }
        });

        chart.data.datasets.forEach((dataset, i) => {
            const meta = chart.getDatasetMeta(i);
            if (meta.hidden) return;

            ctx.fillStyle = dataset.borderColor;
            ctx.fillText(dataset.label, right + rightOffset + 10, y);
            y += lineHeight;
        });
        ctx.restore();
    }
};

function updateDrawerVisibility(chart, container) {
    if (!chart || !container) return;
    
    const leftDrawer = container.querySelector('.axis-drawer-toggle');
    const rightDrawer = container.querySelector('.axis-drawer-toggle-right');
    
    // Get all used scale IDs from datasets
    const usedScaleIds = new Set(chart.data.datasets.map(ds => ds.yAxisID || 'y'));
    
    const isScaleOnSide = (scale, id, side) => {
        // Check if it's a Y axis (either by axis property or ID convention)
        if (scale.axis !== 'y' && !id.startsWith('y')) return false;
        
        // Check position (default to left if undefined for y axis? usually explicit in this app)
        if (scale.position !== side) return false;
        
        // If it's used, it counts (regardless of display setting)
        if (usedScaleIds.has(id)) return true;
        
        // If it's not used, it only counts if it's forced to display
        if (scale.display === true) return true;
        
        return false;
    };

    const hasLeftAxis = Object.entries(chart.options.scales).some(([id, s]) => isScaleOnSide(s, id, 'left'));
    const hasRightAxis = Object.entries(chart.options.scales).some(([id, s]) => isScaleOnSide(s, id, 'right'));
    
    if (leftDrawer) leftDrawer.style.display = hasLeftAxis ? 'flex' : 'none';
    if (rightDrawer) rightDrawer.style.display = hasRightAxis ? 'flex' : 'none';
}

const ZoomControlManager = {
    activeTimeout: null,
    isHovering: false,
    
    create: (chart, container) => {
        // Remove old controls
        container.querySelectorAll('.axis-zoom-control').forEach(el => el.remove());
        chart._zoomControls = {};

        const createBtn = (text, title, onClick) => {
            const btn = document.createElement('button');
            btn.className = 'zoom-control-btn';
            btn.innerHTML = text;
            btn.title = title;
            Object.assign(btn.style, {
                width: '20px',
                height: '20px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                padding: '0'
            });
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick();
            };
            return btn;
        };

        const zoom = (scaleId, factor) => {
            const scale = chart.scales[scaleId];
            if (!scale) return;
            const min = scale.min;
            const max = scale.max;
            const range = max - min;
            const newRange = range * factor;
            const center = min + range / 2;
            chart.zoomScale(scaleId, {min: center - newRange/2, max: center + newRange/2}, 'default');
            chart.update('none'); // Force update without animation to apply zoom immediately
        };

        // NEW: Pan function
        const pan = (scaleId, direction) => {
            const scale = chart.scales[scaleId];
            if (!scale) return;
            const min = scale.min;
            const max = scale.max;
            const range = max - min;
            const step = range * 0.2 * direction; // 20% shift
            
            chart.zoomScale(scaleId, {min: min + step, max: max + step}, 'default');
            chart.update('none');
        };

        const fitScale = (scaleId) => {
            const scale = chart.scales[scaleId];
            if (!scale) return;

            if (scale.axis === 'x') {
                chart.resetZoom();
            } else {
                const xScale = chart.scales.x;
                const minX = xScale.min;
                const maxX = xScale.max;
                
                let minVal = Infinity;
                let maxVal = -Infinity;
                let hasData = false;

                chart.data.datasets.forEach(ds => {
                    const dsAxisId = ds.yAxisID || 'y';
                    if (dsAxisId === scaleId) {
                         ds.data.forEach((val, i) => {
                             const label = chart.data.labels[i];
                             const timestamp = new Date(label).getTime();
                             
                             if (timestamp >= minX && timestamp <= maxX) {
                                 if (val !== null && val !== undefined && !isNaN(val)) {
                                     if (val < minVal) minVal = val;
                                     if (val > maxVal) maxVal = val;
                                     hasData = true;
                                 }
                             }
                         });
                    }
                });

                if (hasData) {
                    const padding = (maxVal - minVal) * 0.05;
                    let newMin, newMax;
                    
                    if (padding === 0) {
                         newMin = minVal === 0 ? 0 : minVal * 0.9;
                         newMax = maxVal === 0 ? 1 : maxVal * 1.1;
                    } else {
                        newMin = minVal - padding;
                        newMax = maxVal + padding;
                    }
                    
                    chart.zoomScale(scaleId, {min: newMin, max: newMax}, 'default');
                } else {
                    // Fallback if no data visible or calculation fails
                    chart.resetZoom();
                }
            }
        };

        const moveAxis = (scaleId) => {
            const scale = chart.scales[scaleId];
            if (!scale) return;
            
            const newPosition = scale.position === 'left' ? 'right' : 
                                scale.position === 'right' ? 'left' :
                                scale.position === 'top' ? 'bottom' : 'top';
            
            scale.options.position = newPosition;
            chart.update();
            ZoomControlManager.create(chart, container); // Recreate controls for new position
            updateDrawerVisibility(chart, container);
            saveExtraChartsState(); // Save state after axis move
        };

        Object.values(chart.scales).forEach(scale => {
            if (scale.axis !== 'x' && scale.axis !== 'y') return;
            
            const div = document.createElement('div');
            div.className = 'axis-zoom-control';
            Object.assign(div.style, {
                position: 'absolute',
                display: 'none',
                flexDirection: scale.axis === 'y' ? 'column' : 'row',
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: '100',
                gap: '0'
            });

            div.appendChild(createBtn('+', 'Zoom In', () => zoom(scale.id, 0.9)));
            div.appendChild(createBtn('−', 'Zoom Out', () => zoom(scale.id, 1.1)));

            // NEW: Pan Buttons
            // Removed as per request to use drag-to-pan instead
            
            div.appendChild(createBtn('⤢', 'Fit', () => fitScale(scale.id)));
            
            // Add config button for ALL axes
            div.appendChild(createBtn('⚙', 'Configuration', (e) => showAxisConfig(chart, scale.id, e)));

            // Move Axis Button
            const arrowIcon = scale.axis === 'y' 
                ? (scale.position === 'left' ? '→' : '←')
                : (scale.position === 'top' ? '↓' : '↑');
            
            div.appendChild(createBtn(arrowIcon, 'Move axis to opposite side', () => moveAxis(scale.id)));

            // Styling borders
            Array.from(div.children).forEach((btn, i) => {
                if (i < div.children.length - 1) {
                    if (scale.axis === 'y') btn.style.borderBottom = '1px solid #eee';
                    else btn.style.borderRight = '1px solid #eee';
                }
            });

            // Hover logic
            div.onmouseenter = () => {
                ZoomControlManager.isHovering = true;
                if (ZoomControlManager.activeTimeout) clearTimeout(ZoomControlManager.activeTimeout);
            };
            div.onmouseleave = () => {
                ZoomControlManager.isHovering = false;
                ZoomControlManager.hideAll(chart);
            };

            container.appendChild(div);
            chart._zoomControls[scale.id] = div;
        });
    },

    show: (chart, scaleId) => {
        if (!chart._zoomControls) return;
        
        // Hide others
        Object.entries(chart._zoomControls).forEach(([id, el]) => {
            if (id !== scaleId) el.style.display = 'none';
        });

        const el = chart._zoomControls[scaleId];
        if (el) {
            if (ZoomControlManager.activeTimeout) clearTimeout(ZoomControlManager.activeTimeout);
            
            const scale = chart.scales[scaleId];
            if (!scale) return;

            el.style.display = 'flex';

            if (scale.axis === 'y') {
                // Position centered over the axis labels
                el.style.left = (scale.left + scale.width / 2) + 'px';
                el.style.transform = 'translateX(-50%)';
                el.style.top = scale.top + 'px';
            } else {
                el.style.left = (scale.left + scale.width/2) + 'px';
                el.style.transform = 'translateX(-50%)';
                
                if (scale.position === 'top') {
                    el.style.top = scale.bottom + 'px';
                } else {
                    el.style.top = (scale.top - el.offsetHeight) + 'px';
                }
            }
        }
    },

    hideAll: (chart) => {
        if (ZoomControlManager.isHovering) return;

        if (ZoomControlManager.activeTimeout) clearTimeout(ZoomControlManager.activeTimeout);
        ZoomControlManager.activeTimeout = setTimeout(() => {
             if (chart._zoomControls && !ZoomControlManager.isHovering) {
                 Object.values(chart._zoomControls).forEach(el => el.style.display = 'none');
             }
        }, 500); // Increased timeout
    }
};

const selectionPlugin = {
    id: 'selection',
    
    beforeEvent: (chart, args) => {
        const {x, y} = args.event;
        const type = args.event.type;
        
        // Initialize state per chart
        if (!chart._selectionState) {
            chart._selectionState = {
                start: null,
                current: null,
                drawing: false,
                selection: null
            };
        }
        const state = chart._selectionState;

        // Ignore if interacting with axis (handled by axisHoverPlugin/Zoom)
        if (chart.dragStartScale) return;

        // Double check axis bounds (in case axisHover didn't catch it or order is wrong)
        let onAxis = false;
        Object.values(chart.scales).forEach(scale => {
            if (x >= scale.left && x <= scale.right && y >= scale.top && y <= scale.bottom) {
                onAxis = true;
            }
        });
        if (onAxis) return;

        if (type === 'mousedown' || type === 'pointerdown') {
            state.start = {x, y};
            state.drawing = true;
            state.selection = null;
            // Hide menu if open
            const menu = document.getElementById('selection-menu');
            if (menu) menu.style.display = 'none';
            return false; // Stop propagation to other plugins
        } else if ((type === 'mousemove' || type === 'pointermove') && state.drawing) {
            state.current = {x, y};
            chart.draw();
            return false;
        } else if ((type === 'mouseup' || type === 'pointerup') && state.drawing) {
            state.drawing = false;
            if (state.start && state.current) {
                const width = Math.abs(state.current.x - state.start.x);
                const height = Math.abs(state.current.y - state.start.y);
                
                if (width > 5 && height > 5) { // Minimum threshold
                    state.selection = {
                        startX: Math.min(state.start.x, state.current.x),
                        endX: Math.max(state.start.x, state.current.x),
                        startY: Math.min(state.start.y, state.current.y),
                        endY: Math.max(state.start.y, state.current.y)
                    };
                    chart.draw(); // Draw final box
                    showSelectionMenu(chart, args.event.native);
                } else {
                    chart.draw(); // Clear box
                }
            }
            state.start = null;
            state.current = null;
        }
    },
    
    afterDraw: (chart) => {
        const state = chart._selectionState;
        if (!state) return;

        const ctx = chart.ctx;
        let rect = null;
        
        if (state.drawing && state.start && state.current) {
            rect = {
                x: Math.min(state.start.x, state.current.x),
                y: Math.min(state.start.y, state.current.y),
                w: Math.abs(state.current.x - state.start.x),
                h: Math.abs(state.current.y - state.start.y)
            };
        } else if (state.selection) {
            rect = {
                x: state.selection.startX,
                y: state.selection.startY,
                w: state.selection.endX - state.selection.startX,
                h: state.selection.endY - state.selection.startY
            };
        }
        
        if (rect) {
            ctx.save();
            ctx.fillStyle = 'rgba(54, 162, 235, 0.3)';
            ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
            ctx.strokeStyle = '#36a2eb';
            ctx.lineWidth = 1;
            ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
            ctx.restore();
        }
    }
};

// Create Selection Menu
const selMenu = document.createElement('div');
selMenu.id = 'selection-menu';
Object.assign(selMenu.style, {
    position: 'fixed',
    display: 'none',
    backgroundColor: '#333',
    color: 'white',
    border: '1px solid #444',
    boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
    zIndex: '10000',
    padding: '5px 0',
    borderRadius: '4px',
    fontSize: '13px',
    minWidth: '150px'
});

const createSelMenuItem = (text, icon, onClick) => {
    const item = document.createElement('div');
    Object.assign(item.style, {
        padding: '8px 15px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
    });
    item.innerHTML = `<span style="width:16px;text-align:center">${icon}</span> ${text}`;
    item.onmouseover = () => item.style.backgroundColor = '#444';
    item.onmouseout = () => item.style.backgroundColor = 'transparent';
    item.onclick = (e) => {
        e.stopPropagation();
        selMenu.style.display = 'none';
        onClick();
    };
    return item;
};

const showSelectionMenu = (chart, event) => {
    selMenu.innerHTML = '';
    
    const state = chart._selectionState;
    const sel = state ? state.selection : null;
    if (!sel) return;

    const getScaleBounds = (scale) => {
        const min = scale.getValueForPixel(scale.isHorizontal() ? sel.startX : sel.startY);
        const max = scale.getValueForPixel(scale.isHorizontal() ? sel.endX : sel.endY);
        return {min: Math.min(min, max), max: Math.max(min, max)};
    };

    // NEW: Calculate and display statistics
    const xScale = chart.scales.x;
    if (xScale) {
        const xBounds = getScaleBounds(xScale);
        const days = (xBounds.max - xBounds.min) / (1000 * 60 * 60 * 24);
        
        let statsHtml = `<div style="padding: 8px 15px; border-bottom: 1px solid #555; margin-bottom: 5px; font-family: monospace;">
            <div style="font-weight:bold; color:#fff; margin-bottom:4px;">Selection Stats</div>
            <div style="color:#ddd;">Duration: <span style="color:#fff;">${days.toFixed(1)} days</span></div>`;

        chart.data.datasets.forEach((ds, index) => {
            if (chart.isDatasetVisible(index)) {
                // Find data points in range
                // Assuming data is aligned with labels
                const dataInRange = ds.data.map((v, i) => ({v, t: chart.data.labels[i]}))
                    .filter(d => {
                        const t = new Date(d.t).getTime();
                        return t >= xBounds.min && t <= xBounds.max;
                    });
                
                if (dataInRange.length > 0) {
                    const startVal = dataInRange[0].v;
                    const endVal = dataInRange[dataInRange.length - 1].v;
                    const diff = endVal - startVal;
                    // Use dataset color or fallback
                    const color = ds.borderColor || ds.backgroundColor || '#ccc';
                    
                    statsHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px; color:#ddd;">
                        <span style="color:${color}">${ds.label || 'Rate'}:</span>
                        <span>${diff > 0 ? '+' : ''}${diff.toFixed(1)}</span>
                    </div>`;
                }
            }
        });
        statsHtml += `</div>`;
        selMenu.innerHTML = statsHtml;
    }

    selMenu.appendChild(createSelMenuItem('Zoom to box', '⤢', () => {
        Object.values(chart.scales).forEach(scale => {
            // Check for X or Y axis (including custom y-axis ids)
            if (scale.axis === 'x' || scale.axis === 'y' || scale.id.startsWith('y')) {
                const bounds = getScaleBounds(scale);
                // Ensure bounds are valid numbers
                if (Number.isFinite(bounds.min) && Number.isFinite(bounds.max)) {
                    // Directly update chart options to force the view
                    if (chart.options.scales[scale.id]) {
                        chart.options.scales[scale.id].min = bounds.min;
                        chart.options.scales[scale.id].max = bounds.max;
                    }
                }
            }
        });
        state.selection = null;
        chart.update();
    }));

    selMenu.appendChild(createSelMenuItem('Zoom on X axis', '↔', () => {
        Object.values(chart.scales).forEach(scale => {
            if (scale.axis === 'x') {
                const bounds = getScaleBounds(scale);
                chart.zoomScale(scale.id, bounds, 'default');
            }
        });
        state.selection = null;
        chart.update();
    }));
    
    selMenu.appendChild(createSelMenuItem('Zoom on Y axis', '↕', () => {
        Object.values(chart.scales).forEach(scale => {
            if (scale.axis === 'y') {
                const bounds = getScaleBounds(scale);
                chart.zoomScale(scale.id, bounds, 'default');
            }
        });
        state.selection = null;
        chart.update();
    }));

    selMenu.appendChild(createSelMenuItem('Clear selection', '✕', () => {
        state.selection = null;
        chart.draw();
    }));

    selMenu.style.left = `${event.clientX}px`;
    selMenu.style.top = `${event.clientY}px`;
    selMenu.style.display = 'block';
};

document.body.appendChild(selMenu);

// Close menu on click outside
document.addEventListener('click', (e) => {
    if (selMenu.style.display === 'block' && !selMenu.contains(e.target)) {
        selMenu.style.display = 'none';
        if (productionChart && productionChart._selectionState && productionChart._selectionState.selection) {
            productionChart._selectionState.selection = null;
            productionChart.draw();
        }
        if (window.fullChart && window.fullChart._selectionState && window.fullChart._selectionState.selection) {
            window.fullChart._selectionState.selection = null;
            window.fullChart.draw();
        }
    }
});

function createTimePickerUI(container, chart, scale, onClose) {
    injectDatePickerStyles();
    container.innerHTML = '';
    container.className = 'chart-settings-panel dp-container';
    container.style.flexDirection = 'row'; // Force row layout to put sidebar on left
    
    // State
    let startDate = new Date(scale.min);
    let endDate = new Date(scale.max);
    
    // View State (Calendars)
    let leftYear = startDate.getFullYear();
    let leftMonth = startDate.getMonth();
    let rightYear = endDate.getFullYear();
    let rightMonth = endDate.getMonth();

    // Ensure right calendar is at least one month ahead visually if same month
    if (leftYear === rightYear && leftMonth === rightMonth) {
        if (rightMonth === 11) { rightYear++; rightMonth = 0; }
        else { rightMonth++; }
    }

    // --- DOM Elements ---
    const sidebar = document.createElement('div');
    sidebar.className = 'dp-sidebar';
    
    const main = document.createElement('div');
    main.className = 'dp-main';

    container.appendChild(sidebar);
    container.appendChild(main);

    // --- Sidebar Presets ---
    const presets = [
        { label: 'Past hour', get: () => [Date.now() - 3600000, Date.now()] },
        { label: 'Past day', get: () => [Date.now() - 86400000, Date.now()] },
        { label: 'Past week', get: () => [Date.now() - 604800000, Date.now()] },
        { label: 'Past month', get: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return [d.getTime(), Date.now()]; } },
        { label: 'Past 3 months', get: () => { const d = new Date(); d.setMonth(d.getMonth() - 3); return [d.getTime(), Date.now()]; } },
        { label: 'Past 6 months', get: () => { const d = new Date(); d.setMonth(d.getMonth() - 6); return [d.getTime(), Date.now()]; } },
        { label: 'Past year', get: () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return [d.getTime(), Date.now()]; } },
        { label: 'Past 2 years', get: () => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return [d.getTime(), Date.now()]; } },
        { label: 'All Time', get: () => {
             // Find min/max from data
             let min = Infinity, max = -Infinity;
             chart.data.datasets.forEach(ds => {
                 ds.data.forEach((v, i) => {
                     const t = new Date(chart.data.labels[i]).getTime();
                     if (t < min) min = t;
                     if (t > max) max = t;
                 });
             });
             return [min, max];
        }}
    ];

    presets.forEach(p => {
        const btn = document.createElement('button');
        btn.textContent = p.label;
        btn.onclick = () => {
            const [start, end] = p.get();
            startDate = new Date(start);
            endDate = new Date(end);
            // Update view to show these dates
            leftYear = startDate.getFullYear();
            leftMonth = startDate.getMonth();
            rightYear = endDate.getFullYear();
            rightMonth = endDate.getMonth();
            if (leftYear === rightYear && leftMonth === rightMonth) {
                if (rightMonth === 11) { rightYear++; rightMonth = 0; }
                else { rightMonth++; }
            }
            render();
            // Apply immediately
            if (startDate < endDate) {
                chart.zoomScale(scale.id, {min: startDate.getTime(), max: endDate.getTime()}, 'default');
            }
        };
        sidebar.appendChild(btn);
    });

    // --- Main Content ---
    const calendarsDiv = document.createElement('div');
    calendarsDiv.className = 'dp-calendars';
    
    const timeRow = document.createElement('div');
    timeRow.className = 'dp-time-row';

    // Removed footer as requested
    // const footer = document.createElement('div');
    // footer.className = 'dp-footer';

    main.appendChild(calendarsDiv);
    main.appendChild(timeRow);
    // main.appendChild(footer);

    // --- Render Function ---
    function render() {
        calendarsDiv.innerHTML = '';
        timeRow.innerHTML = '';
        // footer.innerHTML = '';

        // Calendars
        calendarsDiv.appendChild(createCalendar(leftYear, leftMonth, 'left'));
        calendarsDiv.appendChild(createCalendar(rightYear, rightMonth, 'right'));

        // Time Inputs
        const createTimeInput = (date, onChange) => {
            const div = document.createElement('div');
            div.className = 'dp-time-input';
            
            const pad = n => n.toString().padStart(2, '0');
            const timeStr = `${pad(date.getHours())} : ${pad(date.getMinutes())} : ${pad(date.getSeconds())}`;
            
            // Simple text display for now, could be inputs
            // Let's make them editable inputs
            const hInput = document.createElement('input'); hInput.value = pad(date.getHours()); hInput.style.width = '20px'; hInput.style.border='none'; hInput.style.textAlign='center'; hInput.style.background='transparent'; hInput.style.color='inherit';
            const mInput = document.createElement('input'); mInput.value = pad(date.getMinutes()); mInput.style.width = '20px'; mInput.style.border='none'; mInput.style.textAlign='center'; mInput.style.background='transparent'; mInput.style.color='inherit';
            const sInput = document.createElement('input'); sInput.value = pad(date.getSeconds()); sInput.style.width = '20px'; sInput.style.border='none'; sInput.style.textAlign='center'; sInput.style.background='transparent'; sInput.style.color='inherit';

            const updateTime = () => {
                let h = parseInt(hInput.value) || 0; h = Math.max(0, Math.min(23, h));
                let m = parseInt(mInput.value) || 0; m = Math.max(0, Math.min(59, m));
                let s = parseInt(sInput.value) || 0; s = Math.max(0, Math.min(59, s));
                
                const newDate = new Date(date);
                newDate.setHours(h, m, s);
                onChange(newDate);
                
                // Apply immediately
                if (startDate < endDate) {
                    chart.zoomScale(scale.id, {min: startDate.getTime(), max: endDate.getTime()}, 'default');
                }
            };

            [hInput, mInput, sInput].forEach(inp => {
                inp.onchange = updateTime;
                inp.onfocus = () => inp.select();
            });

            div.appendChild(hInput);
            div.appendChild(document.createTextNode(':'));
            div.appendChild(mInput);
            div.appendChild(document.createTextNode(':'));
            div.appendChild(sInput);
            return div;
        };

        timeRow.appendChild(createTimeInput(startDate, (d) => { startDate = d; render(); }));
        timeRow.appendChild(createTimeInput(endDate, (d) => { endDate = d; render(); }));

        // Footer removed
    }

    function createCalendar(year, month, side) {
        const wrapper = document.createElement('div');
        wrapper.className = 'dp-calendar';
        
        // Header
        const header = document.createElement('div');
        header.className = 'dp-header';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'dp-nav-btn';
        prevBtn.textContent = '‹';
        prevBtn.onclick = () => {
            if (side === 'left') {
                leftMonth--; if(leftMonth<0){leftMonth=11; leftYear--;}
            } else {
                rightMonth--; if(rightMonth<0){rightMonth=11; rightYear--;}
            }
            render();
        };

        const nextBtn = document.createElement('button');
        nextBtn.className = 'dp-nav-btn';
        nextBtn.textContent = '›';
        nextBtn.onclick = () => {
            if (side === 'left') {
                leftMonth++; if(leftMonth>11){leftMonth=0; leftYear++;}
            } else {
                rightMonth++; if(rightMonth>11){rightMonth=0; rightYear++;}
            }
            render();
        };

        // Dropdowns
        const selectContainer = document.createElement('div');
        selectContainer.style.display = 'flex';
        selectContainer.style.gap = '5px';

        const monthSelect = document.createElement('select');
        monthSelect.className = 'dp-month-select';
        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        monthNames.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = m;
            if (i === month) opt.selected = true;
            monthSelect.appendChild(opt);
        });
        monthSelect.onchange = (e) => {
            const newMonth = parseInt(e.target.value);
            if (side === 'left') leftMonth = newMonth;
            else rightMonth = newMonth;
            render();
        };

        const yearSelect = document.createElement('select');
        yearSelect.className = 'dp-year-select';
        // Range: 1950 - 2050
        for (let y = 1950; y <= 2050; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            if (y === year) opt.selected = true;
            yearSelect.appendChild(opt);
        }
        yearSelect.onchange = (e) => {
            const newYear = parseInt(e.target.value);
            if (side === 'left') leftYear = newYear;
            else rightYear = newYear;
            render();
        };

        selectContainer.appendChild(monthSelect);
        selectContainer.appendChild(yearSelect);

        header.appendChild(prevBtn);
        header.appendChild(selectContainer);
        header.appendChild(nextBtn);
        wrapper.appendChild(header);

        // Grid
        const grid = document.createElement('div');
        grid.className = 'dp-grid';
        
        ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
            const el = document.createElement('div');
            el.className = 'dp-day-header';
            el.textContent = d;
            grid.appendChild(el);
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        // Prev Month Days
        for (let i = 0; i < firstDay; i++) {
            const d = daysInPrevMonth - firstDay + i + 1;
            const el = document.createElement('div');
            el.className = 'dp-cell other-month';
            el.textContent = d;
            grid.appendChild(el);
        }

        // Current Month Days
        for (let i = 1; i <= daysInMonth; i++) {
            const el = document.createElement('div');
            el.className = 'dp-cell';
            el.textContent = i;
            
            const currentTs = new Date(year, month, i).getTime();
            const startTs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
            const endTs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime();

            if (currentTs === startTs || currentTs === endTs) {
                el.classList.add('selected');
            } else if (currentTs > startTs && currentTs < endTs) {
                el.classList.add('in-range');
            }

            el.onclick = () => {
                const newDate = new Date(year, month, i);
                // Logic: if clicking, are we setting start or end?
                // Simple logic: if closer to start, set start. If closer to end, set end.
                // Or: Click once sets start, click again sets end (if > start).
                
                // Let's use the side to determine preference, or just standard range picker logic
                // Standard logic: If start is selected but end is not (or range is valid), 
                // actually, let's just say:
                // If we click on left calendar, we probably want to change start date? No, that's confusing.
                
                // Better logic:
                // If we click a date < startDate, it becomes new startDate.
                // If we click a date > endDate, it becomes new endDate.
                // If we click inside, it updates the nearest one.
                
                const newTs = newDate.getTime();
                const distToStart = Math.abs(newTs - startTs);
                const distToEnd = Math.abs(newTs - endTs);
                
                if (newTs < startTs) {
                    startDate = newDate;
                    startDate.setHours(0,0,0,0);
                } else if (newTs > endTs) {
                    endDate = newDate;
                    endDate.setHours(23,59,59,999);
                } else {
                    if (distToStart <= distToEnd) {
                        startDate = newDate;
                        // Keep time? Or reset? Let's keep time for now or reset to 00:00
                        // The screenshot shows specific times.
                    } else {
                        endDate = newDate;
                    }
                }
                render();
                
                // Apply immediately
                if (startDate < endDate) {
                    chart.zoomScale(scale.id, {min: startDate.getTime(), max: endDate.getTime()}, 'default');
                }
            };
            
            grid.appendChild(el);
        }

        wrapper.appendChild(grid);
        return wrapper;
    }

    render();
}

const axisHoverPlugin = {
    id: 'axisHover',
    beforeEvent: (chart, args) => {
        const {x, y} = args.event;
        if (args.event.type === 'mousedown') {
            chart.dragStartScale = null;
            Object.values(chart.scales).forEach(scale => {
                if (x >= scale.left && x <= scale.right && y >= scale.top && y <= scale.bottom) {
                    chart.dragStartScale = scale;
                }
            });
        } else if (args.event.type === 'mouseup') {
            chart.dragStartScale = null;
        }
    },
    afterEvent: (chart, args) => {
        if (args.event.type === 'mousemove') {
            const {x, y} = args.event;
            let found = false;
            Object.values(chart.scales).forEach(scale => {
                if (x >= scale.left && x <= scale.right && y >= scale.top && y <= scale.bottom) {
                    ZoomControlManager.show(chart, scale.id);
                    // Change cursor to indicate dragging
                    args.event.native.target.style.cursor = 'all-scroll';
                    found = true;
                }
            });
            if (!found) {
                ZoomControlManager.hideAll(chart);
                args.event.native.target.style.cursor = 'default';
            }
        } else if (args.event.type === 'mouseout') {
             ZoomControlManager.hideAll(chart);
             args.event.native.target.style.cursor = 'default';
        }
    }
};

// Global chart preferences to persist settings across wells
const chartPreferences = {
    lineColors: {},
    lineStyles: {},
    isInlineLegend: false,
    isSyncEnabled: true, // Default sync enabled
    extraCharts: [] // Store configurations for extra charts
};

function saveExtraChartsState() {
    chartPreferences.extraCharts = extraCharts.map(ec => {
        const chart = ec.chart;
        const items = chart.data.datasets.map((ds, i) => ({
            param: ds._param,
            label: ds.label,
            color: ds.borderColor,
            style: ds.borderDash,
            yAxisID: ds.yAxisID,
            axisPosition: chart.options.scales[ds.yAxisID]?.position,
            hidden: !chart.isDatasetVisible(i) // Save visibility state
        }));
        return {
            id: ec.container.id,
            items: items,
            isInlineLegend: chart.options.plugins.inlineLegend?.enabled || false
        };
    });
}

function syncCharts(sourceChart) {
    if (!chartPreferences.isSyncEnabled) return;
    const min = sourceChart.scales.x.min;
    const max = sourceChart.scales.x.max;
    
    // Sync production chart if it's not the source
    if (productionChart && productionChart !== sourceChart) {
        productionChart.options.scales.x.min = min;
        productionChart.options.scales.x.max = max;
        productionChart.update('none');
    }
    
    // Sync extra charts
    extraCharts.forEach(ec => {
        if (ec.chart !== sourceChart) {
            ec.chart.options.scales.x.min = min;
            ec.chart.options.scales.x.max = max;
            ec.chart.update('none');
        }
    });
}

async function showWellDetails(wellId) {
    let wellMarkers = []; // Reset markers for new well
    details_sidebar.show();
    
    const placeholder = document.getElementById('chart-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    
    const titleEl = document.getElementById('details-well-name');
    const controlsEl = document.getElementById('details-controls');
    const loadingEl = document.getElementById('details-loading');
    const errorEl = document.getElementById('details-error');
    const canvas = document.getElementById('productionChart');
    
    // NEW: Context Menu Listener
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.closeAllChartMenus();
        if (!productionChart) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const xValue = productionChart.scales.x.getValueForPixel(x);
        
        activeChartContext = { chart: productionChart, xValue };
        
        ctxMenu.style.left = `${e.clientX}px`;
        ctxMenu.style.top = `${e.clientY}px`;
        ctxMenu.style.display = 'block';
    });
    
    titleEl.textContent = `Well: ${wellId}`;
    controlsEl.innerHTML = ''; // Clear previous controls
    
    loadingEl.style.display = 'block';
    errorEl.style.display = 'none';
    
    // Clear previous chart
    if (productionChart) {
        productionChart.destroy();
        productionChart = null;
    }

    // Clear extra charts
    extraCharts.forEach(item => {
        if (item.chart) item.chart.destroy();
        if (item.container) item.container.remove();
    });
    extraCharts = [];
    document.getElementById('extra-charts-area').innerHTML = '';

    // Wait for Chart.js and plugins to load
    const waitForChart = async () => {
        let attempts = 0;
        while (typeof Chart === 'undefined' || typeof Hammer === 'undefined' || !Chart.registry?.plugins?.get('zoom')) {
            await new Promise(resolve => setTimeout(resolve, 200));
            attempts++;
            if (attempts > 25) return false; // 5 seconds timeout
        }
        return true;
    };

    if (!(await waitForChart())) {
         loadingEl.style.display = 'none';
         errorEl.textContent = "Chart library or plugins failed to load.";
         errorEl.style.display = 'block';
         return;
    }

    try {
        const res = await fetch(`/rates?well=${encodeURIComponent(wellId)}`);
        if (!res.ok) throw new Error("Failed to fetch rates");
        const data = await res.json();
        
        loadingEl.style.display = 'none';

        // Apply user formulas to the fetched well data
        if (typeof userFormulas !== 'undefined' && userFormulas.length > 0 && data.length > 0) {
            const keys = Object.keys(data[0]);
            const keyMap = {};
            keys.forEach(k => keyMap[k.toLowerCase()] = k);

            userFormulas.forEach(f => {
                try {
                    let parsedFormula = f.formula.replace(/[a-zA-Z_]\w*/g, (match) => {
                        const lower = match.toLowerCase();
                        if (keyMap.hasOwnProperty(lower)) {
                            const actualKey = keyMap[lower];
                            return `(parseFloat(row['${actualKey}']) || 0)`;
                        }
                        return match;
                    });
                    const evalFunc = new Function('row', `return ${parsedFormula};`);
                    
                    data.forEach(row => {
                        try {
                            const val = evalFunc(row);
                            row[f.name] = typeof val === 'number' ? Math.round(val * 100) / 100 : val;
                        } catch (e) {
                            row[f.name] = null;
                        }
                    });
                } catch (err) {
                    console.error('Error applying formula to well details:', err);
                }
            });
        }
        
        if (!data || data.length === 0) {
            errorEl.textContent = "No production data available.";
            errorEl.style.display = 'block';
            return;
        }

        // Restore extra charts - MOVED DOWN


        // Heuristic to find date and numeric columns
        const keys = Object.keys(data[0]);
        const dateKey = keys.find(k => /date|time/i.test(k)) || keys[0];
        
        // Identify rate columns
        const rateColumns = {
            'orate': 'Oil Rate',
            'wrate': 'Water Rate',
            'grate': 'Gas Rate'
        };
        
        // Filter available rate columns
        const availableRates = Object.keys(rateColumns).filter(k => keys.includes(k));
        
        // If no specific rate columns found, fallback to all numeric
        let valueKeys = availableRates.length > 0 
            ? availableRates 
            : keys.filter(k => k !== dateKey && typeof data[0][k] === 'number' && !/id|well/i.test(k));

        // NEW: Initialize line colors and styles
        const defaultColors = {
            'orate': '#2ecc71',
            'wrate': '#3498db',
            'grate': '#e74c3c'
        };
        
        // Use global preferences
        const lineColors = chartPreferences.lineColors;
        const lineStyles = chartPreferences.lineStyles;

        valueKeys.forEach((key, index) => {
             if (!lineColors[key]) {
                 lineColors[key] = defaultColors[key] || ['#f1c40f', '#9b59b6', '#95a5a6'][index % 3];
             }
             if (!lineStyles[key]) {
                 lineStyles[key] = 'solid';
             }
        });

        // NEW: Drop Handler for Main Chart
        const chartContainer = document.getElementById('details-chart-container');
        
        // Remove old listeners if any (by overwriting properties)
        chartContainer.ondragover = (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            chartContainer.style.border = '2px dashed #3498db';
        };

        chartContainer.ondragleave = () => {
            chartContainer.style.border = '';
        };

        chartContainer.ondrop = (e) => {
            e.preventDefault();
            chartContainer.style.border = '';
            
            try {
                const dataStr = e.dataTransfer.getData('application/json');
                if (!dataStr) return;
                
                const { param, label, color } = JSON.parse(dataStr);
                
                if (!valueKeys.includes(param)) {
                    valueKeys.push(param);
                    
                    // Ensure we have a color for it
                    if (color) {
                        lineColors[param] = color;
                    } else if (!lineColors[param]) {
                        // Try to find color from extra charts
                        const extraChartObj = extraCharts.find(ec => ec.param === param);
                        if (extraChartObj && extraChartObj.chart) {
                             lineColors[param] = extraChartObj.chart.data.datasets[0].borderColor;
                        } else {
                             lineColors[param] = '#' + Math.floor(Math.random()*16777215).toString(16);
                        }
                    }
                    
                    updateChart();
                }
            } catch (err) {
                console.error('Drop error', err);
            }
        };

        // Create checkboxes for rates
        // const selectedRates = new Set(valueKeys); // Default all selected

        // if (availableRates.length > 0) {
        //     availableRates.forEach(key => {
        //         const label = document.createElement('label');
        //         label.style.display = 'flex';
        //         label.style.alignItems = 'center';
        //         label.style.gap = '4px';
        //         label.style.fontSize = '12px';
        //         label.style.cursor = 'pointer';

        //         const checkbox = document.createElement('input');
        //         checkbox.type = 'checkbox';
        //         checkbox.checked = true;
        //         checkbox.value = key;
                
        //         checkbox.addEventListener('change', () => {
        //             if (checkbox.checked) selectedRates.add(key);
        //             else selectedRates.delete(key);
        //             updateChart();
        //         });

        //         label.appendChild(checkbox);
        //         label.appendChild(document.createTextNode(rateColumns[key]));
        //         controlsEl.appendChild(label);
        //     });
        // }

        // NEW: Toolbar for Main Chart
        const isDark = document.body.classList.contains('dark-theme');
        const themeTextColor = isDark ? '#ccc' : '#666';

        // NEW: Align Button in Header (controlsEl)
        const alignBtn = document.createElement('button');
        alignBtn.className = 'chart-header-btn';
        alignBtn.innerHTML = '<span style="font-size:14px; font-weight:bold;">↔</span> Align X Axes';
        alignBtn.title = 'Sync all plots to the main chart\'s time range';
        alignBtn.style.padding = '4px 10px';
        alignBtn.style.cursor = 'pointer';
        alignBtn.style.borderRadius = '4px';
        alignBtn.style.fontSize = '12px';
        alignBtn.style.display = 'flex';
        alignBtn.style.alignItems = 'center';
        alignBtn.style.gap = '6px';

        alignBtn.onclick = () => {
            if (!productionChart) return;
            
            const allCharts = [productionChart, ...extraCharts.map(ec => ec.chart)];

            // Check if already in selection mode
            if (alignBtn.dataset.selecting === 'true') {
                // Cancel selection
                if (alignBtn._alignHandler) {
                    allCharts.forEach(chart => {
                        chart.canvas.removeEventListener('click', alignBtn._alignHandler);
                        chart.canvas.style.cursor = '';
                    });
                }
                alignBtn.dataset.selecting = 'false';
                alignBtn.innerHTML = alignBtn._originalHTML || '<span style="font-size:14px; font-weight:bold;">↔</span> Align X Axes';
                alignBtn.style.background = '';
                alignBtn.style.color = '';
                alignBtn.style.borderColor = '';
                alignBtn._alignHandler = null;
                return;
            }
            
            // Enter selection mode
            alignBtn.dataset.selecting = 'true';
            alignBtn._originalHTML = alignBtn.innerHTML;
            alignBtn.innerHTML = 'Select a plot to align others... (Click to cancel)';
            alignBtn.style.background = '#fff3cd';
            alignBtn.style.color = '#856404';
            alignBtn.style.borderColor = '#ffeeba';

            const onChartClick = (e) => {
                const clickedCanvas = e.target;
                const refChart = allCharts.find(c => c.canvas === clickedCanvas);
                
                if (refChart) {
                    const targetMin = refChart.scales.x.min;
                    const targetMax = refChart.scales.x.max;
                    
                    allCharts.forEach(chart => {
                        chart.options.scales.x.min = targetMin;
                        chart.options.scales.x.max = targetMax;
                        chart.update();
                        // Update zoom controls if needed
                        const wrapper = chart.canvas.parentElement;
                        if (wrapper) ZoomControlManager.create(chart, wrapper);
                    });
                }
                
                // Cleanup
                allCharts.forEach(chart => {
                    chart.canvas.removeEventListener('click', onChartClick);
                    chart.canvas.style.cursor = '';
                });
                alignBtn.dataset.selecting = 'false';
                alignBtn.innerHTML = alignBtn._originalHTML;
                alignBtn.style.background = '';
                alignBtn.style.color = '';
                alignBtn.style.borderColor = '';
                alignBtn._alignHandler = null;
            };

            alignBtn._alignHandler = onChartClick;

            allCharts.forEach(chart => {
                chart.canvas.addEventListener('click', onChartClick);
                chart.canvas.style.cursor = 'crosshair';
            });
        };
        
        controlsEl.appendChild(alignBtn);

        // NEW: Sync Toggle Button
        const syncBtn = document.createElement('button');
        syncBtn.className = 'chart-header-btn';
        
        const updateSyncBtn = () => {
            const isEnabled = chartPreferences.isSyncEnabled;
            syncBtn.innerHTML = `Sync Pan: ${isEnabled ? 'ON' : 'OFF'}`;
            if (isEnabled) syncBtn.classList.add('active');
            else syncBtn.classList.remove('active');
        };
        
        syncBtn.title = 'Automatically sync panning across all plots';
        syncBtn.style.padding = '4px 10px';
        syncBtn.style.cursor = 'pointer';
        syncBtn.style.borderRadius = '4px';
        syncBtn.style.fontSize = '12px';
        syncBtn.style.display = 'flex';
        syncBtn.style.alignItems = 'center';
        syncBtn.style.gap = '6px';
        syncBtn.style.marginLeft = '5px';
        
        updateSyncBtn();

        syncBtn.onclick = () => {
            chartPreferences.isSyncEnabled = !chartPreferences.isSyncEnabled;
            updateSyncBtn();
        };
        
        controlsEl.appendChild(syncBtn);

        // Remove existing toolbar if any
        const existingToolbar = chartContainer.querySelector('.main-chart-toolbar');
        if (existingToolbar) existingToolbar.remove();

        const toolbar = document.createElement('div');
        toolbar.className = 'main-chart-toolbar';
        toolbar.style.position = 'absolute';
        toolbar.style.top = '2px';
        toolbar.style.right = '2px';
        toolbar.style.zIndex = '10';
        toolbar.style.display = 'flex';
        toolbar.style.gap = '4px';
        toolbar.style.alignItems = 'center';
        
        // Ensure container is relative
        if (getComputedStyle(chartContainer).position === 'static') {
            chartContainer.style.position = 'relative';
        }

        // Full View Button
        const fullViewBtn = document.createElement('button');
        fullViewBtn.className = 'chart-toolbar-btn';
        fullViewBtn.innerHTML = '⤢';
        fullViewBtn.title = 'Full View';
        fullViewBtn.style.background = 'none';
        fullViewBtn.style.border = 'none';
        // fullViewBtn.style.color = themeTextColor; // Handled by CSS class
        fullViewBtn.style.cursor = 'pointer';
        fullViewBtn.style.fontSize = '14px';
        fullViewBtn.onclick = () => openFullViewChart();
        toolbar.appendChild(fullViewBtn);

        // Settings Button
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'chart-toolbar-btn';
        settingsBtn.innerHTML = '⚙';
        settingsBtn.title = 'Chart Settings';
        settingsBtn.style.background = 'none';
        settingsBtn.style.border = 'none';
        // settingsBtn.style.color = themeTextColor; // Handled by CSS class
        settingsBtn.style.cursor = 'pointer';
        settingsBtn.style.fontSize = '14px';
        
        toolbar.appendChild(settingsBtn);
        chartContainer.appendChild(toolbar);

        // NEW: Left Axis Drawer
        const existingDrawer = chartContainer.querySelector('.axis-drawer-toggle');
        if (existingDrawer) existingDrawer.remove();

        const drawerToggle = document.createElement('div');
        drawerToggle.className = 'axis-drawer-toggle';
        Object.assign(drawerToggle.style, {
            position: 'absolute',
            left: '0',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '40px',
            borderLeft: 'none',
            borderTopRightRadius: '4px',
            borderBottomRightRadius: '4px',
            cursor: 'pointer',
            zIndex: '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
            userSelect: 'none'
        });

        let areLeftAxesVisible = true;
        drawerToggle.innerHTML = '‹';
        drawerToggle.title = 'Toggle Left Axes';

        drawerToggle.onclick = () => {
            if (!productionChart) return;
            
            areLeftAxesVisible = !areLeftAxesVisible;
            drawerToggle.innerHTML = areLeftAxesVisible ? '‹' : '›';
            
            Object.values(productionChart.options.scales).forEach(scale => {
                if (scale.position === 'left' && scale.axis === 'y') {
                    scale.display = areLeftAxesVisible ? 'auto' : false;
                }
            });
            productionChart.update();
        };

        chartContainer.appendChild(drawerToggle);

        // NEW: Right Axis Drawer
        const existingRightDrawer = chartContainer.querySelector('.axis-drawer-toggle-right');
        if (existingRightDrawer) existingRightDrawer.remove();

        const rightDrawerToggle = document.createElement('div');
        rightDrawerToggle.className = 'axis-drawer-toggle-right';
        Object.assign(rightDrawerToggle.style, {
            position: 'absolute',
            right: '0',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '12px',
            height: '40px',
            borderRight: 'none',
            borderTopLeftRadius: '4px',
            borderBottomLeftRadius: '4px',
            cursor: 'pointer',
            zIndex: '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            boxShadow: '-2px 0 4px rgba(0,0,0,0.1)',
            userSelect: 'none'
        });

        let areRightAxesVisible = true;
        rightDrawerToggle.innerHTML = '›';
        rightDrawerToggle.title = 'Toggle Right Axes';

        rightDrawerToggle.onclick = () => {
            if (!productionChart) return;
            
            areRightAxesVisible = !areRightAxesVisible;
            rightDrawerToggle.innerHTML = areRightAxesVisible ? '›' : '‹';
            
            Object.values(productionChart.options.scales).forEach(scale => {
                if (scale.position === 'right' && scale.axis === 'y') {
                    scale.display = areRightAxesVisible ? 'auto' : false;
                }
            });
            productionChart.update();
        };

        chartContainer.appendChild(rightDrawerToggle);
        
        let settingsPanel = null;
        let isInlineLegend = chartPreferences.isInlineLegend; // State for inline legend

        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            const isOpen = settingsPanel && document.body.contains(settingsPanel);
            window.closeAllChartMenus();

            if (isOpen) {
                settingsPanel = null;
                return;
            }
            
            settingsPanel = document.createElement('div');
            settingsPanel.className = 'chart-settings-panel';
            Object.assign(settingsPanel.style, {
                position: 'fixed',
                right: '20px', // Align to right side
                top: (e.clientY + 20) + 'px',
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '150px'
            });
            
            const title = document.createElement('div');
            title.textContent = 'Chart Settings';
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '5px';
            title.style.fontSize = '12px';
            settingsPanel.appendChild(title);

            // Inline Legend Toggle
            const legendRow = document.createElement('div');
            legendRow.style.display = 'flex';
            legendRow.style.alignItems = 'center';
            legendRow.style.justifyContent = 'space-between';
            legendRow.style.marginBottom = '5px';
            
            const legendLabel = document.createElement('span');
            legendLabel.textContent = 'Inline Legend';
            legendLabel.style.fontSize = '12px';
            
            const legendToggle = document.createElement('input');
            legendToggle.type = 'checkbox';
            legendToggle.checked = isInlineLegend;
            legendToggle.onchange = (e) => {
                isInlineLegend = e.target.checked;
                chartPreferences.isInlineLegend = isInlineLegend; // Save preference
                updateChart();
            };
            
            legendRow.appendChild(legendLabel);
            legendRow.appendChild(legendToggle);
            settingsPanel.appendChild(legendRow);

            valueKeys.forEach(key => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.gap = '10px';
                
                const label = document.createElement('span');
                label.textContent = rateColumns[key] || key;
                label.style.fontSize = '12px';
                label.style.flexGrow = '1';
                
                // Color Picker
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = lineColors[key];
                colorInput.style.border = 'none';
                colorInput.style.width = '20px';
                colorInput.style.height = '20px';
                colorInput.style.cursor = 'pointer';
                colorInput.style.padding = '0';
                colorInput.style.backgroundColor = 'transparent';
                
                colorInput.addEventListener('input', (e) => {
                    lineColors[key] = e.target.value;
                    updateChart();
                });

                // Style Selector
                const styleSelect = document.createElement('select');
                styleSelect.style.fontSize = '11px';
                styleSelect.style.padding = '1px';
                
                const styles = [
                    { value: 'solid', text: 'Solid' },
                    { value: 'dashed', text: 'Dashed' },
                    { value: 'dotted', text: 'Dotted' },
                    { value: 'dashdot', text: 'Dash-Dot' }
                ];
                
                styles.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.value;
                    opt.textContent = s.text;
                    if (lineStyles[key] === s.value) opt.selected = true;
                    styleSelect.appendChild(opt);
                });
                
                styleSelect.addEventListener('change', (e) => {
                    lineStyles[key] = e.target.value;
                    updateChart();
                });
                
                row.appendChild(label);
                row.appendChild(styleSelect);
                row.appendChild(colorInput);
                settingsPanel.appendChild(row);
            });
            
            document.body.appendChild(settingsPanel);
            
            const closeHandler = (evt) => {
                if (settingsPanel && !settingsPanel.contains(evt.target) && evt.target !== settingsBtn) {
                    settingsPanel.remove();
                    settingsPanel = null;
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);
        };
        
        // Sort by date
        data.sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
        
        const labels = data.map(d => {
            const date = new Date(d[dateKey]);
            return isNaN(date) ? d[dateKey] : date.toISOString().split('T')[0];
        });

        // Restore extra charts
        if (chartPreferences.extraCharts && chartPreferences.extraCharts.length > 0) {
            chartPreferences.extraCharts.forEach(config => {
                createExtraChart(config.items, null, config.id, { isInlineLegend: config.isInlineLegend });
            });
        }

        function getChartData() {
            // const activeKeys = valueKeys.filter(k => selectedRates.has(k));
            return valueKeys.map((key, index) => {
                const color = lineColors[key];
                const style = lineStyles[key];
                let borderDash = [];
                
                if (style === 'dashed') borderDash = [5, 5];
                else if (style === 'dotted') borderDash = [2, 2];
                else if (style === 'dashdot') borderDash = [10, 5, 2, 5];

                let yAxisID = 'y'; // Default

                if (key === 'orate') {
                    yAxisID = 'y-oil';
                }
                else if (key === 'wrate') {
                    yAxisID = 'y-water';
                }
                else if (key === 'grate') {
                    yAxisID = 'y-gas';
                }
                else {
                    yAxisID = 'y';
                }

                return {
                    label: rateColumns[key] || key,
                    data: data.map(d => d[key]),
                    borderColor: color,
                    backgroundColor: 'transparent',
                    pointBackgroundColor: color,
                    borderWidth: 2,
                    borderDash: borderDash,
                    tension: 0,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    yAxisID: yAxisID,
                    _param: key // Store param for drag-and-drop
                };
            });
        }

        function openFullViewChart() {
            let modal = document.getElementById('chart-modal');
            const isDark = document.body.classList.contains('dark-theme');

            const closeFullView = () => {
                // NEW: Sync zoom state back to small chart
                if (window.fullChart && productionChart) {
                    const xMin = window.fullChart.scales.x.min;
                    const xMax = window.fullChart.scales.x.max;
                    
                    // Apply to production chart
                    if (xMin !== undefined && xMax !== undefined) {
                        productionChart.zoomScale('x', {min: xMin, max: xMax}, 'none');
                    } else {
                        productionChart.resetZoom();
                    }
                }

                const m = document.getElementById('chart-modal');
                if (m) m.style.display = 'none';
                if (window.fullChart) {
                    window.fullChart.destroy();
                    window.fullChart = null;
                }
                document.removeEventListener('keydown', escHandler);
            };

            const escHandler = (e) => {
                if (e.key === 'Escape') closeFullView();
            };

            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'chart-modal';
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100vw';
                modal.style.height = '100vh';
                modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
                modal.style.zIndex = '9999';
                modal.style.display = 'flex';
                modal.style.justifyContent = 'center';
                modal.style.alignItems = 'center';
                
                const container = document.createElement('div');
                container.className = 'chart-full-view-container';
                Object.assign(container.style, {
                    width: '90%',
                    height: '90%',
                    borderRadius: '8px',
                    padding: '20px',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: isDark ? '#2b2b2b' : 'white'
                });
                
                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.marginBottom = '10px';

                const title = document.createElement('h3');
                title.textContent = `Well: ${wellId} - Full View`;
                title.style.margin = '0';
                title.style.color = isDark ? '#ccc' : '#333';

                const closeBtn = document.createElement('button');
                closeBtn.className = 'chart-close-btn';
                closeBtn.textContent = '×';
                closeBtn.style.fontSize = '24px';
                closeBtn.style.border = 'none';
                closeBtn.style.background = 'none';
                closeBtn.style.cursor = 'pointer';
                closeBtn.style.lineHeight = '1';
                closeBtn.style.color = isDark ? '#ccc' : '#333';
                
                header.appendChild(title);
                header.appendChild(closeBtn);

                const chartWrapper = document.createElement('div');
                chartWrapper.style.flexGrow = '1';
                chartWrapper.style.position = 'relative';

                const canvas = document.createElement('canvas');
                canvas.id = 'full-production-chart';

                // NEW: Time Config Button
                const timeBtn = document.createElement('button');
                timeBtn.className = 'chart-action-btn';
                timeBtn.innerHTML = 'Time ⚙';
                Object.assign(timeBtn.style, {
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    zIndex: '10',
                    fontSize: '12px',
                    padding: '4px 8px'
                });
                timeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.fullChart) showAxisConfig(window.fullChart, 'x', e);
                };
                chartWrapper.appendChild(timeBtn);
                
                // NEW: Context Menu Listener for Full View
                canvas.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.closeAllChartMenus();
                    if (!window.fullChart) return;
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const xValue = window.fullChart.scales.x.getValueForPixel(x);
                    
                    activeChartContext = { chart: window.fullChart, xValue };
                    
                    ctxMenu.style.left = `${e.clientX}px`;
                    ctxMenu.style.top = `${e.clientY}px`;
                    ctxMenu.style.display = 'block';
                });

                chartWrapper.appendChild(canvas);
                container.appendChild(header);
                container.appendChild(chartWrapper);
                modal.appendChild(container);
                document.body.appendChild(modal);
            } else {
                // Update existing modal styles
                const container = modal.querySelector('.chart-full-view-container');
                if (container) container.style.backgroundColor = isDark ? '#2b2b2b' : 'white';
                
                const closeBtn = modal.querySelector('.chart-close-btn');
                if (closeBtn) closeBtn.style.color = isDark ? '#ccc' : '#333';
                
                const title = modal.querySelector('h3');
                if (title) {
                    title.textContent = `Well: ${wellId} - Full View`;
                    title.style.color = isDark ? '#ccc' : '#333';
                }
            }
            
            // Attach handlers
            const closeBtn = modal.querySelector('.chart-close-btn');
            if (closeBtn) closeBtn.onclick = closeFullView;
            document.addEventListener('keydown', escHandler);
            
            modal.style.display = 'flex';
            
            const ctx = document.getElementById('full-production-chart').getContext('2d');
            if (window.fullChart) window.fullChart.destroy();
            
            // Remove existing controls
            const chartWrapper = document.getElementById('full-production-chart').parentElement;
            chartWrapper.querySelectorAll('.axis-zoom-control').forEach(el => el.remove());

            const themeColors = getThemeColors();

            // Capture current scale ranges from productionChart
            const scaleRanges = {};
            const fullViewScales = {
                x: {
                    type: 'time',
                    time: { tooltipFormat: 'yyyy-MM-dd' },
                    display: true,
                    ticks: { color: themeColors.textColor },
                    grid: { color: themeColors.gridColor }
                }
            };

            if (productionChart) {
                Object.values(productionChart.scales).forEach(scale => {
                    if ((scale.axis === 'x' || scale.axis === 'y') && !isNaN(scale.min) && !isNaN(scale.max)) {
                        scaleRanges[scale.id] = { min: scale.min, max: scale.max };
                    }
                });

                // Build scales dynamically to preserve positions
                Object.keys(productionChart.options.scales).forEach(key => {
                    const srcScale = productionChart.options.scales[key];
                    if (key === 'x') {
                        fullViewScales.x.position = srcScale.position;
                    } else {
                        fullViewScales[key] = {
                            type: srcScale.type || 'linear',
                            display: srcScale.display,
                            position: srcScale.position,
                            title: { 
                                display: srcScale.title?.display, 
                                text: srcScale.title?.text, 
                                color: srcScale.title?.color 
                            },
                            grid: { 
                                drawOnChartArea: srcScale.grid?.drawOnChartArea, 
                                color: themeColors.gridColor 
                            },
                            ticks: { color: themeColors.textColor }
                        };
                    }
                });
            }

            window.fullChart = new Chart(ctx, {
                type: 'line',
                plugins: [markerPlugin, cursorPlugin, axisHoverPlugin, selectionPlugin, inlineLegendPlugin], // Add plugin
                data: { labels: labels, datasets: getChartData() },
                options: {
                    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'mousedown', 'mouseup', 'pointerdown', 'pointermove', 'pointerup'],
                    responsive: true,
                    maintainAspectRatio: false,
                    elements: {
                        line: {
                            tension: 0
                        }
                    },
                    layout: {
                        padding: { right: isInlineLegend ? 80 : 0 }
                    },
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { 
                            display: !isInlineLegend,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                boxWidth: 6,
                                color: themeColors.textColor
                            }
                        },
                        inlineLegend: { enabled: isInlineLegend },
                        tooltip: { mode: 'index', intersect: false },
                        zoom: {
                            pan: {
                                enabled: true,
                                overScaleMode: 'xy',
                                onPanStart: ({chart}) => {
                                    return !!chart.dragStartScale;
                                },
                                mode: 'xy',
                            },
                            zoom: {
                                wheel: { enabled: false },
                                pinch: { enabled: true },
                                drag: {
                                    enabled: false, // Disable default drag zoom
                                    backgroundColor: 'rgba(54, 162, 235, 0.3)'
                                },
                                mode: 'xy'
                            }
                        }
                    },
                    scales: fullViewScales
                }
            });
            window.fullChart._markers = wellMarkers; // Sync markers
            
            // Apply initial zoom for all captured scales
            Object.keys(scaleRanges).forEach(scaleId => {
                if (window.fullChart.scales[scaleId]) {
                    window.fullChart.zoomScale(scaleId, scaleRanges[scaleId], 'none');
                }
            });

            ZoomControlManager.create(window.fullChart, chartWrapper);
            updateDrawerVisibility(window.fullChart, chartWrapper);
        }

        // Assign click handler for Add Plot button
        const addPlotBtn = document.getElementById('add-plot-btn');
        if (addPlotBtn) addPlotBtn.onclick = showAddPlotDialog;

        function showAddPlotDialog() {
            const isDark = document.body.classList.contains('dark-theme');
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'chart-modal';
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100%';
            modal.style.height = '100%';
            modal.style.backgroundColor = 'rgba(0,0,0,0.4)';
            modal.style.display = 'flex';
            modal.style.justifyContent = 'center';
            modal.style.alignItems = 'center';
            modal.style.zIndex = '10000'; // Ensure it's on top
            
            const container = document.createElement('div');
            container.className = 'chart-modal-content';
            container.style.width = '280px';
            container.style.backgroundColor = isDark ? '#2b2b2b' : 'white';
            container.style.borderRadius = '6px';
            container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            container.style.overflow = 'hidden';
            container.style.color = isDark ? '#eee' : '#333';
            
            const header = document.createElement('div');
            header.style.padding = '10px 15px';
            header.style.borderBottom = isDark ? '1px solid #444' : '1px solid #f0f0f0';
            header.style.display = 'flex';
            header.style.justifyContent = 'space-between';
            header.style.alignItems = 'center';
            header.innerHTML = `
                <span style="font-weight:600; font-size:13px; color:${isDark ? '#eee' : '#333'};">Add Plot</span>
                <button class="chart-close-btn" style="background:none; border:none; font-size:18px; cursor:pointer; color:${isDark ? '#aaa' : '#999'}; padding:0; line-height:1;">&times;</button>
            `;
            
            const body = document.createElement('div');
            body.style.padding = '15px';
            body.style.display = 'flex';
            body.style.flexDirection = 'column';
            body.style.gap = '10px';

            // Parameter Selection
            const listContainer = document.createElement('div');
            listContainer.style.maxHeight = '200px';
            listContainer.style.overflowY = 'auto';
            listContainer.style.border = isDark ? '1px solid #555' : '1px solid #ddd';
            listContainer.style.borderRadius = '4px';
            listContainer.style.padding = '5px';
            listContainer.style.backgroundColor = isDark ? '#1e1e1e' : 'white';
            
            // Available parameters from rates data
            // Use keys from data[0]
            const allKeys = Object.keys(data[0]);
            const availableParams = allKeys.filter(k => {
                // Exclude standard non-numeric columns
                if (['date', 'Date', 'well', 'Well', 'id', 'ID'].includes(k)) return false;
                
                // Always include user formulas
                if (typeof userFormulas !== 'undefined' && userFormulas.some(f => f.name === k)) return true;
                
                // For others, check if numeric
                return typeof data[0][k] === 'number';
            });
            
            // Add specific labels if known
            const paramLabels = {
                'orate': 'Oil Rate',
                'wrate': 'Water Rate',
                'grate': 'Gas Rate',
                'gor': 'GOR',
                'wcut': 'Water Cut',
                'pressure': 'Pressure'
            };

            availableParams.forEach(p => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.gap = '8px';
                row.style.padding = '4px';
                row.style.cursor = 'pointer';
                
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.value = p;
                cb.id = 'cb-' + p;
                cb.style.cursor = 'pointer';
                
                const lbl = document.createElement('label');
                lbl.htmlFor = 'cb-' + p;
                lbl.textContent = paramLabels[p] || capitalize(p);
                lbl.style.fontSize = '13px';
                lbl.style.cursor = 'pointer';
                lbl.style.color = isDark ? '#eee' : '#333';
                
                row.appendChild(cb);
                row.appendChild(lbl);
                
                // Allow clicking row to toggle
                row.onclick = (e) => {
                    if (e.target !== cb && e.target !== lbl) {
                        cb.checked = !cb.checked;
                    }
                };
                
                listContainer.appendChild(row);
            });
            
            body.appendChild(listContainer);

            // Add Button
            const addBtn = document.createElement('button');
            addBtn.textContent = 'Add';
            addBtn.style.padding = '6px 12px';
            addBtn.style.backgroundColor = '#3498db';
            addBtn.style.color = 'white';
            addBtn.style.border = 'none';
            addBtn.style.borderRadius = '4px';
            addBtn.style.cursor = 'pointer';
            addBtn.style.fontSize = '13px';
            addBtn.style.alignSelf = 'flex-end';
            addBtn.onclick = () => {
                const selected = [];
                listContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
                    selected.push({
                        param: cb.value,
                        label: paramLabels[cb.value] || capitalize(cb.value)
                    });
                });
                
                if (selected.length > 0) {
                    const id = 'chart-' + Date.now();
                    // chartPreferences.extraCharts.push({ id: id, items: selected }); // Removed as saveExtraChartsState will handle it
                    createExtraChart(selected, null, id);
                    saveExtraChartsState(); // Save state after adding new chart
                    document.body.removeChild(modal);
                }
            };

            body.appendChild(addBtn);
            
            container.appendChild(header);
            container.appendChild(body);
            modal.appendChild(container);
            document.body.appendChild(modal);

            // Close handlers
            const closeBtn = header.querySelector('.chart-close-btn');
            closeBtn.onclick = () => document.body.removeChild(modal);
            modal.onclick = (e) => {
                if (e.target === modal) document.body.removeChild(modal);
            };
        }

        function updateChartTags(wrapper, chart) {
            let tagsContainer = wrapper.querySelector('.chart-tags-container');
            if (!tagsContainer) {
                tagsContainer = document.createElement('div');
                tagsContainer.className = 'chart-tags-container';
                tagsContainer.style.position = 'absolute';
                tagsContainer.style.top = '2px';
                tagsContainer.style.left = '5px';
                tagsContainer.style.zIndex = '10';
                tagsContainer.style.display = 'flex';
                tagsContainer.style.gap = '4px';
                wrapper.appendChild(tagsContainer);
            }
            
            tagsContainer.innerHTML = '';
            
            chart.data.datasets.forEach((ds, index) => {
                const tag = document.createElement('div');
                tag.className = 'chart-series-tag';
                tag.title = 'Drag to move this series';
                
                const colorBox = document.createElement('span');
                colorBox.style.width = '8px';
                colorBox.style.height = '8px';
                colorBox.style.backgroundColor = ds.borderColor;
                colorBox.style.marginRight = '4px';
                colorBox.style.borderRadius = '50%';
                
                const label = document.createElement('span');
                label.textContent = ds.label;
                
                const handle = document.createElement('span');
                handle.innerHTML = '&#10021;'; // ✥
                handle.style.marginLeft = '4px';
                handle.style.opacity = '0.6';

                const removeBtn = document.createElement('span');
                removeBtn.innerHTML = '&times;';
                removeBtn.style.marginLeft = '4px';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.fontWeight = 'bold';
                removeBtn.title = 'Remove this series';
                removeBtn.onclick = (e) => {
                    e.stopPropagation(); // Prevent drag start if clicked
                    
                    // Remove dataset
                    chart.data.datasets.splice(index, 1);
                    
                    // Remove scale if unused
                    if (ds.yAxisID && ds.yAxisID !== 'y') {
                        // Check if any other dataset uses this scale
                        const isUsed = chart.data.datasets.some(d => d.yAxisID === ds.yAxisID);
                        if (!isUsed) {
                            delete chart.options.scales[ds.yAxisID];
                        }
                    }
                    
                    // If chart empty (and it's an extra chart), remove it
                    if (chart.data.datasets.length === 0 && wrapper.id.startsWith('chart-wrapper-')) {
                         wrapper.remove();
                         const idx = extraCharts.findIndex(c => c.chart === chart);
                         if (idx > -1) extraCharts.splice(idx, 1);
                    } else {
                        chart.update();
                        updateChartTags(wrapper, chart);
                        // Re-create zoom controls to reflect scale changes
                        ZoomControlManager.create(chart, wrapper);
                    }
                    saveExtraChartsState(); // Save state after removal
                };
                
                tag.appendChild(colorBox);
                tag.appendChild(label);
                tag.appendChild(handle);
                tag.appendChild(removeBtn);
                
                tag.draggable = true;
                tag.addEventListener('dragstart', (e) => {
                    // Use stored param
                    const param = ds._param;
                    
                    if (param) {
                        e.dataTransfer.setData('application/json', JSON.stringify({ 
                            param: param, 
                            label: ds.label,
                            sourceId: wrapper.id,
                            color: ds.borderColor
                        }));
                        e.dataTransfer.effectAllowed = 'move';
                        tag.style.opacity = '0.5';
                    }
                });
                tag.addEventListener('dragend', () => {
                    tag.style.opacity = '1';
                });
                
                tagsContainer.appendChild(tag);
            });
        }


        function createExtraChart(paramOrItems, label, savedId, options = {}) {
            const container = document.getElementById('extra-charts-area');
            const themeColors = getThemeColors();
            const isDark = document.body.classList.contains('dark-theme');
            
            const defaultParamColors = {
                'orate': '#2ecc71',
                'wrate': '#3498db',
                'grate': '#e74c3c'
            };

            // Normalize input to array of items
            let items = [];
            if (Array.isArray(paramOrItems)) {
                items = paramOrItems;
            } else {
                items = [{ param: paramOrItems, label: label }];
            }
            
            if (items.length === 0) return;

            const wrapper = document.createElement('div');
            wrapper.id = savedId || ('chart-wrapper-' + Date.now() + '-' + Math.floor(Math.random() * 1000));
            wrapper.className = 'chart-wrapper';
            wrapper.style.height = '300px';
            wrapper.style.marginBottom = '10px';
            wrapper.style.position = 'relative';
            wrapper.style.border = isDark ? '1px solid #444' : '1px solid #eee';
            wrapper.style.borderRadius = '4px';
            wrapper.style.padding = '5px';
            wrapper.style.backgroundColor = isDark ? '#2b2b2b' : '#fff';
            
            // Make resizable
            wrapper.style.resize = 'vertical';
            wrapper.style.overflow = 'hidden';
            wrapper.style.minHeight = '100px';

            // Reordering Logic
            wrapper.draggable = false; // Disabled by default, enabled via handle
            
            wrapper.ondragstart = (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/json', JSON.stringify({
                    type: 'chart-reorder',
                    id: wrapper.id
                }));
                wrapper.classList.add('dragging');
                setTimeout(() => wrapper.style.opacity = '0.5', 0);
            };
            wrapper.ondragend = (e) => {
                wrapper.classList.remove('dragging');
                wrapper.style.opacity = '1';
                wrapper.style.border = isDark ? '1px solid #444' : '1px solid #eee';
                wrapper.draggable = false; // Reset
            };

            // Drop Target Logic
            wrapper.ondragover = (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                wrapper.style.border = '2px dashed #3498db';
            };
            wrapper.ondragleave = (e) => {
                wrapper.style.border = isDark ? '1px solid #444' : '1px solid #eee';
            };
            wrapper.ondrop = (e) => {
                e.preventDefault();
                wrapper.style.border = isDark ? '1px solid #444' : '1px solid #eee';
                try {
                    const dataStr = e.dataTransfer.getData('application/json');
                    if (!dataStr) return;
                    const dragData = JSON.parse(dataStr);

                    // Handle Chart Reordering
                    if (dragData.type === 'chart-reorder') {
                        const draggedId = dragData.id;
                        if (draggedId === wrapper.id) return;
                        
                        const draggedWrapper = document.getElementById(draggedId);
                        if (draggedWrapper) {
                            const container = document.getElementById('extra-charts-area');
                            const bounding = wrapper.getBoundingClientRect();
                            const offset = bounding.y + (bounding.height / 2);
                            
                            if (e.clientY - offset > 0) {
                                wrapper.after(draggedWrapper);
                            } else {
                                wrapper.before(draggedWrapper);
                            }
                            
                            // Sync extraCharts array order
                            const newOrder = [];
                            Array.from(container.children).forEach(child => {
                                const entry = extraCharts.find(ec => ec.container === child);
                                if (entry) newOrder.push(entry);
                            });
                            extraCharts.length = 0;
                            extraCharts.push(...newOrder);
                            
                            saveExtraChartsState();
                        }
                        return;
                    }

                    const { param: droppedParam, label: droppedLabel, sourceId, color: droppedColor } = dragData;
                    
                    // Prevent dropping on itself
                    if (sourceId === wrapper.id) return;

                    // Check if already exists
                    if (chart.data.datasets.some(ds => ds.label === droppedLabel)) return;
                    
                    // Get data
                    const newData = data.map(d => d[droppedParam]);
                    
                    // Create new Y-axis ID
                    const newAxisId = 'y-' + droppedParam + '-' + Date.now();
                    
                    // Determine axis position (default left)
                    const position = 'left';

                    // Add new scale
                    const axisColor = droppedColor || lineColors[droppedParam] || defaultParamColors[droppedParam] || themeColors.textColor;
                    chart.options.scales[newAxisId] = {
                        type: 'linear',
                        display: true,
                        position: position,
                        title: { display: true, text: droppedLabel, color: axisColor, font: { size: 10 } },
                        grid: { drawOnChartArea: false, color: themeColors.gridColor },
                        ticks: { color: axisColor, font: { size: 10 } }
                    };

                    // Add dataset
                    chart.data.datasets.push({
                        label: droppedLabel,
                        data: newData,
                        borderColor: droppedColor || lineColors[droppedParam] || defaultParamColors[droppedParam] || '#' + Math.floor(Math.random()*16777215).toString(16),
                        backgroundColor: 'transparent',
                        borderWidth: 1.5,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0,
                        yAxisID: newAxisId,
                        _param: droppedParam // Store param for future drags
                    });
                    chart.update();
                    updateChartTags(wrapper, chart);
                    
                    // Delay creation of zoom controls to ensure chart scales are fully updated
                    setTimeout(() => {
                        ZoomControlManager.create(chart, wrapper);
                        updateDrawerVisibility(chart, wrapper); // Update drawers
                        saveExtraChartsState(); // Save state after drop
                    }, 100);

                    // Remove from source
                    if (sourceId) {
                        const sourceWrapper = document.getElementById(sourceId);
                        if (sourceWrapper) {
                            // Handle Main Production Chart
                            if (sourceId === 'details-chart-container' && typeof productionChart !== 'undefined' && productionChart) {
                                const dsIndex = productionChart.data.datasets.findIndex(ds => ds.label === droppedLabel);
                                if (dsIndex > -1) {
                                    const removedDs = productionChart.data.datasets.splice(dsIndex, 1)[0];
                                    if (removedDs.yAxisID && removedDs.yAxisID !== 'y') {
                                         const isUsed = productionChart.data.datasets.some(d => d.yAxisID === removedDs.yAxisID);
                                         if (!isUsed) delete productionChart.options.scales[removedDs.yAxisID];
                                    }
                                    productionChart.update();
                                    updateChartTags(sourceWrapper, productionChart);
                                    setTimeout(() => {
                                        ZoomControlManager.create(productionChart, sourceWrapper);
                                        updateDrawerVisibility(productionChart, sourceWrapper);
                                    }, 100);
                                }
                            }

                            const sourceEntry = extraCharts.find(ec => ec.container === sourceWrapper);
                            if (sourceEntry) {
                                const sourceChart = sourceEntry.chart;
                                const dsIndex = sourceChart.data.datasets.findIndex(ds => ds.label === droppedLabel);
                                if (dsIndex > -1) {
                                    // Remove dataset
                                    const removedDs = sourceChart.data.datasets.splice(dsIndex, 1)[0];
                                    // Remove associated scale if it exists and is not 'y'
                                    if (removedDs.yAxisID && removedDs.yAxisID !== 'y') {
                                        delete sourceChart.options.scales[removedDs.yAxisID];
                                    }
                                    
                                    if (sourceChart.data.datasets.length === 0) {
                                        // Remove chart if empty
                                        sourceWrapper.remove();
                                        const idx = extraCharts.findIndex(c => c === sourceEntry);
                                        if (idx > -1) {
                                            sourceChart.destroy();
                                            extraCharts.splice(idx, 1);
                                        }
                                    } else {
                                        sourceChart.update();
                                        updateChartTags(sourceWrapper, sourceChart);
                                        setTimeout(() => {
                                            ZoomControlManager.create(sourceChart, sourceWrapper);
                                            updateDrawerVisibility(sourceChart, sourceWrapper); // Update drawers
                                        }, 100);
                                    }
                                    saveExtraChartsState(); // Save state after removal
                                }
                            }
                        }
                    }

                } catch (err) {
                    console.error('Drop error:', err);
                }
            };

            // Toolbar
            const toolbar = document.createElement('div');
            toolbar.style.position = 'absolute';
            toolbar.style.top = '2px';
            toolbar.style.right = '2px';
            toolbar.style.zIndex = '10';
            toolbar.style.display = 'flex';
            toolbar.style.gap = '4px';
            toolbar.style.alignItems = 'center';

            // Drag Handle
            const dragHandle = document.createElement('div');
            dragHandle.className = 'chart-drag-handle';
            dragHandle.innerHTML = '⋮⋮';
            dragHandle.title = 'Drag to reorder';
            dragHandle.style.cursor = 'move';
            dragHandle.style.fontSize = '14px';
            dragHandle.style.padding = '0 4px';
            dragHandle.style.userSelect = 'none';
            
            // Enable dragging only when using the handle
            dragHandle.onmousedown = () => { wrapper.draggable = true; };
            dragHandle.onmouseup = () => { wrapper.draggable = false; };
            
            toolbar.appendChild(dragHandle);

            // Full View Button
            const fullViewBtn = document.createElement('button');
            fullViewBtn.className = 'chart-toolbar-btn';
            fullViewBtn.innerHTML = '⤢';
            fullViewBtn.title = 'Full View';
            fullViewBtn.style.background = 'none';
            fullViewBtn.style.border = 'none';
            fullViewBtn.style.cursor = 'pointer';
            fullViewBtn.style.fontSize = '14px';
            // Handler assigned after chart creation
            toolbar.appendChild(fullViewBtn);

            // Settings Button
            const settingsBtn = document.createElement('button');
            settingsBtn.className = 'chart-toolbar-btn';
            settingsBtn.innerHTML = '⚙';
            settingsBtn.title = 'Settings';
            settingsBtn.style.background = 'none';
            settingsBtn.style.border = 'none';
            settingsBtn.style.cursor = 'pointer';
            settingsBtn.style.fontSize = '14px';
            // Handler assigned after chart creation
            toolbar.appendChild(settingsBtn);

            // Close button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'chart-toolbar-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.style.background = 'none';
            removeBtn.style.border = 'none';
            removeBtn.style.fontSize = '18px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.onclick = () => {
                wrapper.remove();
                const idx = extraCharts.findIndex(c => c.canvas === canvas);
                if (idx > -1) {
                    extraCharts[idx].chart.destroy();
                    extraCharts.splice(idx, 1);
                }
                
                // Remove from preferences
                const prefIdx = chartPreferences.extraCharts.findIndex(c => c.id === wrapper.id);
                if (prefIdx > -1) {
                    chartPreferences.extraCharts.splice(prefIdx, 1);
                }
            };
            toolbar.appendChild(removeBtn);
            
            wrapper.appendChild(toolbar);

            const canvas = document.createElement('canvas');
            wrapper.appendChild(canvas);
            container.appendChild(wrapper);

            // NEW: Context Menu Listener for Extra Chart
            canvas.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.closeAllChartMenus();
                const idx = extraCharts.findIndex(c => c.canvas === canvas);
                if (idx === -1) return;
                const chart = extraCharts[idx].chart;
                
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const xValue = chart.scales.x.getValueForPixel(x);
                
                activeChartContext = { chart: chart, xValue };
                
                ctxMenu.style.left = `${e.clientX}px`;
                ctxMenu.style.top = `${e.clientY}px`;
                ctxMenu.style.display = 'block';
            });
            
            // Prepare datasets and scales
            const datasets = [];
            const scales = {
                x: {
                    type: 'time',
                    display: true, 
                    time: { tooltipFormat: 'yyyy-MM-dd' },
                    min: productionChart ? productionChart.scales.x.min : undefined,
                    max: productionChart ? productionChart.scales.x.max : undefined,
                    ticks: { 
                        color: themeColors.textColor,
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: { color: themeColors.gridColor }
                }
            };

            items.forEach((item, index) => {
                const { param, label } = item;
                const chartData = data.map(d => d[param]);
                
                // Use saved ID or generate new
                const axisId = item.yAxisID || (index === 0 ? 'y' : 'y-' + param + '-' + Date.now());
                
                // Use saved position or default
                let position = item.axisPosition;
                if (!position) {
                     position = 'left';
                }

                const color = item.color || lineColors[param] || defaultParamColors[param] || '#' + Math.floor(Math.random()*16777215).toString(16);

                scales[axisId] = {
                    display: true,
                    position: position,
                    title: { display: true, text: label, color: color, font: { size: 10 } },
                    grid: { color: themeColors.gridColor, drawOnChartArea: index === 0 }, 
                    ticks: { color: color, font: { size: 10 } }
                };

                datasets.push({
                    label: label,
                    data: chartData,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0,
                    borderDash: item.style || [],
                    yAxisID: axisId,
                    _param: param,
                    hidden: item.hidden || false // Restore visibility state
                });
            });

            const isInlineLegend = options.isInlineLegend !== undefined ? options.isInlineLegend : false;

            const chart = new Chart(canvas, {
                type: 'line',
                plugins: [markerPlugin, cursorPlugin, axisHoverPlugin, selectionPlugin, inlineLegendPlugin], // Added plugins
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: {
                    layout: {
                        padding: { right: isInlineLegend ? 80 : 0 }
                    },
                    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'mousedown', 'mouseup', 'pointerdown', 'pointermove', 'pointerup'],
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        legend: { 
                            display: !isInlineLegend,
                            labels: { color: themeColors.textColor, boxWidth: 10 },
                            onClick: function(e, legendItem, legend) {
                                Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend);
                                
                                // Update scales visibility
                                const ci = legend.chart;
                                const index = legendItem.datasetIndex;
                                const dataset = ci.data.datasets[index];
                                const axisId = dataset.yAxisID;
                                
                                if (axisId) {
                                    // Check if any visible dataset uses this axis
                                    const isAxisUsed = ci.data.datasets.some((ds, i) => {
                                        return ds.yAxisID === axisId && ci.isDatasetVisible(i);
                                    });
                                    
                                    if (ci.options.scales[axisId]) {
                                        ci.options.scales[axisId].display = isAxisUsed;
                                    }
                                }
                                ci.update();
                                saveExtraChartsState(); // Save state when legend item is clicked
                            }
                        },
                        inlineLegend: { enabled: isInlineLegend },
                        tooltip: { mode: 'index', intersect: false },
                        zoom: {
                            pan: {
                                enabled: true,
                                overScaleMode: 'xy',
                                onPanStart: ({chart}) => {
                                    return !!chart.dragStartScale;
                                },
                                onPan: ({chart}) => syncCharts(chart),
                                mode: 'xy',
                            },
                            zoom: {
                                wheel: { enabled: false },
                                pinch: { enabled: true },
                                drag: {
                                    enabled: false,
                                    backgroundColor: 'rgba(54, 162, 235, 0.3)'
                                },
                                mode: 'xy',
                            }
                        }
                    },
                    scales: scales
                }
            });
            
            // Sync markers
            chart._markers = wellMarkers;

            extraCharts.push({
                param: items[0].param,
                chart: chart,
                canvas: canvas,
                container: wrapper
            });
            
            // NEW: Left Axis Drawer for Extra Chart
            const drawerToggle = document.createElement('div');
            drawerToggle.className = 'axis-drawer-toggle';
            Object.assign(drawerToggle.style, {
                position: 'absolute',
                left: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '12px',
                height: '40px',
                borderLeft: 'none',
                borderTopRightRadius: '4px',
                borderBottomRightRadius: '4px',
                cursor: 'pointer',
                zIndex: '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                userSelect: 'none'
            });

            let areLeftAxesVisible = true;
            drawerToggle.innerHTML = '‹';
            drawerToggle.title = 'Toggle Left Axes';

            drawerToggle.onclick = () => {
                areLeftAxesVisible = !areLeftAxesVisible;
                drawerToggle.innerHTML = areLeftAxesVisible ? '‹' : '›';
                
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.position === 'left' && (scale.axis === 'y' || scale.id.startsWith('y'))) {
                        scale.display = areLeftAxesVisible ? 'auto' : false;
                    }
                });
                chart.update();
            };

            wrapper.appendChild(drawerToggle);

            // NEW: Right Axis Drawer for Extra Chart
            const rightDrawerToggle = document.createElement('div');
            rightDrawerToggle.className = 'axis-drawer-toggle-right';
            Object.assign(rightDrawerToggle.style, {
                position: 'absolute',
                right: '0',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '12px',
                height: '40px',
                borderRight: 'none',
                borderTopLeftRadius: '4px',
                borderBottomLeftRadius: '4px',
                cursor: 'pointer',
                zIndex: '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                boxShadow: '-2px 0 4px rgba(0,0,0,0.1)',
                userSelect: 'none'
            });

            let areRightAxesVisible = true;
            rightDrawerToggle.innerHTML = '›';
            rightDrawerToggle.title = 'Toggle Right Axes';

            rightDrawerToggle.onclick = () => {
                areRightAxesVisible = !areRightAxesVisible;
                rightDrawerToggle.innerHTML = areRightAxesVisible ? '›' : '‹';
                
                Object.values(chart.options.scales).forEach(scale => {
                    if (scale.position === 'right' && (scale.axis === 'y' || scale.id.startsWith('y'))) {
                        scale.display = areRightAxesVisible ? 'auto' : false;
                    }
                });
                chart.update();
            };

            wrapper.appendChild(rightDrawerToggle);

            // Add Zoom Controls
            ZoomControlManager.create(chart, wrapper);
            
            // Initial tags
            updateChartTags(wrapper, chart);
            
            // Initial Drawer Visibility
            updateDrawerVisibility(chart, wrapper);

            // Assign handlers now that chart exists
            settingsBtn.onclick = (e) => showExtraChartSettings(e, null, null, chart);
            fullViewBtn.onclick = () => openExtraChartFullView(chart);
        }

        function openExtraChartFullView(sourceChart) {
            // Reuse the modal structure from openFullViewChart but customize for single chart
            let modal = document.getElementById('chart-modal');
            const isDark = document.body.classList.contains('dark-theme');
            
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'chart-modal';
                modal.className = 'chart-modal-overlay';
                modal.style.display = 'none';
                modal.style.position = 'fixed';
                modal.style.top = '0';
                modal.style.left = '0';
                modal.style.width = '100%';
                modal.style.height = '100%';
                modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
                modal.style.zIndex = '9999';
                modal.style.justifyContent = 'center';
                modal.style.alignItems = 'center';
                
                const container = document.createElement('div');
                container.className = 'chart-modal-container';
                container.style.width = '90%';
                container.style.height = '90%';
                container.style.backgroundColor = isDark ? '#2b2b2b' : 'white';
                container.style.borderRadius = '8px';
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                
                const header = document.createElement('div');
                header.style.padding = '10px 20px';
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                header.innerHTML = `
                    <h3 style="margin:0; color: ${isDark ? '#ccc' : '#333'}">Full View</h3>
                    <button class="chart-close-btn" style="background:none; border:none; font-size:24px; cursor:pointer; color:${isDark ? '#ccc' : '#333'};">&times;</button>
                `;
                
                const chartWrapper = document.createElement('div');
                chartWrapper.style.flex = '1';
                chartWrapper.style.position = 'relative';
                chartWrapper.style.padding = '10px';
                
                const canvas = document.createElement('canvas');
                canvas.id = 'full-production-chart'; // Reuse ID or create new
                
                chartWrapper.appendChild(canvas);
                container.appendChild(header);
                container.appendChild(chartWrapper);
                modal.appendChild(container);
                document.body.appendChild(modal);
            } else {
                // Update header title
                const title = modal.querySelector('h3');
                if (title) {
                    title.textContent = `Full View`;
                    title.style.color = isDark ? '#ccc' : '#333';
                }
                const container = modal.querySelector('.chart-modal-container');
                if (container) container.style.backgroundColor = isDark ? '#2b2b2b' : 'white';
                
                const closeBtn = modal.querySelector('.chart-close-btn');
                if (closeBtn) closeBtn.style.color = isDark ? '#ccc' : '#333';
            }
            
            const closeFullView = () => {
                modal.style.display = 'none';
                if (window.fullChart) {
                    window.fullChart.destroy();
                    window.fullChart = null;
                }
            };

            const closeBtn = modal.querySelector('.chart-close-btn');
            if (closeBtn) closeBtn.onclick = closeFullView;
            
            modal.style.display = 'flex';
            
            const ctx = document.getElementById('full-production-chart').getContext('2d');
            if (window.fullChart) window.fullChart.destroy();
            
            const chartWrapper = document.getElementById('full-production-chart').parentElement;
            chartWrapper.querySelectorAll('.axis-zoom-control').forEach(el => el.remove());

            const themeColors = getThemeColors();
            
            // Copy datasets
            const datasets = sourceChart.data.datasets.map(ds => ({
                ...ds,
                pointRadius: 3,
                pointHoverRadius: 5
            }));

            // Copy scales
            const scales = {
                x: {
                    type: 'time',
                    time: { tooltipFormat: 'yyyy-MM-dd' },
                    display: true,
                    ticks: { color: themeColors.textColor },
                    grid: { color: themeColors.gridColor }
                }
            };

            Object.keys(sourceChart.options.scales).forEach(key => {
                const srcScale = sourceChart.options.scales[key];
                if (key === 'x') {
                    scales.x.position = srcScale.position;
                } else {
                    scales[key] = {
                        type: srcScale.type || 'linear',
                        display: srcScale.display,
                        position: srcScale.position,
                        title: { 
                            display: srcScale.title.display, 
                            text: srcScale.title.text, 
                            color: srcScale.title.color,
                            font: { size: 12 }
                        },
                        grid: { 
                            drawOnChartArea: srcScale.grid?.drawOnChartArea, 
                            color: themeColors.gridColor 
                        },
                        ticks: { 
                            color: themeColors.textColor,
                            font: { size: 11 }
                        }
                    };
                }
            });

            const isInlineLegendEnabled = sourceChart.options.plugins.inlineLegend?.enabled;

            window.fullChart = new Chart(ctx, {
                type: 'line',
                plugins: [markerPlugin, cursorPlugin, axisHoverPlugin, selectionPlugin, inlineLegendPlugin],
                data: { 
                    labels: labels, 
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    layout: {
                        padding: {
                            right: isInlineLegendEnabled ? 80 : 0
                        }
                    },
                    plugins: {
                        legend: { 
                            display: !isInlineLegendEnabled,
                            labels: { color: themeColors.textColor }
                        },
                        inlineLegend: {
                            enabled: isInlineLegendEnabled
                        },
                        tooltip: { mode: 'index', intersect: false },
                        zoom: {
                            pan: {
                                enabled: true,
                                overScaleMode: 'xy',
                                mode: 'xy',
                            },
                            zoom: {
                                wheel: { enabled: false },
                                pinch: { enabled: true },
                                drag: { enabled: false, backgroundColor: 'rgba(54, 162, 235, 0.3)' },
                                mode: 'xy'
                            }
                        }
                    },
                    scales: scales
                }
            });
            window.fullChart._markers = wellMarkers;
            
            // Delay creation of zoom controls
            setTimeout(() => {
                ZoomControlManager.create(window.fullChart, chartWrapper);
            }, 100);
        }

        function showExtraChartSettings(evt, param, label, chartInstance) {
            evt.stopPropagation();
            const isDark = document.body.classList.contains('dark-theme');
            
            // Reuse logic from main settings but for single param
            let settingsPanel = document.createElement('div');
            settingsPanel.className = 'chart-settings-panel';
            Object.assign(settingsPanel.style, {
                position: 'fixed',
                zIndex: '10001',
                backgroundColor: isDark ? '#2b2b2b' : 'white',
                border: isDark ? '1px solid #444' : '1px solid #ccc',
                color: isDark ? '#eee' : '#333',
                padding: '10px',
                borderRadius: '4px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '180px'
            });
            
            const rect = evt.target.getBoundingClientRect();
            settingsPanel.style.top = `${rect.bottom + 5}px`;
            settingsPanel.style.left = `${rect.left - 150}px`;

            // Title
            const title = document.createElement('div');
            title.textContent = 'Chart Settings';
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '5px';
            title.style.fontSize = '12px';
            settingsPanel.appendChild(title);

            // Inline Legend Toggle
            const legendRow = document.createElement('div');
            legendRow.style.display = 'flex';
            legendRow.style.alignItems = 'center';
            legendRow.style.justifyContent = 'space-between';
            
            const legendLabel = document.createElement('span');
            legendLabel.textContent = 'Inline Legend';
            legendLabel.style.fontSize = '12px';
            
            const legendToggle = document.createElement('input');
            legendToggle.type = 'checkbox';
            legendToggle.checked = chartInstance.options.plugins.inlineLegend?.enabled || false;
            legendToggle.onchange = (e) => {
                const enabled = e.target.checked;
                chartInstance.options.plugins.legend.display = !enabled;
                chartInstance.options.plugins.inlineLegend = { enabled: enabled };
                chartInstance.options.layout.padding.right = enabled ? 80 : 0;
                chartInstance.update();
                saveExtraChartsState(); // Save state
            };
            
            legendRow.appendChild(legendLabel);
            legendRow.appendChild(legendToggle);
            settingsPanel.appendChild(legendRow);

            // Series Settings for ALL datasets
            chartInstance.data.datasets.forEach((ds, index) => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.justifyContent = 'space-between';
                row.style.gap = '8px';
                
                const lbl = document.createElement('span');
                lbl.textContent = ds.label;
                lbl.style.fontSize = '12px';
                lbl.style.flexGrow = '1';
                
                // Style Selector
                const styleSelect = document.createElement('select');
                styleSelect.style.fontSize = '11px';
                styleSelect.style.padding = '1px';
                styleSelect.style.backgroundColor = isDark ? '#1e1e1e' : 'white';
                styleSelect.style.color = isDark ? '#eee' : 'black';
                styleSelect.style.border = isDark ? '1px solid #555' : '1px solid #ccc';
                
                const styles = [
                    { value: 'solid', text: 'Solid' },
                    { value: 'dashed', text: 'Dashed' },
                    { value: 'dotted', text: 'Dotted' },
                    { value: 'dashdot', text: 'Dash-Dot' }
                ];
                
                const currentDash = ds.borderDash || [];
                let currentStyle = 'solid';
                if (currentDash.length === 2 && currentDash[0] === 5) currentStyle = 'dashed';
                else if (currentDash.length === 2 && currentDash[0] === 2) currentStyle = 'dotted';
                else if (currentDash.length === 4) currentStyle = 'dashdot';

                styles.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.value;
                    opt.textContent = s.text;
                    if (currentStyle === s.value) opt.selected = true;
                    styleSelect.appendChild(opt);
                });
                
                styleSelect.addEventListener('change', (e) => {
                    const val = e.target.value;
                    let borderDash = [];
                    if (val === 'dashed') borderDash = [5, 5];
                    else if (val === 'dotted') borderDash = [2, 2];
                    else if (val === 'dashdot') borderDash = [10, 5, 2, 5];
                    
                    ds.borderDash = borderDash;
                    chartInstance.update();
                    saveExtraChartsState(); // Save state after style change
                });

                // Color Picker
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = ds.borderColor;
                colorInput.style.border = 'none';
                colorInput.style.width = '20px';
                colorInput.style.height = '20px';
                colorInput.style.cursor = 'pointer';
                colorInput.style.padding = '0';
                colorInput.style.backgroundColor = 'transparent';
                
                colorInput.addEventListener('input', (e) => {
                    const newColor = e.target.value;
                    ds.borderColor = newColor;
                    ds.pointBackgroundColor = newColor;
                    // Also update the tag color if it exists
                    const wrapper = chartInstance.canvas.parentElement;
                    if (wrapper) {
                        updateChartTags(wrapper, chartInstance);
                    }
                    chartInstance.update();
                    saveExtraChartsState(); // Save state after color change
                });
                
                row.appendChild(lbl);
                row.appendChild(styleSelect);
                row.appendChild(colorInput);
                settingsPanel.appendChild(row);
            });
            
            document.body.appendChild(settingsPanel);
            
            const closeHandler = (e) => {
                if (!settingsPanel.contains(e.target) && e.target !== evt.target) {
                    settingsPanel.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('click', closeHandler), 0);
        }

        function updateChart() {
            const datasets = getChartData();
            const chartContainer = document.getElementById('details-chart-container');
            const isInlineLegend = chartPreferences.isInlineLegend;

            // Update Extra Charts
            extraCharts.forEach(ec => {
                // Update data for all datasets in this chart
                ec.chart.data.datasets.forEach(ds => {
                    if (ds._param) {
                        ds.data = data.map(d => d[ds._param]);
                    }
                });
                ec.chart.data.labels = labels;
                ec.chart._markers = wellMarkers; // Sync markers
                
                // Don't overwrite legend settings here, let them persist
                
                ec.chart.update();
                ZoomControlManager.create(ec.chart, ec.container); // Refresh controls
            });

            // Update Full Chart if open
            if (window.fullChart) {
                window.fullChart.data.datasets = datasets;
                
                // Update scale colors
                if (window.fullChart.options.scales['y-oil']) window.fullChart.options.scales['y-oil'].title.color = lineColors['orate'];
                if (window.fullChart.options.scales['y-water']) window.fullChart.options.scales['y-water'].title.color = lineColors['wrate'];
                if (window.fullChart.options.scales['y-gas']) window.fullChart.options.scales['y-gas'].title.color = lineColors['grate'];

                // Update Legend Mode
                window.fullChart.options.plugins.legend.display = !isInlineLegend;
                window.fullChart.options.plugins.inlineLegend = { enabled: isInlineLegend };
                window.fullChart.options.layout.padding.right = isInlineLegend ? 80 : 0;

                window.fullChart._markers = wellMarkers;
                window.fullChart.update();
                const fullChartCanvas = document.getElementById('full-production-chart');
                if (fullChartCanvas) {
                     ZoomControlManager.create(window.fullChart, fullChartCanvas.parentElement);
                }
            }

            if (productionChart) {
                productionChart.data.datasets = datasets;
                
                // Update scale colors
                if (productionChart.options.scales['y-oil']) productionChart.options.scales['y-oil'].title.color = lineColors['orate'];
                if (productionChart.options.scales['y-water']) productionChart.options.scales['y-water'].title.color = lineColors['wrate'];
                if (productionChart.options.scales['y-gas']) productionChart.options.scales['y-gas'].title.color = lineColors['grate'];

                // Update Legend Mode
                productionChart.options.plugins.legend.display = !isInlineLegend;
                productionChart.options.plugins.inlineLegend = { enabled: isInlineLegend };
                productionChart.options.layout.padding.right = isInlineLegend ? 80 : 0;

                productionChart._markers = wellMarkers; // Sync markers
                productionChart.update();
                ZoomControlManager.create(productionChart, chartContainer); // Refresh controls
                updateDrawerVisibility(productionChart, chartContainer); // Update drawers
                updateChartTags(chartContainer, productionChart); // Update draggable tags
            } else {
                // Remove existing controls
                chartContainer.querySelectorAll('.axis-zoom-control').forEach(el => el.remove());

                const themeColors = getThemeColors();

                productionChart = new Chart(canvas, {
                    type: 'line',
                    plugins: [markerPlugin, cursorPlugin, axisHoverPlugin, selectionPlugin, inlineLegendPlugin], // Add plugin
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'mousedown', 'mouseup', 'pointerdown', 'pointermove', 'pointerup'],
                        responsive: true,
                        maintainAspectRatio: false,
                        elements: {
                            line: {
                                tension: 0
                            }
                        },
                        layout: {
                            padding: { right: isInlineLegend ? 80 : 0 }
                        },
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            legend: { 
                                display: !isInlineLegend,
                                position: 'top',
                                align: 'end',
                                labels: {
                                    usePointStyle: true,
                                    boxWidth: 6,
                                    color: themeColors.textColor
                                }
                            },
                            inlineLegend: { enabled: isInlineLegend },
                            tooltip: { mode: 'index', intersect: false },
                            zoom: {
                                pan: {
                                    enabled: true,
                                    overScaleMode: 'xy',
                                    onPanStart: ({chart}) => {
                                        return !!chart.dragStartScale;
                                    },
                                    onPan: ({chart}) => syncCharts(chart),
                                    mode: 'xy',
                                },
                                zoom: {
                                    wheel: {
                                        enabled: false,
                                    },
                                    pinch: {
                                        enabled: true
                                    },
                                    drag: {
                                        enabled: false, // Disable default drag zoom
                                        backgroundColor: 'rgba(54, 162, 235, 0.3)'
                                    },
                                    mode: 'xy',
                                }
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    tooltipFormat: 'yyyy-MM-dd'
                                },
                                display: true,
                                ticks: { color: themeColors.textColor },
                                grid: { color: themeColors.gridColor }
                            },
                            'y-oil': {
                                type: 'linear',
                                display: 'auto',
                                position: 'left',
                                title: { display: true, text: 'Oil Rate', color: lineColors['orate'] || '#2ecc71' },
                                grid: { drawOnChartArea: true, color: themeColors.gridColor },
                                ticks: { color: themeColors.textColor }
                            },
                            'y-water': {
                                type: 'linear',
                                display: 'auto',
                                position: 'left',
                                title: { display: true, text: 'Water Rate', color: lineColors['wrate'] || '#3498db' },
                                grid: { drawOnChartArea: false, color: themeColors.gridColor },
                                ticks: { color: themeColors.textColor }
                            },
                            'y-gas': {
                                type: 'linear',
                                display: 'auto',
                                position: 'left',
                                title: { display: true, text: 'Gas Rate', color: lineColors['grate'] || '#e74c3c' },
                                grid: { drawOnChartArea: false, color: themeColors.gridColor },
                                ticks: { color: themeColors.textColor }
                            },
                            'y': {
                                display: 'auto',
                                position: 'left',
                                ticks: { color: themeColors.textColor },
                                grid: { color: themeColors.gridColor }
                            }
                        }
                    }
                });
                ZoomControlManager.create(productionChart, chartContainer);
                updateDrawerVisibility(productionChart, chartContainer); // Update drawers
                updateChartTags(chartContainer, productionChart); // Update draggable tags
            }
        }

        updateChart();
        
    } catch (err) {
        console.error(err);
        loadingEl.style.display = 'none';
        errorEl.textContent = "Error loading data.";
        errorEl.style.display = 'block';
    }
}

// Dark Mode Toggle Button removed (replaced by Layers Control)

document.addEventListener('keydown', function(e) {
	if (e.shiftKey && (e.key === 'f' || e.key === 'F')) {
		filter_sidebar.toggle();
	}
});

const sidebarRoot = document.getElementById("onemap-sidebar-filter");
const host = sidebarRoot.querySelector("#filters-container");

host.innerHTML = "";
const wrap = document.createElement("div");
wrap.className = "efs-wrap";
wrap.innerHTML = `<div class="efs-columns"></div>`;
host.appendChild(wrap);

const colArea = wrap.querySelector(".efs-columns");

function norm(v){ return (v === null || v === undefined) ? "" : String(v).trim(); }

function capitalize(s) {
	if (!s) return "";
	return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

function slugifyAttr(value, fallback = "field") {
	const normalized = norm(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || fallback;
}

function formatNumber(value, fractionDigits = 4) {
	if (value === null || value === undefined) return "";
	const numeric = Number(value);
	if (Number.isNaN(numeric)) return "";
	return numeric.toLocaleString(undefined, {
		maximumFractionDigits: fractionDigits,
		minimumFractionDigits: 0
	});
}

function detectColumnTypes(data, threshold = 0.9) {
	const firstRow = data[0];
	const columns = Object.keys(firstRow);
	const columnTypes = {};

	columns.forEach(col => {
        // NEW: Force spud_date to be treated as date
        if (col.toLowerCase() === 'spud_date') {
            columnTypes[col] = 'date';
            return;
        }
		const values = data.map(row => row[col]);
		const numericCount = values.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
		const ratio = numericCount / values.length;
		columnTypes[col] = ratio >= threshold ? "numeric" : "categorical";
	});

	return columnTypes;
}

function createWellDataset(wells) {
	const rowsByWell = new Map();
	const wellIds = [];

	wells.forEach(row => {
		const wellId = norm(row.well);
		if (!wellId) return;
		if (!rowsByWell.has(wellId)) {
			wellIds.push(wellId);
		}
		rowsByWell.set(wellId, row);
	});

	return { rowsByWell, wellIds };
}

function toFiniteNumber(value) {
	if (value === null || value === undefined) return undefined;
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : undefined;
}

function normalizeWellsPayload(raw) {
	let statusColorsOverride;

	const captureStatusColors = candidate => {
		if (!candidate || typeof candidate !== "object") return;
		const entries = Object.entries(candidate).filter(([key, value]) => typeof key === "string" && typeof value === "string" && value.trim());
		if (entries.length) {
			statusColorsOverride = { ...(statusColorsOverride || {}) };
			for (const [key, value] of entries) {
				statusColorsOverride[key] = value.trim();
			}
		}
		if (typeof candidate.default === "string" && candidate.default.trim()) {
			(statusColorsOverride ||= {}).default = candidate.default.trim();
		}
		if (typeof candidate._default === "string" && candidate._default.trim()) {
			(statusColorsOverride ||= {})._default = candidate._default.trim();
		}
	};

	if (raw && typeof raw === "object") {
		captureStatusColors(raw.statusColors);
		// allow nested metadata holders
		captureStatusColors(raw.metadata?.statusColors);
		captureStatusColors(raw?.properties?.statusColors);
	}

	const mapFeatureToRecord = (props = {}, geometry, allowGeometryCoords) => {
		const record = { ...props };

        // Map well_name to well if well is missing
        if (!record.well && record.well_name) {
            record.well = record.well_name;
        }

		let lat =
			toFiniteNumber(props.lat) ??
			toFiniteNumber(props.latitude) ??
			toFiniteNumber(props.Latitude);
		let lon =
			toFiniteNumber(props.lon) ??
			toFiniteNumber(props.lng) ??
			toFiniteNumber(props.longitude) ??
			toFiniteNumber(props.Longitude);

		if (allowGeometryCoords && (lat === undefined || lon === undefined)) {
			const coords = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
			const geomLon = toFiniteNumber(coords[0]);
			const geomLat = toFiniteNumber(coords[1]);
			if (lat === undefined) lat = geomLat;
			if (lon === undefined) lon = geomLon;
		}

		if (lat === undefined || lon === undefined) {
			return null;
		}

		record.lat = lat;
		record.lon = lon;
		return record;
	};

	if (Array.isArray(raw)) {
		const wells = raw
			.map(item => mapFeatureToRecord(item, null, false))
			.filter(Boolean);
		return { wells, statusColors: statusColorsOverride };
	}

	if (raw && Array.isArray(raw.features)) {
		const crsName = String(raw?.crs?.properties?.name || "");
		const allowGeometryCoords = /4326|CRS84/i.test(crsName);
		const wells = raw.features
			.map(feature => mapFeatureToRecord(feature?.properties || {}, feature?.geometry, allowGeometryCoords))
			.filter(Boolean);
		return { wells, statusColors: statusColorsOverride };
	}

	return { wells: [], statusColors: statusColorsOverride };
}

const DEFAULT_STATUS_COLOR = "#3498db";

const DEFAULT_STATUS_COLORS = Object.freeze({
	"Active": "#2ecc71",       // Green
	"Producing": "#2ecc71",    // Green
    "ONLINE": "#4E95D9",       // Blue (Requested)
    "Online": "#4E95D9",

	"Maintenance": "#C00000",  // Red
	"Issue": "#C00000",        // Red
	"Workover": "#C00000",     // Red
	"Shut-in": "#E97132",      // Orange (Requested)
    "SHUT-IN": "#E97132",      // Orange (Requested)
    "OFFLINE": "#C00000",      // Red (Requested)
    "Offline": "#C00000",

	"Abandoned": "#95a5a6",    // Gray
	"Suspended": "#95a5a6"     // Gray
});

const markersByWell = new Map();
window._efsMarkersByWell = markersByWell;

const markerColorState = {
	baseResolver: null,
	baseDefault: DEFAULT_STATUS_COLOR,
	activeColumn: null,
	colorsByValue: {},
	defaultColor: DEFAULT_STATUS_COLOR
};
window._efsMarkerColorState = markerColorState;

function resolveMarkerColorForRow(row) {
	const state = markerColorState;
	if (state.activeColumn && row) {
		const column = state.activeColumn;
		const valueKey = norm(row[column]);
		const palette = state.colorsByValue || {};
		if (Object.prototype.hasOwnProperty.call(palette, valueKey)) {
			return palette[valueKey];
		}
		if (Object.prototype.hasOwnProperty.call(palette, "__default")) {
			return palette.__default;
		}
	}

	if (typeof state.baseResolver === "function") {
		const baseColor = state.baseResolver(row);
		if (baseColor) return baseColor;
	}

	if (state.defaultColor) return state.defaultColor;
	return state.baseDefault || DEFAULT_STATUS_COLOR;
}

function applyColorToMarker(marker, color) {
	if (!marker) return;
	const next = color || markerColorState.baseDefault || DEFAULT_STATUS_COLOR;
	if (typeof marker.setStyle === "function") {
		marker.setStyle({ color: next, fillColor: next });
	}
	if (marker.options) {
		marker.options.color = next;
		marker.options.fillColor = next;
	}
	if (marker._defaultStyle) {
		marker._defaultStyle.color = next;
		marker._defaultStyle.fillColor = next;
	} else {
		marker._defaultStyle = {
			color: next,
			fillColor: next,
			fillOpacity: marker.options?.fillOpacity,
			radius: marker.options?.radius,
			weight: marker.options?.weight
		};
	}
}

function applyMarkerColorsToAll() {
	const dataset = window._efsDataset;
	if (!dataset) return;

	for (const [wellId, markers] of markersByWell.entries()) {
		const list = Array.isArray(markers) ? markers : (markers ? [markers] : []);
		if (!list.length) continue;
		const row = dataset.rowsByWell.get(wellId);
		if (!row) continue;
		const resolvedColor = resolveMarkerColorForRow(row);
		for (const marker of list) {
			applyColorToMarker(marker, resolvedColor);
		}
	}
}

function sanitizeColorValue(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function createStatusColorResolver(overrides) {
	const palette = {};
	for (const [key, value] of Object.entries(DEFAULT_STATUS_COLORS)) {
		const normalizedKey = norm(key);
		if (normalizedKey) {
			palette[normalizedKey] = value;
		}
	}

	let defaultColor = DEFAULT_STATUS_COLOR;

	if (overrides && typeof overrides === "object") {
		const entries = Object.entries(overrides);
		for (const [key, value] of entries) {
			if (!key) continue;
			if (key === "default" || key === "_default") {
				const color = sanitizeColorValue(value);
				if (color) defaultColor = color;
				continue;
			}
			const color = sanitizeColorValue(value);
			const normalizedKey = norm(key);
			if (color && normalizedKey) {
				palette[normalizedKey] = color;
			}
		}
	}

	const resolver = status => {
		const key = norm(status);
		return Object.prototype.hasOwnProperty.call(palette, key) ? palette[key] : defaultColor;
	};

	return { resolve: resolver, palette, defaultColor };
}

// Helper for Injector Wells (Upside Down Triangle)
function createTriangleMarker(latlng, options) {
    const color = options.color || '#3388ff';
    const size = (options.radius || 4) * 3.5; // Scale up for visibility
    
    // Upside down triangle SVG
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="overflow: visible; display: block;">
        <path d="M2 2 L22 2 L12 22 Z" fill="${color}" stroke="${color}" stroke-width="2" stroke-linejoin="round" />
    </svg>`;

    const icon = L.divIcon({
        className: 'custom-triangle-icon',
        html: svg,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
    });

    const marker = L.marker(latlng, { icon: icon, ...options });

    // Add setStyle method to mimic L.CircleMarker behavior for color updates
    marker.setStyle = function(style) {
        const newColor = style.color || style.fillColor;
        if (newColor) {
            this.options.color = newColor;
            this.options.fillColor = newColor;
            
            const newSvg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="overflow: visible; display: block;">
                <path d="M2 2 L22 2 L12 22 Z" fill="${newColor}" stroke="${newColor}" stroke-width="2" stroke-linejoin="round" />
            </svg>`;
            
            this.setIcon(L.divIcon({
                className: 'custom-triangle-icon',
                html: newSvg,
                iconSize: [size, size],
                iconAnchor: [size/2, size/2]
            }));
        }
        return this;
    };

    return marker;
}

function populateWellPointFeatureGroup(wells, group, statusColorFn, registry) {
	if (registry && typeof registry.clear === "function") {
		registry.clear();
	}

	wells.forEach(w => {
		const wellName = norm(w.well);
		if (!wellName) return;

		const baseColor = typeof statusColorFn === "function" ? statusColorFn(w.status, w) : null;
		const initialColor = markerColorState.activeColumn ? resolveMarkerColorForRow(w) : (baseColor || resolveMarkerColorForRow(w));
		const colorToUse = initialColor || markerColorState.baseDefault || DEFAULT_STATUS_COLOR;

        let marker;
        // Check for Injector (Upside Down Triangle) vs Producer (Circle)
        if (w.otype && /inject/i.test(w.otype)) {
            marker = createTriangleMarker([w.lat, w.lon], {
                color: colorToUse,
                fillColor: colorToUse,
                fillOpacity: 1.0,
                radius: 4
            });
        } else {
            // Default to Circle (Producer)
            marker = L.circleMarker([w.lat, w.lon], {
                bubblingMouseEvents: true,
                color: colorToUse,
                dashArray: null,
                dashOffset: null,
                fill: true,
                fillColor: colorToUse,
                fillOpacity: 1.,
                fillRule: "evenodd",
                lineCap: "round",
                lineJoin: "round",
                opacity: 1.0,
                radius: 4,
                weight: 1,
                stroke: true,		
            });
        }

		marker.on('click', () => showWellDetails(wellName)) // NEW: Open details on click
		.bindPopup(
			`<b>${w.well}</b>` +
            (w.field ? `<br/>Field: ${w.field}` : "") +
            (w.platform ? `<br/>Platform: ${w.platform}` : "") +
            (w.status ? `<br/>Status: ${w.status}` : "") +
            (w.otype ? `<br/>OTYPE: ${w.otype}` : "") +
            (w.fluid ? `<br/>Fluid: ${w.fluid}` : "") +
            (w.spud_date ? `<br/>Spud Date: ${w.spud_date}` : "") +
            `<br/>Lat: ${w.lat.toFixed(4)}` +
            `<br/>Lon: ${w.lon.toFixed(4)}`
		)
		.addTo(group);
		marker.options.__well_id = wellName;
		marker.options.searchKey = wellName;
		marker.feature = marker.feature || { properties: {} };
		marker.feature.properties.searchKey = wellName;
		marker._defaultStyle = {
			color: marker.options.color,
			fillColor: marker.options.fillColor,
			fillOpacity: marker.options.fillOpacity,
			radius: marker.options.radius,
			weight: marker.options.weight
		};

		if (registry) {
			const bucket = registry.get(wellName) || [];
			bucket.push(marker);
			registry.set(wellName, bucket);
		}
	});
}

window.applyMarkerColorScheme = function(options = {}) {
	const columnName = (typeof options.column === "string" && options.column.trim()) ? options.column.trim() : null;
	const colorsInput = (options.colors && typeof options.colors === "object") ? options.colors : null;

	if (!columnName) {
		markerColorState.activeColumn = null;
		markerColorState.colorsByValue = {};
		markerColorState.defaultColor = markerColorState.baseDefault || DEFAULT_STATUS_COLOR;
		applyMarkerColorsToAll();
		document.dispatchEvent(new CustomEvent("efs:marker-colors-applied", {
			detail: { column: null }
		}));
		return;
	}

	const normalizedColors = {};
	if (colorsInput) {
		for (const [rawKey, rawValue] of Object.entries(colorsInput)) {
			const color = sanitizeColorValue(rawValue);
			if (!color) continue;
			const key = rawKey === "__default" ? "__default" : norm(rawKey);
			if (!key && key !== "") continue;
			normalizedColors[key] = color;
		}
	}

	const fallbackColor = sanitizeColorValue(options.defaultColor);
	markerColorState.defaultColor = fallbackColor || markerColorState.baseDefault || DEFAULT_STATUS_COLOR;

	markerColorState.activeColumn = columnName;
	markerColorState.colorsByValue = normalizedColors;

	applyMarkerColorsToAll();

	document.dispatchEvent(new CustomEvent("efs:marker-colors-applied", {
		detail: {
			column: columnName,
			colors: { ...normalizedColors },
			defaultColor: markerColorState.defaultColor
		}
	}));
};

window.getMarkerColoringState = function() {
	return {
		activeColumn: markerColorState.activeColumn,
		colorsByValue: { ...(markerColorState.colorsByValue || {}) },
		defaultColor: markerColorState.defaultColor
	};
};

window.getCategoricalColumnsInfo = function() {
	const state = window._efsState;
	if (!state) return [];

	const result = [];
	const cols = Array.isArray(state.COLS) ? state.COLS : [];
	for (const col of cols) {
		const meta = state.columnEls?.[col];
		if (!meta || meta.type !== "categorical") continue;

		const order = Array.isArray(meta.valueOrder) ? meta.valueOrder : Object.keys(meta.totalCounts || {});
		const labels = meta.labelsByValue || {};
		const counts = meta.totalCounts || {};

		const values = order.map(key => {
			const raw = Object.prototype.hasOwnProperty.call(labels, key) ? labels[key] : key;
			const display = (raw === null || raw === undefined || raw === "") ? "(blank)" : String(raw);
			return {
				key,
				label: display,
				rawLabel: raw,
				count: counts[key] || 0
			};
		});

		result.push({ name: col, values });
	}

	return result;
};

const GEOMETRY_COLUMN_TOKENS = new Set([
	"head",
	"tail",
	"xy",
	"casing",
	"perf",
	"tubing",
]);

function isGeometryColumnName(name) {
	const normalized = norm(name).toLowerCase();
	if (!normalized) return false;
	if (GEOMETRY_COLUMN_TOKENS.has(normalized)) return true;

	const tokens = normalized.split(/[^a-z0-9]+/).filter(Boolean);
	if (!tokens.length) return false;
	return tokens.some(token => GEOMETRY_COLUMN_TOKENS.has(token));
}

function buildFilterControls(wells, types) {
	// Clear previous filters
	colArea.innerHTML = "";

    // NEW: Persist expansion state
    // Initialize with defaults (well and spud_date expanded) if not already set
    if (!window._efsExpandedFilters) {
        window._efsExpandedFilters = new Set(['well', 'spud_date']);
    }

	const selected = {};
	const columnEls = {};

    // Define preferred order
    const preferredOrder = ["well", "spud_date", "formation", "orate", "grate", "wrate", "fluid", "method"];
    
    // Get all columns and sort them
    const sortedColumns = Object.keys(types).sort((a, b) => {
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        
        const aIndex = preferredOrder.indexOf(aLower);
        const bIndex = preferredOrder.indexOf(bLower);
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        
        return aLower.localeCompare(bLower);
    });

	for (const c of sortedColumns) {
		if (isGeometryColumnName(c)) continue;
        if (c.toLowerCase() === 'horizon') continue; // NEW: Skip horizon filter
        if (c.toLowerCase() === 'well_name') continue; // NEW: Skip well_name filter
		const sampleRow = wells.find(row => row[c] !== null && row[c] !== undefined);
		const sampleValue = sampleRow ? sampleRow[c] : undefined;
		if (sampleValue && typeof sampleValue === "object") continue;

		const columnType = types[c];

		if (columnType === "categorical") {
			selected[c] = new Set();
			const counts = {};
			const labels = {};

			for (const row of wells) {
				const rawVal = row[c];
				const key = norm(rawVal);
				counts[key] = (counts[key] || 0) + 1;
				if (!(key in labels)) {
					labels[key] = rawVal;
				}
			}

			const box = document.createElement("div");
			box.className = "efs-col"; // Accordion item

            // NEW: Restore expansion state
            if (window._efsExpandedFilters.has(c)) {
                box.classList.add("active");
            }

			const columnSlug = slugifyAttr(c);
			const searchName = `filter-${columnSlug}-search`;
			const searchId = `${searchName}-${Math.random().toString(36).slice(2,8)}`;

			const head = document.createElement("div");
			head.className = "efs-head";

			const title = document.createElement("div");
			title.className = "efs-title";
            const labelMapping = { 
                "spud_date": "Spud Date", 
                "lat": "Latitude", 
                "lon": "Longitude",
                "orate": "Oil Rate (Ton/day)",
                "wrate": "Water Rate (Ton/day)",
                "grate": "Gas Rate (Ton/day)"
            };
			title.textContent = labelMapping[c.toLowerCase()] || capitalize(c);
			head.appendChild(title);
            
            // Accordion Arrow
            const arrow = document.createElement("span");
            arrow.className = "accordion-arrow";
            arrow.textContent = "▼";
            head.appendChild(arrow);

			box.appendChild(head);

            // Accordion Body
            const body = document.createElement("div");
            body.className = "efs-body";

			const searchEl = document.createElement("input");
			searchEl.className = "efs-search";
			searchEl.type = "text";
			searchEl.id = searchId;
			searchEl.name = searchName;
			searchEl.placeholder = `Search ${capitalize(c)}...`;
			body.appendChild(searchEl);

			const listEl = document.createElement("div");
			listEl.className = "efs-list";
			body.appendChild(listEl);
            
            box.appendChild(body);
			colArea.appendChild(box);

            // Toggle Accordion
            head.addEventListener("click", () => {
                box.classList.toggle("active");
                // NEW: Save expansion state
                if (box.classList.contains("active")) {
                    window._efsExpandedFilters.add(c);
                } else {
                    window._efsExpandedFilters.delete(c);
                }
            });

			const checkboxes = new Map();
			const countSpans = new Map();

			const selAllId = `efs-${c}-all-${Math.random().toString(36).slice(2,8)}`;
			const selAll = document.createElement("label");
			selAll.className = "efs-item efs-all"; // mark as 'select all'
			selAll.setAttribute("data-role", "select-all"); // used by search to keep visible

			const selAllChk = document.createElement("input");
			selAllChk.type = "checkbox";
			selAllChk.id = selAllId;
			selAllChk.dataset.col = c;
			selAllChk.dataset.role = "all";

			// start in the "all selected" state
			selAllChk.checked = true;

			const selAllTxt = document.createElement("span");
			selAllTxt.textContent = "Select all";

			selAll.appendChild(selAllChk);
			selAll.appendChild(selAllTxt);
			listEl.appendChild(selAll);

			const valueKeys = Object.keys(counts);
			const blankIndex = valueKeys.indexOf("");
			if (blankIndex > -1) {
				valueKeys.splice(blankIndex, 1);
				valueKeys.unshift("");
			}

			const updateSelectAllState = () => {
				const total = checkboxes.size;
				let checkedCount = 0;
				for (const input of checkboxes.values()) {
					if (input.checked) checkedCount += 1;
				}
				selAllChk.checked = checkedCount === total;
				selAllChk.indeterminate = checkedCount > 0 && checkedCount < total;
			};

			const triggerFilters = () => {
				if (typeof window.applyWellVisibilityFilters === "function") {
					window.applyWellVisibilityFilters();
				}
			};

            const itemRows = [];

			for (const valKey of valueKeys) {
				const display = labels[valKey];
				const labelText = (display === null || display === undefined || display === "") ? "(blank)" : String(display);
				const id = `efs-${c}-${Math.random().toString(36).slice(2,8)}`;
				const row = document.createElement("label");
				row.className = "efs-item";
				row.setAttribute("data-value", valKey);
				row.setAttribute("data-label", labelText.toLowerCase());

				const chk = document.createElement("input");
				chk.type = "checkbox";
				chk.id = id;
				chk.dataset.col = c;
				chk.dataset.val = valKey;

				chk.checked = true;		// start checked
				selected[c].add(valKey);	  // seed selection with all values

				const txt = document.createElement("span");
				txt.textContent = labelText;

				const cnt = document.createElement("span");

				// initial counts are (total/total)
				const tot = counts[valKey] || 0;
				cnt.className = "efs-count";
				cnt.textContent = `(${tot}/${tot})`;

				row.appendChild(chk);

                // NEW: Add color legend dot if this is the status column
                if (c.toLowerCase() === 'status') {
                    const statusColor = DEFAULT_STATUS_COLORS[valKey] || DEFAULT_STATUS_COLOR;
                    const dot = document.createElement("span");
                    dot.style.display = "inline-block";
                    dot.style.width = "10px";
                    dot.style.height = "10px";
                    dot.style.borderRadius = "50%";
                    dot.style.backgroundColor = statusColor;
                    dot.style.marginRight = "6px";
                    dot.style.marginLeft = "4px";
                    row.appendChild(dot);
                }

				row.appendChild(txt);
				row.appendChild(cnt);

				listEl.appendChild(row);
                itemRows.push(row);

				checkboxes.set(valKey, chk);
				countSpans.set(valKey, cnt);

				chk.addEventListener("change", () => {
					if (chk.checked) {
						selected[c].add(valKey);
					} else {
						selected[c].delete(valKey);
					}
					updateSelectAllState();
					triggerFilters();
				});
			}

			updateSelectAllState();

			selAllChk.addEventListener("change", () => {
				const shouldCheck = selAllChk.checked;
				for (const [valKey, input] of checkboxes.entries()) {
					if (input.checked !== shouldCheck) {
						input.checked = shouldCheck;
					}
					if (shouldCheck) {
						selected[c].add(valKey);
					} else {
						selected[c].delete(valKey);
					}
				}
				selAllChk.indeterminate = false;
				triggerFilters();
			});

            // Show More Logic
            const SHOW_LIMIT = 5;
            let isExpanded = false;
            let showMoreBtn = null;

            if (itemRows.length > SHOW_LIMIT) {
                // Hide items beyond limit initially
                for (let i = SHOW_LIMIT; i < itemRows.length; i++) {
                    itemRows[i].style.display = "none";
                }

                showMoreBtn = document.createElement("button");
                showMoreBtn.className = "efs-show-more";
                showMoreBtn.textContent = `Show ${itemRows.length - SHOW_LIMIT} more`;
                
                showMoreBtn.onclick = (e) => {
                    e.preventDefault();
                    isExpanded = !isExpanded;
                    
                    // Toggle visibility based on state
                    for (let i = SHOW_LIMIT; i < itemRows.length; i++) {
                        itemRows[i].style.display = isExpanded ? "flex" : "none";
                    }
                    
                    showMoreBtn.textContent = isExpanded ? "Show Less" : `Show ${itemRows.length - SHOW_LIMIT} more`;
                };
                body.appendChild(showMoreBtn);
            }

			searchEl.addEventListener("input", () => {
				const q = searchEl.value.trim().toLowerCase();
                const isSearching = q.length > 0;

                // Toggle Show More button visibility
                if (showMoreBtn) {
                    showMoreBtn.style.display = isSearching ? "none" : "block";
                }

				for (const item of listEl.children) {
				    // keep the Select All row visible
					if (item.classList.contains("efs-all") || item.getAttribute("data-role") === "select-all") {
						item.style.display = "";
						continue;
					}
					
                    const v = item.getAttribute("data-label") || "";
                    const matches = v.includes(q);

                    if (isSearching) {
                        item.style.display = matches ? "flex" : "none";
                    } else {
                        // Restore accordion state
                        const idx = itemRows.indexOf(item);
                        if (idx < SHOW_LIMIT || isExpanded) {
                            item.style.display = "flex";
                        } else {
                            item.style.display = "none";
                        }
                    }
				}
			});

			columnEls[c] = {
				type: "categorical",
				listEl,
				searchEl,
				checkboxes,
				countSpans,
				selectAll: selAllChk,
				totalCounts: counts,
				labelsByValue: labels,
				valueOrder: valueKeys.slice()
			};
			continue;
		}

        // NEW: Handle date type (similar to numeric but with date parsing/formatting)
        if (columnType === "numeric" || columnType === "date") {
            const isDate = columnType === "date";
			const columnValues = wells.map(row => row[c]);
            
            let numericValues;
            if (isDate) {
                numericValues = columnValues
                    .map(val => {
                        const d = new Date(val);
                        return isNaN(d) ? NaN : d.getTime();
                    })
                    .filter(val => !Number.isNaN(val));
            } else {
                numericValues = columnValues
                    .map(val => (typeof val === "number" ? val : parseFloat(val)))
                    .filter(val => !Number.isNaN(val));
            }

			if (numericValues.length === 0) continue;

			numericValues.sort((a, b) => a - b);

			const minValue = numericValues[0];
			const maxValue = numericValues[numericValues.length - 1];
			const stepAttr = isDate ? 86400000 : (numericValues.some(val => !Number.isInteger(val)) ? "any" : "1"); // 1 day for dates

            let sliderMin, sliderMax;
            if (isDate) {
                sliderMin = minValue;
                sliderMax = maxValue;
            } else {
                const valueRange = maxValue - minValue;
                const paddingBase = valueRange === 0 ? Math.max(Math.abs(minValue), Math.abs(maxValue)) : valueRange;
                const padding = (paddingBase || 1) * 0.01;
                sliderMin = minValue - padding;
                sliderMax = maxValue + padding;
                if (stepAttr === "1") {
                    sliderMin = Math.floor(sliderMin);
                    sliderMax = Math.ceil(sliderMax);
                }
            }
			const sliderRange = sliderMax - sliderMin;

			selected[c] = { min: minValue, max: maxValue, includeNull: true }; // CHANGED: Default includeNull to true

			const box = document.createElement("div");
			box.className = "efs-col";

            // NEW: Restore expansion state
            if (window._efsExpandedFilters.has(c)) {
                box.classList.add("active");
            }

			const columnSlug = slugifyAttr(c);
			const minName = `range-${columnSlug}-min`;
			const maxName = `range-${columnSlug}-max`;
			const minId = `${minName}-${Math.random().toString(36).slice(2,8)}`;
			const maxId = `${maxName}-${Math.random().toString(36).slice(2,8)}`;

			const head = document.createElement("div");
			head.className = "efs-head";
			const title = document.createElement("div");
			title.className = "efs-title";
            const labelMapping = { 
                "spud_date": "Spud Date", 
                "lat": "Latitude", 
                "lon": "Longitude",
                "orate": "Oil Rate (Ton/day)",
                "wrate": "Water Rate (Ton/day)",
                "grate": "Gas Rate (Ton/day)"
            };
			title.textContent = labelMapping[c.toLowerCase()] || capitalize(c);
			head.appendChild(title);
            
            // Accordion Arrow
            const arrow = document.createElement("span");
            arrow.className = "accordion-arrow";
            arrow.textContent = "▼";
            head.appendChild(arrow);

			box.appendChild(head);

            // Accordion Body
            const body = document.createElement("div");
            body.className = "efs-body";

			const rangeWrap = document.createElement("div");
			rangeWrap.className = "efs-range";

			const valuesWrap = document.createElement("div");
			valuesWrap.className = "efs-range-values";

            const formatVal = (v) => {
                if (isDate) {
                    const d = new Date(v);
                    return d.toISOString().split('T')[0];
                }
                return formatNumber(v, 2);
            };

			const minValueEl = document.createElement("span");
			minValueEl.className = "efs-range-min-value";
			minValueEl.textContent = formatVal(minValue);

			const maxValueEl = document.createElement("span");
			maxValueEl.className = "efs-range-max-value";
			maxValueEl.textContent = formatVal(maxValue);

			valuesWrap.appendChild(minValueEl);
			valuesWrap.appendChild(maxValueEl);

			const sliderTrack = document.createElement("div");
			sliderTrack.className = "efs-range-slider";

			const sliderProgress = document.createElement("div");
			sliderProgress.className = "efs-range-progress";
			sliderTrack.appendChild(sliderProgress);

			const pointersWrap = document.createElement("div");
			pointersWrap.className = "efs-range-pointers";

			const minInput = document.createElement("input");
			minInput.className = "efs-range-min";
			minInput.type = "range";
			minInput.id = minId;
			minInput.name = minName;
			minInput.min = String(sliderMin);
			minInput.max = String(sliderMax);
			minInput.step = String(stepAttr);
			minInput.value = String(sliderMin);

			const maxInput = document.createElement("input");
			maxInput.className = "efs-range-max";
			maxInput.type = "range";
			maxInput.id = maxId;
			maxInput.name = maxName;
			maxInput.min = String(sliderMin);
			maxInput.max = String(sliderMax);
			maxInput.step = String(stepAttr);
			maxInput.value = String(sliderMax);

			pointersWrap.appendChild(minInput);
			pointersWrap.appendChild(maxInput);

			rangeWrap.appendChild(valuesWrap);
			rangeWrap.appendChild(sliderTrack);
			rangeWrap.appendChild(pointersWrap);

			body.appendChild(rangeWrap); // Append to body
			
            // Include Null Checkbox
			const includeNullLabel = document.createElement("label");
			includeNullLabel.className = "efs-include-null";

			const includeNullCheckbox = document.createElement("input");
			includeNullCheckbox.type = "checkbox";
			includeNullCheckbox.id = `include-null-${columnSlug}`;
			includeNullCheckbox.name = `range-${columnSlug}-include-null`;
            includeNullCheckbox.checked = true; // NEW: Default checked

            // NEW: Add change listener
            includeNullCheckbox.addEventListener("change", () => {
                selected[c].includeNull = includeNullCheckbox.checked;
                if (typeof window.applyWellVisibilityFilters === "function") {
                    window.applyWellVisibilityFilters();
                }
            });

			const includeNullText = document.createElement("span");
			includeNullText.textContent = "Include non-numerical data";

			includeNullLabel.appendChild(includeNullCheckbox);
			includeNullLabel.appendChild(includeNullText);
			body.appendChild(includeNullLabel); // Append to body

            box.appendChild(body);
			colArea.appendChild(box);

            // Toggle Accordion
            head.addEventListener("click", () => {
                box.classList.toggle("active");
                // NEW: Save expansion state
                if (box.classList.contains("active")) {
                    window._efsExpandedFilters.add(c);
                } else {
                    window._efsExpandedFilters.delete(c);
                }
            });

			const setActiveHandle = (active) => {
				minInput.classList.toggle("is-top", active === minInput);
				maxInput.classList.toggle("is-top", active === maxInput);
			};
			setActiveHandle(maxInput);

			const syncMin = (val) => {
				const maxVal = parseFloat(maxInput.value);
				if (val > maxVal) {
					val = maxVal;
					minInput.value = String(val);
				}
				selected[c].min = val;
				minValueEl.textContent = formatVal(val);
				if (sliderProgress && sliderRange !== 0) {
					const relative = Math.max(0, Math.min(1, (val - sliderMin) / sliderRange));
					sliderProgress.style.left = (relative * 100).toFixed(2) + "%";
				}
			};

			const syncMax = (val) => {
				const minVal = parseFloat(minInput.value);
				if (val < minVal) {
					val = minVal;
					maxInput.value = String(val);
				}
				selected[c].max = val;
				maxValueEl.textContent = formatVal(val);
				if (sliderProgress && sliderRange !== 0) {
					const relative = Math.max(0, Math.min(1, (val - sliderMin) / sliderRange));
					sliderProgress.style.right = (100 - relative * 100).toFixed(2) + "%";
				}
			};

			minInput.addEventListener("input", () => {
				const value = parseFloat(minInput.value);
				if (Number.isNaN(value)) return;
				syncMin(value);
				setActiveHandle(minInput);
				if (typeof window.applyWellVisibilityFilters === "function") {
					window.applyWellVisibilityFilters();
				}
			});

			maxInput.addEventListener("input", () => {
				const value = parseFloat(maxInput.value);
				if (Number.isNaN(value)) return;
				syncMax(value);
				setActiveHandle(maxInput);
				if (typeof window.applyWellVisibilityFilters === "function") {
					window.applyWellVisibilityFilters();
				}
			});

			["pointerdown", "touchstart", "mousedown", "focus"].forEach(evt => {
				minInput.addEventListener(evt, () => setActiveHandle(minInput));
				maxInput.addEventListener(evt, () => setActiveHandle(maxInput));
			});

			syncMin(minValue);
			syncMax(maxValue);

			columnEls[c] = {
				type: isDate ? "date" : "numeric",
				minInput,
				maxInput,
				minDisplay: minValueEl,
				maxDisplay: maxValueEl
			};
		}
	}

	return {
		selected,
		columnEls,
		cols: Object.keys(wells[0]),
		wellsList: wells.map(w => w.well)
	};
}

// Helper for custom searchable dropdown
function createSearchableDropdown(container, optionsList, initialValue, onSelect, placeholderText) {
    const dropdown = L.DomUtil.create('div', 'efs-dropdown', container);
    
    const trigger = L.DomUtil.create('div', 'efs-dropdown-trigger', dropdown);
    trigger.tabIndex = 0; // Make focusable
    
    // Sort options: keep "All" (empty value) at top, sort others alphabetically
    const sortedOptions = [...optionsList].sort((a, b) => {
        const valA = typeof a === 'object' ? a.value : a;
        const valB = typeof b === 'object' ? b.value : b;
        const labelA = typeof a === 'object' ? a.label : a;
        const labelB = typeof b === 'object' ? b.label : b;

        if (valA === "" && valB !== "") return -1;
        if (valB === "" && valA !== "") return 1;
        
        return String(labelA).localeCompare(String(labelB));
    });

    // Helper to get label from value
    const getLabel = (val) => {
        const opt = sortedOptions.find(o => (typeof o === 'object' ? o.value : o) === val);
        return opt ? (typeof opt === 'object' ? opt.label : opt) : placeholderText;
    };
    
    trigger.textContent = getLabel(initialValue);
    
    const menu = L.DomUtil.create('div', 'efs-dropdown-menu', dropdown);
    
    const searchContainer = L.DomUtil.create('div', 'efs-dropdown-search', menu);
    const searchInput = L.DomUtil.create('input', '', searchContainer);
    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    
    const list = L.DomUtil.create('div', 'efs-dropdown-list', menu);
    
    function renderOptions(filterText = '') {
        list.innerHTML = '';
        const lowerFilter = filterText.toLowerCase();
        
        sortedOptions.forEach(opt => {
            const val = typeof opt === 'object' ? opt.value : opt;
            const label = typeof opt === 'object' ? opt.label : opt;
            
            if (String(label).toLowerCase().includes(lowerFilter)) {
                const item = L.DomUtil.create('div', 'efs-dropdown-option', list);
                item.textContent = label;
                if (val === initialValue) {
                    item.classList.add('selected');
                }
                
                L.DomEvent.on(item, 'click', (e) => {
                    L.DomEvent.stop(e);
                    trigger.textContent = label;
                    initialValue = val;
                    menu.style.display = 'none';
                    onSelect(val);
                });
            }
        });
        
        if (list.children.length === 0) {
            const noRes = L.DomUtil.create('div', 'efs-dropdown-option', list);
            noRes.textContent = 'No results';
            noRes.style.color = '#999';
            noRes.style.cursor = 'default';
        }
    }
    
    // Toggle menu
    L.DomEvent.on(trigger, 'click', (e) => {
        L.DomEvent.stop(e);
        const isVisible = menu.style.display === 'flex';
        
        // Close others
        document.querySelectorAll('.efs-dropdown-menu').forEach(el => {
            if (el !== menu) el.style.display = 'none';
        });
        
        if (!isVisible) {
            menu.style.display = 'flex';
            searchInput.value = '';
            renderOptions();
            setTimeout(() => searchInput.focus(), 50);
        } else {
            menu.style.display = 'none';
        }
    });
    
    // Search input handling
    L.DomEvent.on(searchInput, 'input', (e) => {
        renderOptions(e.target.value);
    });
    
    L.DomEvent.on(searchInput, 'click', L.DomEvent.stop);
    L.DomEvent.on(searchInput, 'mousedown', L.DomEvent.stop);
    
    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
    
    return dropdown;
}

// NEW: Create formation selector dropdown widget
function createFormationSelectorWidget(mapInstance, formationNames) {
    // NEW: Remove existing widget to prevent shadow accumulation
    if (window._efsFormationSelectorEl) {
        try { window._efsFormationSelectorEl.remove(); } catch (e) {}
        window._efsFormationSelectorEl = null;
    }

	if (!formationNames || formationNames.length === 0) {
		console.warn("No formations to populate selector");
		return;
	}

	// Create container
	const container = L.DomUtil.create('div', 'formation-selector-container');
	// CHANGED: removed previous inline bottom/right styles; keep minimal styling
	container.style.background = 'white';
	container.style.padding = '6px';
	container.style.borderRadius = '4px';
	container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.2)';
	container.style.display = 'flex';
	container.style.alignItems = 'center';
	container.style.gap = '6px';
	container.style.fontFamily = 'Arial, sans-serif';
	container.style.zIndex = '2100';

	// Label
	const label = L.DomUtil.create('label', '', container);
	label.textContent = "Select Horizon:";
	label.style.fontWeight = "bold";

    // Use custom searchable dropdown
    createSearchableDropdown(container, formationNames, selectedHorizon, (newFormation) => {
        if (newFormation && newFormation !== selectedHorizon) {
			// remove any existing highlight immediately (prevents leftover circle)
			if (window._efsHighlightedMarker) {
				try { mapInstance.removeLayer(window._efsHighlightedMarker); } catch (e) {}
				window._efsHighlightedMarker = null;
			}

			// Update URL and reloadFF
			const currentUrl = new URL(window.location.href);
			currentUrl.searchParams.set("formation", newFormation);
			window.history.replaceState({}, "", currentUrl.toString());
			
			selectedHorizon = newFormation;
			loadWellsForHorizon(newFormation);
		}
    }, "Select Formation");

	// Prevent map interactions
	L.DomEvent.disableClickPropagation(container);
	L.DomEvent.disableScrollPropagation(container);

	// Add to map container
	mapInstance._container.appendChild(container);
	window._efsFormationSelectorEl = container;
	updateSelectorPositions();
	return container;
}

// NEW: Create well selector dropdown widget
function createWellSelectorWidget(mapInstance, wellNames) {
    // NEW: Remove existing widget to prevent shadow accumulation
    if (window._efsWellSelectorEl) {
        try { window._efsWellSelectorEl.remove(); } catch (e) {}
        window._efsWellSelectorEl = null;
    }

	if (!wellNames || wellNames.length === 0) {
		console.warn("No wells to populate selector");
		return;
	}

	// NEW: state + helpers
	let lastSelectedWell = "";
	function clearHighlight() {
		if (window._efsHighlightedMarker) {
			try { mapInstance.removeLayer(window._efsHighlightedMarker); } catch (e) {}
			window._efsHighlightedMarker = null;
		}
	}
	function recenterToDefault() {
		clearHighlight();
		if (typeof window._efsRecenterToDefault === 'function') {
			window._efsRecenterToDefault();
		} else {
			mapInstance.setView(window._efsDefaultCenter || mapInstance.getCenter(), window._efsDefaultZoom || 14, { animate: true });
		}
	}

	const BASE_ZOOM = 14;
	const WELL_ZOOM = 10; // min zoom when focusing on a well

	// Create container
	const container = L.DomUtil.create('div', 'well-selector-container');
	// CHANGED: removed previous inline bottom/center styles; keep minimal styling
	container.style.background = 'white';
	container.style.padding = '6px';
	container.style.borderRadius = '4px';
	container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.2)';
	container.style.display = 'flex';
	container.style.alignItems = 'center';
	container.style.gap = '6px';
	container.style.fontFamily = 'Arial, sans-serif';
	container.style.zIndex = '2100';

	// Label
	const label = L.DomUtil.create('label', '', container);
	label.textContent = "Select Well:";
	label.style.fontWeight = "bold";

    // Prepare options with "All"
    const options = [{value: "", label: "All"}, ...wellNames.map(w => ({value: w, label: w}))];

    // Use custom searchable dropdown
    createSearchableDropdown(container, options, "", (selectedWell) => {
        lastSelectedWell = selectedWell;
		clearHighlight();

		if (selectedWell) {
			mapInstance.eachLayer(layer => {
				if (layer instanceof L.CircleMarker) {
					const key = (layer.options?.searchKey || '').toLowerCase();
					if (key === selectedWell.toLowerCase()) {
						// Highlight the marker visually
						layer.setStyle({ fillOpacity: 1, weight: 3 });
						layer.bringToFront();
						
						// Add red circle highlight around the marker
						const latlng = layer.getLatLng();
						// CHANGED: Use circleMarker (pixels) instead of circle (meters) for consistent visibility
						const highlightCircle = L.circleMarker(latlng, {
							color: 'white', // White border for contrast
							fillColor: 'purple',
							fillOpacity: 1, // Solid purple
							weight: 2,
							radius: 6, // Slightly larger than normal markers (4)
							interactive: false
						}).addTo(mapInstance);
						
                        // NEW: Attach well ID to highlight for filtering checks
                        highlightCircle._efsWellId = selectedWell;

						// store globally so it can be removed when formation changes
						window._efsHighlightedMarker = highlightCircle;
						
						// compute target zoom: zoom in to at least WELL_ZOOM if currently more zoomed out
						const currentZoom = mapInstance.getZoom();
						const targetZoom = Math.max(WELL_ZOOM, currentZoom);
						mapInstance.flyTo(latlng, targetZoom, { animate: true });
						
						// Open popup
						if (layer._popup) layer.openPopup();

                        // NEW: Show details sidebar with chart
                        if (typeof showWellDetails === 'function') {
                            showWellDetails(selectedWell);
                        }
					} else {
						// Reset other markers to default style
						if (layer._defaultStyle) {
							layer.setStyle(layer._defaultStyle);
						}
					}
				}
			});
		} else {
			recenterToDefault();
            // NEW: Close details sidebar when "All" is selected
            if (details_sidebar) details_sidebar.hide();
		}
    }, "All");

	// Prevent map interactions
	L.DomEvent.disableClickPropagation(container);
	L.DomEvent.disableScrollPropagation(container);

	// Add to map container
	mapInstance._container.appendChild(container);
	window._efsWellSelectorEl = container;
	updateSelectorPositions();
	return container;
}

// NEW smoother positioning helper
function updateSelectorPositions() {
	const sidebarEl = filter_sidebar?._container;
    const detailsSidebarEl = details_sidebar?._container; // NEW
	const mapContainer = map?._container;
	if (!mapContainer) return;

	const sidebarVisible = filter_sidebar?.isVisible?.();
	const sidebarWidth = sidebarEl ? sidebarEl.offsetWidth : 0;
    
    const detailsVisible = details_sidebar?.isVisible?.(); // NEW
    const detailsWidth = detailsSidebarEl ? detailsSidebarEl.offsetWidth : 0; // NEW

	const formationWidth = window._efsFormationSelectorEl ? window._efsFormationSelectorEl.getBoundingClientRect().width : 220;
    const wellSelectorWidth = window._efsWellSelectorEl ? window._efsWellSelectorEl.getBoundingClientRect().width : 220;

    // CHANGED: When collapsed (not visible), shift by 32px (tab width) instead of 0
    const shiftAmount = sidebarVisible ? sidebarWidth : 32;
    const rightShiftAmount = detailsVisible ? detailsWidth : 32; // NEW

    // NEW: Update details sidebar maxWidth to stop at well selector
    if (details_sidebar) {
        // Calculate the rightmost edge of the well selector (plus margin)
        // well selector is at 'shiftAmount + formationWidth + 16' from left
        const wellSelectorRightEdge = shiftAmount + formationWidth + 16 + wellSelectorWidth + 20; // 20px margin
        const availableWidth = window.innerWidth - wellSelectorRightEdge;
        
        // Update the maxWidth dynamically
        details_sidebar.options.maxWidth = Math.max(300, availableWidth); 
    }

	mapContainer.style.setProperty('--efsSidebarShift', `${shiftAmount}px`);
    mapContainer.style.setProperty('--efsSidebarRightShift', `${rightShiftAmount}px`); // NEW
	mapContainer.style.setProperty('--efsFormationWidth', `${formationWidth}px`);

	// push Leaflet controls beneath the selectors (skip on mobile where selectors move to bottom)
	const isMobile = window.matchMedia('(max-width: 767px)').matches;
	const selectorHeight = window._efsFormationSelectorEl ? window._efsFormationSelectorEl.getBoundingClientRect().height : 0;
	const verticalOffset = isMobile ? 10 : (selectorHeight ? selectorHeight + 32 : 92);
	mapContainer.style.setProperty('--efsTopControlOffset', `${verticalOffset}px`);

	if (window._efsFormationSelectorEl) window._efsFormationSelectorEl.style.display = 'flex';
	if (window._efsWellSelectorEl) window._efsWellSelectorEl.style.display = 'flex';
	if (window._efsTimeSliderEl) window._efsTimeSliderEl.style.display = 'flex';
}

// Re-run positioning on sidebar transitions and window resize (throttled)
const handleResize = (() => {
	let pending = false;
	return () => {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			updateSelectorPositions();
		});
	};
})();

filter_sidebar.on('show', updateSelectorPositions);
filter_sidebar.on('hide', updateSelectorPositions);
filter_sidebar.on('shown', updateSelectorPositions);
filter_sidebar.on('hidden', updateSelectorPositions);
filter_sidebar.on('resize', updateSelectorPositions); // Update widgets during resize

// NEW: Listeners for details sidebar to adjust right-side controls
details_sidebar.on('show', updateSelectorPositions);
details_sidebar.on('hide', updateSelectorPositions);
details_sidebar.on('shown', updateSelectorPositions);
details_sidebar.on('hidden', updateSelectorPositions);
details_sidebar.on('resize', updateSelectorPositions);

window.addEventListener('resize', handleResize);

// Re-run positioning on sidebar transitions and window resize
(function(){
	let pending = false;
	const onResize = () => {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => {
			pending = false;
			updateSelectorPositions();
		});
	};
	window.addEventListener('resize', onResize);
})();

// Re-run positioning on sidebar transitions and window resize
filter_sidebar.on('shown', updateSelectorPositions);
filter_sidebar.on('hidden', updateSelectorPositions);
window.addEventListener('resize', updateSelectorPositions);

// NEW: Fetch Real Weather Data
async function fetchWeatherData() {
    const center = map.getCenter();
    const lat = center.lat;
    const lon = center.lng;
    
    try {
        // Fetch Wind
        const windRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m`);
        const windData = await windRes.json();
        
        if (windData.current) {
            // wind_speed_10m is in km/h
            windLayer.setWeather(windData.current.wind_speed_10m, windData.current.wind_direction_10m);
        }

        // Fetch Wave
        const waveRes = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction`);
        const waveData = await waveRes.json();
        
        if (waveData.current) {
            // wave_height is in meters. Scale up for visibility (e.g. 1m wave ~ 10km/h wind visually)
            waveLayer.setWeather(waveData.current.wave_height * 20, waveData.current.wave_direction);
        }
        
        console.log("Weather data updated for", lat, lon);
        
    } catch (e) {
        console.error("Failed to fetch weather data", e);
    }
}

// Initial fetch
fetchWeatherData();

// Update when map moves (debounced could be better, but simple for now)
map.on('moveend', fetchWeatherData);


function applyWellVisibilityFilters() {
	const state = window._efsState;
	const dataset = window._efsDataset;
	if (!state || !dataset) return;

	const { selected, COLS, columnTypes } = state;
	const { rowsByWell, wellIds } = dataset;

	const visible = new Set();

	for (const wid of wellIds) {
		const row = rowsByWell.get(wid);
		if (!row) continue;

        // NEW: Time Filter Check (Spud Date)
        if (window._efsTimeFilterDate !== undefined && window._efsTimeFilterDate !== null) {
            const spudDate = row.spud_date ? new Date(row.spud_date).getTime() : null;
            // If spud_date is missing or in the future relative to slider, hide it
            if (!spudDate || spudDate > window._efsTimeFilterDate) {
                continue;
            }
        }

		let include = true;
		for (const col of COLS) {
			const control = selected[col];
			if (!control) continue;

			const type = columnTypes?.[col];
			if (type === "categorical") {
				if (control.size === 0) { include = false; break; }
				const rowVal = norm(row[col]);
				if (!control.has(rowVal)) { include = false; break; }
			} else if (type === "numeric" || type === "date") {
				const rawValue = row[col];
                // NEW: Handle null/undefined/empty values for numeric columns
                const isNull = rawValue === null || rawValue === undefined || rawValue === "";
                
                if (isNull) {
                    if (!control.includeNull) { include = false; break; }
                } else {
                    let value;
                    if (type === "date") {
                        const d = new Date(rawValue);
                        value = isNaN(d) ? NaN : d.getTime();
                    } else {
                        value = Number(rawValue);
                    }

                    if (!Number.isFinite(value)) { 
                        if (!control.includeNull) { include = false; break; }
                    } else {
                        const min = Number(control.min);
                        const max = Number(control.max);
                        if (Number.isFinite(min) && value < min) { include = false; break; }
                        if (Number.isFinite(max) && value > max) { include = false; break; }
                    }
                }
			}
		}

		if (include) {
			visible.add(wid);
		}
	}

    // NEW: Remove highlight if the selected well is filtered out
    if (window._efsHighlightedMarker && window._efsHighlightedMarker._efsWellId) {
        const highlightId = norm(window._efsHighlightedMarker._efsWellId);
        if (!visible.has(highlightId)) {
            map.removeLayer(window._efsHighlightedMarker);
            window._efsHighlightedMarker = null;
        }
    }

	const visibilityState = window._efsVisibilityState ||= new Map();
	for (const wid of wellIds) {
		const shouldShow = visible.has(wid);
		if (visibilityState.get(wid) === shouldShow) continue;
		if (typeof window.toggleWellMarkerVisibility === "function") {
			window.toggleWellMarkerVisibility(wid, shouldShow);
		}
		visibilityState.set(wid, shouldShow);
	}

	if (typeof window.recomputeAvailableCounts === "function") {
		const availableCounts = window.recomputeAvailableCounts(visible);
		if (availableCounts && state.columnEls) {
			for (const col of state.COLS) {
				const columnEl = state.columnEls[col];
				if (!columnEl || columnEl.type !== "categorical") continue;
				const spans = columnEl.countSpans;
				const totals = columnEl.totalCounts || {};
				const colCounts = availableCounts[col] || {};
				for (const [valKey, span] of spans.entries()) {
					const total = totals[valKey] || 0;
					const selectedTotal = colCounts[valKey] || 0;
					span.textContent = `(${selectedTotal}/${total})`;
				}
			}
		}
	}
}

window.applyWellVisibilityFilters = applyWellVisibilityFilters;

// NEW: Listen for time slider changes
document.addEventListener('efs:time-range-changed', (e) => {
    window._efsTimeFilterDate = e.detail.currentTs;
    applyWellVisibilityFilters();
});

let horizonNames = [];
let selectedHorizon = null;
window._efsTimeSliderEl = null;

function createTimeSliderWidget(mapInstance, wells) {
    if (window._efsTimeSliderEl) {
        try { window._efsTimeSliderEl.remove(); } catch (e) {}
    }
    
    // Calculate min/max dates from wells
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    if (wells && Array.isArray(wells)) {
        wells.forEach(w => {
            if (w.spud_date) {
                const d = new Date(w.spud_date);
                if (!isNaN(d.getTime())) {
                    const t = d.getTime();
                    if (t < minTime) minTime = t;
                    if (t > maxTime) maxTime = t;
                }
            }
        });
    }

    // Fallback if no valid dates found
    if (minTime === Infinity) {
        const now = new Date();
        minTime = now.getTime();
        maxTime = now.getTime() + 86400000;
    }
    
    // Ensure max > min
    if (maxTime <= minTime) {
        maxTime = minTime + 86400000;
    }

    const container = L.DomUtil.create('div', 'time-slider-container');
    
    // NEW: Add title
    const title = L.DomUtil.create('div', 'time-slider-title', container);
    title.textContent = "Stream wells according spud date";

    const startDate = new Date(minTime);
    const endDate = new Date(maxTime);
    const dayStep = 86400000; // 1 day in ms

    const wrapper = L.DomUtil.create('div', 'time-slider-wrapper', container);
    const track = L.DomUtil.create('div', 'time-slider-track', wrapper);
    const progress = L.DomUtil.create('div', 'time-slider-progress', wrapper);

    // NEW: Controls container for Play button and Label
    const controls = L.DomUtil.create('div', 'time-slider-controls', container);

    // Play Button
    const playBtn = L.DomUtil.create('button', 'time-slider-play-btn', controls);
    playBtn.title = "Play";
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

    // NEW: Speed Button
    const speedBtn = L.DomUtil.create('button', 'time-slider-speed-btn', controls);
    speedBtn.textContent = "1x";
    speedBtn.title = "Animation Speed";
    speedBtn.style.marginLeft = "8px";
    speedBtn.style.minWidth = "30px";
    speedBtn.style.cursor = "pointer";
    speedBtn.style.background = "none";
    speedBtn.style.border = "none";
    speedBtn.style.color = "inherit";
    speedBtn.style.fontSize = "12px";
    speedBtn.style.fontWeight = "bold";

    // Label (moved inside controls)
    const label = L.DomUtil.create('div', 'time-slider-label', controls);

    const timeInput = L.DomUtil.create('input', '', wrapper);
    timeInput.type = 'range';
    timeInput.min = minTime;
    timeInput.max = maxTime;
    timeInput.step = dayStep;
    timeInput.value = maxTime; // Default to showing all wells

    const formatDate = (ts) => {
        const d = new Date(Number(ts));
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const updateUI = () => {
        const currentVal = Number(timeInput.value);

        // Update progress bar
        const totalRange = maxTime - minTime;
        if (totalRange > 0) {
            const widthPercent = ((currentVal - minTime) / totalRange) * 100;
            progress.style.left = '0%';
            progress.style.width = widthPercent + '%';
        } else {
            progress.style.left = '0%';
            progress.style.width = '100%';
        }

        label.textContent = `${formatDate(currentVal)}`;
        
        document.dispatchEvent(new CustomEvent('efs:time-range-changed', {
            detail: { 
                currentDate: new Date(currentVal), 
                currentTs: currentVal
            }
        }));
    };

    // Animation Logic
    let isPlaying = false;
    let animationId = null;
    let speedMultiplier = 1;
    const baseStep = dayStep * 7; // 7 days per frame base speed

    const stopAnimation = () => {
        isPlaying = false;
        if (animationId) {
            clearInterval(animationId);
            animationId = null;
        }
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        playBtn.title = "Play";
    };

    const startAnimation = () => {
        isPlaying = true;
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        playBtn.title = "Pause";

        animationId = setInterval(() => {
            let currentVal = Number(timeInput.value);
            let nextVal = currentVal + (baseStep * speedMultiplier);

            // Loop if end reached
            if (nextVal > maxTime) {
                nextVal = minTime;
            }

            timeInput.value = nextVal;
            updateUI();
        }, 100); // 10 frames per second
    };

    L.DomEvent.on(playBtn, 'click', (e) => {
        L.DomEvent.stop(e);
        if (isPlaying) stopAnimation();
        else startAnimation();
    });

    L.DomEvent.on(speedBtn, 'click', (e) => {
        L.DomEvent.stop(e);
        if (speedMultiplier === 1) speedMultiplier = 2;
        else if (speedMultiplier === 2) speedMultiplier = 5;
        else speedMultiplier = 1;
        
        speedBtn.textContent = speedMultiplier + "x";
        
        // Restart animation if playing to apply new speed
        if (isPlaying) {
            stopAnimation();
            startAnimation();
        }
    });

    // Stop animation on manual interaction
    const stopOnInteract = () => { if (isPlaying) stopAnimation(); };
    L.DomEvent.on(timeInput, 'mousedown', stopOnInteract);
    L.DomEvent.on(timeInput, 'touchstart', stopOnInteract);

    timeInput.addEventListener('input', updateUI);

    updateUI();
    
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    mapInstance._container.appendChild(container);
    window._efsTimeSliderEl = container;
    updateSelectorPositions();
    return container;
}

// Extract formation from URL query params or use default
function getInitialFormation() {
	const params = new URLSearchParams(window.location.search);
	return params.get("formation") || "Bal_IX";
}

// Fetch and display wells data for the selected horizon
function loadWellsForHorizon(formation) {
	if (!formation || typeof formation !== "string") {
		console.warn("Invalid formation name");
		return;
	}

	// remove any existing highlight before reloading layers
	if (window._efsHighlightedMarker) {
		try { map.removeLayer(window._efsHighlightedMarker); } catch (e) {}
		window._efsHighlightedMarker = null;
	}

    // Clear the marker cache to ensure new markers are tracked correctly
    if (window._efsWellMarkerCache) {
        window._efsWellMarkerCache.clear();
    }

	fetch(`/wells?formation=${encodeURIComponent(formation)}`)
		.then(response => response.json())
		.then(async raw => {
			const { wells, statusColors: statusColorOverrides } = normalizeWellsPayload(raw);

            // NEW: Fetch and merge rates data for filters
            try {
                const ratesRes = await fetch('/rates/latest');
                if (ratesRes.ok) {
                    const latestRatesList = await ratesRes.json();
                    const latestRates = {};
                    latestRatesList.forEach(r => {
                        latestRates[r.well] = r;
                    });
                    
                    wells.forEach(w => {
                        const rate = latestRates[w.well];
                        if (rate) {
                             ['days', 'formation', 'otype', 'fluid', 'method', 'choke', 'orate', 'wrate', 'grate'].forEach(k => {
                                if (rate[k] !== undefined) w[k] = rate[k];
                             });
                        }
                    });

                    // Ensure keys exist in the first row for detection
                    if (wells.length > 0) {
                        ['days', 'formation', 'otype', 'fluid', 'method', 'choke', 'orate', 'wrate', 'grate'].forEach(k => {
                            if (wells[0][k] === undefined) wells[0][k] = null;
                        });
                    }
                }
            } catch (e) {
                console.error("Error merging rates:", e);
            }
			const {
				resolve: statusColor,
				palette: statusColorPalette,
				defaultColor: statusColorDefault
			} = createStatusColorResolver(statusColorOverrides);

			window._efsStatusColors = {
				palette: statusColorPalette,
				defaultColor: statusColorDefault
			};

			markerColorState.baseResolver = row => {
                return statusColor(row.status);
            };
			markerColorState.baseDefault = statusColorDefault || DEFAULT_STATUS_COLOR;
			if (!markerColorState.activeColumn) {
				markerColorState.defaultColor = statusColorDefault || DEFAULT_STATUS_COLOR;
			}
			if (!markerColorState.colorsByValue || typeof markerColorState.colorsByValue !== "object") {
				markerColorState.colorsByValue = {};
			}

			// Clear existing layers before adding new ones
			map.eachLayer(layer => {
				if (layer instanceof L.FeatureGroup && layer !== map) {
					map.removeLayer(layer);
				}
			});

			const wellPointFeatureGroup = L.featureGroup().addTo(map);

			if (wells.length === 0) {
				console.warn("No wells returned; skipping layer setup.");
				return;
			}

			const types = detectColumnTypes(wells);
			const dataset = createWellDataset(wells);
			window._efsDataset = dataset;

			markersByWell.clear();
			populateWellPointFeatureGroup(wells, wellPointFeatureGroup, statusColor, markersByWell);

			const {
				selected,
				columnEls,
				cols: COLS,
				wellsList: WELLS
			} = buildFilterControls(wells, types);

			window._efsState = { selected, columnEls, COLS, WELLS, columnTypes: types };

			document.dispatchEvent(new CustomEvent("efs:dataset-ready", {
				detail: {
					columnTypes: types,
					totalWells: dataset.wellIds.length
				}
			}));

			applyMarkerColorsToAll();

			createWellSelectorWidget(map, WELLS);  // NEW: Create selector with well names
			createFormationSelectorWidget(map, horizonNames);  // NEW: Create formation selector
			createTimeSliderWidget(map, wells);
			applyWellVisibilityFilters();

		})
		.catch(err => console.error("Error loading wells info:", err));
}

// Fetch formation names from API
async function loadFormationNames() {
    try {
        const res = await fetch("/formations", { cache: "no-store" });
        const formations = await res.json();
        horizonNames = Array.isArray(formations)
            ? formations.map(f => typeof f === 'string' ? f : f.name || f)
            : [];
        
        // Initialize selectedHorizon from URL or default only on first call
        if (!selectedHorizon) {
            selectedHorizon = getInitialFormation();
            loadWellsForHorizon(selectedHorizon);
        }
    } catch (err) {
        console.error("Error loading formations:", err);
        horizonNames = [];
        if (!selectedHorizon) {
            selectedHorizon = "Balakhany";
            loadWellsForHorizon(selectedHorizon);
        }
    }
}

// Call the fetch + init function
loadFormationNames();

L.control.zoom({
    position: 'topleft',
    zoomInText: '+',
    zoomOutText: '-'
}).addTo(map);

(function(){
	const BASE_RECENTER = L.latLng(40.21838483721167, 51.07054395510173);
	const BASE_RECENTER_ZOOM = 14;

	function recenterWithSidebarAwareness(map) {
		const sidebarVisible = filter_sidebar?.isVisible?.();
		let targetCenter = BASE_RECENTER;

		if (sidebarVisible) {
			const sidebarOffset = filter_sidebar.getOffset?.() || 0;
			if (sidebarOffset !== 0) {
				const projected = map.project(BASE_RECENTER, BASE_RECENTER_ZOOM);
				const shifted = projected.add(L.point(-sidebarOffset / 2, 0));
				targetCenter = map.unproject(shifted, BASE_RECENTER_ZOOM);
			}
		}

		const currentCenter = map.getCenter();
		const currentZoom = map.getZoom();
		const needsCenterUpdate = Math.abs(currentCenter.lat - targetCenter.lat) > 1e-6 ||
			Math.abs(currentCenter.lng - targetCenter.lng) > 1e-6;
		const needsZoomUpdate = currentZoom !== BASE_RECENTER_ZOOM;

		if (needsCenterUpdate || needsZoomUpdate) {
			map.setView(targetCenter, BASE_RECENTER_ZOOM, { animate: false });
		}
	}

    // Export for use by other widgets (e.g. well selector)
    window._efsRecenterToDefault = function() {
        recenterWithSidebarAwareness(map);
    };

	const Recenter = L.Control.extend({
	options: { position: 'topleft' },
	onAdd: function(map) {
		var container = L.DomUtil.create('div', 'leaflet-control leaflet-control-recenter');

		// button element
		var btn = L.DomUtil.create('a', 'recenter-btn', container);
		btn.href = '#';
		btn.title = 'Re-center';
		btn.setAttribute('role','button');
		btn.setAttribute('aria-label','Re-center map');

		// crisp “target” SVG icon (white strokes)
		btn.innerHTML = `
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
			<path d="M12 4v3 M12 17v3 M4 12h3 M17 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
		</svg>
		`;

		// prevent map interactions when clicking/scrolling on the control
		L.DomEvent.disableClickPropagation(container);
		L.DomEvent.disableScrollPropagation(container);

		// click -> reset view
		L.DomEvent.on(btn, 'click', function(e){
			if (e) L.DomEvent.stop(e);
			recenterWithSidebarAwareness(map);
			});

		// keyboard (Enter/Space)
		L.DomEvent.on(btn, 'keydown', function(e){
		if (e.key === 'Enter' || e.key === ' ') {
			if (e) L.DomEvent.stop(e);
			recenterWithSidebarAwareness(map);
		}
		});

		return container;
		}
	});
	map.addControl(new Recenter());
})();

var measureControl = new L.Control.Measure({
	"position": "bottomright",
	"primaryLengthUnit": "meters",
	"secondaryLengthUnit": "kilometers",
	"primaryAreaUnit": "sqmeters",
	"secondaryAreaUnit": "hectares",
	"activeColor": "#ABE67E",
	"completedColor": "#C8F2BE",
	"collapsed": false,
});

map.addControl(measureControl);

// Workaround for using this plugin with Leaflet>=1.8.0
// https://github.com/ljagis/leaflet-measure/issues/171
L.Control.Measure.include({
	_setCaptureMarkerIcon: function () {
		// disable autopan
		this._captureMarker.options.autoPanOnFocus = false;
		// default function
		this._captureMarker.setIcon(
			L.divIcon({
				iconSize: this._map.getSize().multiplyBy(2)
			})
		);
	},
});

// HELPER FUNCTIONS

window.computeMatchedWells = function(){
	// NEW: if literally no boxes are checked anywhere, match nothing
	const totalSelected = COLS.reduce((n, c) => n + selected[c].size, 0);
	if (totalSelected === 0) return new Set();

	// AND across columns: for each column, if selection empty => pass
	// else row[c] must be in selected[c]
	const matched = new Set();
	for (const wid of WELLS) {
		const r = ROWS[wid];
		let ok = true;
		for (const c of COLS) {
			const set = selected[c];
			if (set.size === 0) continue; // no restriction
			const val = norm(r[c]);
			if (!set.has(val)) { ok = false; break; }
	  	}
	  	if (ok) matched.add(wid);
	}
	return matched;
}



window.recomputeAvailableCounts = function(visibleWells){
	const state = window._efsState;
	const dataset = window._efsDataset;
	if (!state || !dataset) return null;

	const { selected, COLS, columnTypes } = state;
	const { rowsByWell, wellIds } = dataset;

	const buildCountsFromSet = (wellSet) => {
		const result = {};
		for (const col of COLS) {
			if (columnTypes?.[col] !== "categorical") continue;

			const columnCounts = {};
			for (const wid of wellSet) {
				const row = rowsByWell.get(wid);
				if (!row) continue;
				const valKey = norm(row[col]);
				columnCounts[valKey] = (columnCounts[valKey] || 0) + 1;
			}
			result[col] = columnCounts;
		}
		return result;
	};

	if (visibleWells instanceof Set) {
		return buildCountsFromSet(visibleWells);
	}

	const countsByColumn = {};
	for (const col of COLS) {
		if (columnTypes?.[col] !== "categorical") continue;

		const columnCounts = {};
		for (const wid of wellIds) {
			const row = rowsByWell.get(wid);
			if (!row) continue;

			let include = true;
			for (const otherCol of COLS) {
				if (otherCol === col) continue;
				const control = selected[otherCol];
				if (!control) continue;

				const type = columnTypes?.[otherCol];
				if (type === "categorical") {
					if (!(control instanceof Set)) { include = false; break; }
					if (control.size === 0) { include = false; break; }
					const val = norm(row[otherCol]);
					if (!control.has(val)) { include = false; break; }
				} else if (type === "numeric" || type === "date") {
                    const rawValue = row[otherCol];
                    const isNull = rawValue === null || rawValue === undefined || rawValue === "";
                    
                    if (isNull) {
                        if (!control.includeNull) { include = false; break; }
                    } else {
                        let value;
                        if (type === "date") {
                            const d = new Date(rawValue);
                            value = isNaN(d) ? NaN : d.getTime();
                        } else {
                            value = Number(rawValue);
                        }

                        if (!Number.isFinite(value)) { 
                            if (!control.includeNull) { include = false; break; }
                        } else {
                            const min = Number(control.min);
                            const max = Number(control.max);
                            if (Number.isFinite(min) && value < min) { include = false; break; }
                            if (Number.isFinite(max) && value > max) { include = false; break; }
                        }
                    }
				}
			}

			if (!include) continue;
			const valueKey = norm(row[col]);
			columnCounts[valueKey] = (columnCounts[valueKey] || 0) + 1;
		}
		countsByColumn[col] = columnCounts;
	}

	return countsByColumn;
}

window.classifyLayer = function(l){
	const p = l?.options?.pane;
	if (p === "wellLabelDisplayed") return "label";
	if (p === "wellHeadInteractive") return "head";
	if (p === "wellTailInteractive") return "tail";
	if (p === "wellSurveyDisplayed") return "survey";

	if (typeof l.getLatLng === "function") {
		const el = (l.getElement && l.getElement()) || l._icon || null;
		if (el && (el.matches?.(".well-label") || el.querySelector?.(".well-label"))) return "label";
		if (l?.options?.icon?.options && ("html" in l.options.icon.options)) return "label";
		return "marker";
	}
	if (typeof l.getLatLngs === "function") return "path";
	return "other";
}

indexLayers = function(){

	LAYERS_BY_WELL = {}; // reset cleanly

	function visit(layer){
		if (!layer) return;

		// Try to get id from options
		let wid = layer?.options?.__well_id;

		// 2) fallback from DOM (DivIcon label)
		const el = (layer.getElement && layer.getElement()) || layer._icon || null;

		if (!wid && el) {
			// try <div class="well-label" data-well-id="...">
			const tag = el.matches?.(".well-label") ? el : el.querySelector?.(".well-label");
			const domId = tag?.dataset?.wellId || el?.dataset?.wellId;
			if (domId) {
				wid = domId;
				if (layer.options) layer.options.__well_id = wid; // cache for next runs
			}
		}

		if (wid) {
			(LAYERS_BY_WELL[wid] ||= []).push(layer);
			layer._efs_kind = classifyLayer(layer);
		}

		// Recurse into groups
		if (typeof layer.eachLayer === "function") {
			layer.eachLayer(visit);
		}
	}

	// Walk all top-level layers; this finds children inside FeatureGroups, too.
	map.eachLayer(visit);

}

indexLayers();

window.toggleWellMarkerVisibility = function (wellName, show) {
	window._efsWellMarkerCache ||= new Map();

	const normalized = (wellName || '').trim().toLowerCase();
	if (!normalized) {
		console.warn('toggleWellMarkerVisibility: supply a well name');
		return;
	}

	let targets = window._efsWellMarkerCache.get(normalized) || [];

	if (!targets.length) {
		const found = [];
		map.eachLayer(layer => {
		if (layer instanceof L.CircleMarker) {
			const key = (layer.options?.searchKey || '').toLowerCase();
			if (key === normalized) found.push(layer);
		}
		});
		if (found.length) {
			targets = found;
			window._efsWellMarkerCache.set(normalized, found);
		}
	}

	if (!targets.length) {
		console.warn(`toggleWellMarkerVisibility: no marker found for "${wellName}"`);
		return;
	}

	const makeVisibleExplicit = (typeof show === 'boolean');
	const anyHidden = targets.some(layer => layer._efsHidden);
	const makeVisible = makeVisibleExplicit ? show : anyHidden;

	targets.forEach(layer => {
		const parent =
			layer._efsParentGroup ||
			Object.values(layer._eventParents || {})[0] ||
			null;
		if (parent) layer._efsParentGroup = parent;

		if (makeVisible) {
			if (parent && !parent.hasLayer(layer)) parent.addLayer(layer);
			else if (!layer._map) layer.addTo(map);

			if (layer._defaultStyle && layer.setStyle) layer.setStyle(layer._defaultStyle);
			if (layer._defaultStyle?.radius && layer.setRadius) layer.setRadius(layer._defaultStyle.radius);
			if (layer._path) layer._path.style.display = '';
			layer._efsHidden = false;
		} else {
			layer._efsHidden = true;
			if (parent && parent.hasLayer(layer)) parent.removeLayer(layer);
			else if (layer._map) layer.remove();
		}
	});
};

// Ensure initial CSS var so widgets start in correct place even before sidebar events fire
(function initSidebarShift(){
	const mapContainer = map?._container;
	if (mapContainer) {
        if (!mapContainer.style.getPropertyValue('--efsSidebarShift')) {
		    mapContainer.style.setProperty('--efsSidebarShift','32px');
        }
        if (!mapContainer.style.getPropertyValue('--efsSidebarRightShift')) {
            mapContainer.style.setProperty('--efsSidebarRightShift','32px');
        }
		mapContainer.style.setProperty('--efsFormationWidth','220px');
	}
})();

// Ensure positioning updates after wells load (selectors recreated)
document.addEventListener('efs:dataset-ready', () => {
	setTimeout(updateSelectorPositions, 0);
});

// trigger once so widgets align even before data load
updateSelectorPositions();

// NEW: Fetch Real Weather Data
async function fetchWeatherData() {
    const center = map.getCenter();
    const lat = center.lat;
    const lon = center.lng;
    
    try {
        // Fetch Wind
        const windRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m`);
        const windData = await windRes.json();
        
        if (windData.current) {
            // wind_speed_10m is in km/h
            windLayer.setWeather(windData.current.wind_speed_10m, windData.current.wind_direction_10m);
        }

        // Fetch Wave
        const waveRes = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction`);
        const waveData = await waveRes.json();
        
        if (waveData.current) {
            // wave_height is in meters. Scale up for visibility (e.g. 1m wave ~ 10km/h wind visually)
            waveLayer.setWeather(waveData.current.wave_height * 20, waveData.current.wave_direction);
        }
        
        console.log("Weather data updated for", lat, lon);
        
    } catch (e) {
        console.error("Failed to fetch weather data", e);
    }
}

// Initial fetch
fetchWeatherData();

// Update when map moves (debounced could be better, but simple for now)
map.on('moveend', fetchWeatherData);

// Handle Map Tab Switch to fix Leaflet rendering issues
document.addEventListener('DOMContentLoaded', function() {
    var mapTabEl = document.querySelector("button[data-bs-target='#map-content']");
    if (mapTabEl) {
        mapTabEl.addEventListener('shown.bs.tab', function (event) {
            if (typeof map !== 'undefined') {
                setTimeout(function() {
                    map.invalidateSize();
                }, 100);
            }
        });
    }
});
