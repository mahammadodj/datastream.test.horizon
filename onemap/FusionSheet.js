
class FusionSheet {
    constructor(containerId) {
        this.containerId = containerId;
        this.spreadsheet = null;
        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Calculate dimensions to fill the window
        // Approximate column width ~100px, row height ~30px
        // Subtracting some offsets for margins/padding
        const availableWidth = container.clientWidth || window.innerWidth;
        const availableHeight = (container.clientHeight || window.innerHeight) - 50; // Adjust for toolbar/tabs

        const cols = Math.max(10, Math.ceil(availableWidth / 100));
        const rows = Math.max(20, Math.ceil(availableHeight / 30));

        const self = this;

        // Sample data to demonstrate types
        const initialData = [
            ['Project Alpha', 'In Progress', '2023-12-01', '5000.00', true, '#ff0000', 'High priority', '<b>Bold</b> description'],
            ['Project Beta', 'Pending', '2024-01-15', '1200.50', false, '#00ff00', 'Low priority', '<i>Italic</i> description'],
            ['Project Gamma', 'Completed', '2023-11-20', '3000.00', true, '#0000ff', 'Archived', '<u>Underlined</u> description'],
        ];

        this.spreadsheet = jspreadsheet(container, {
            data: initialData,
            minDimensions: [cols, rows],
            defaultColWidth: 100,
            tableOverflow: true,
            tableWidth: '100%',
            tableHeight: '100%',
            // 1. Column Types: Define specific types for the first few columns
            columns: [
                { type: 'text', width: 200 },
                { type: 'dropdown', width: 120, source: ['Pending', 'In Progress', 'Completed', 'On Hold'] },
                { type: 'calendar', width: 100, options: { format: 'DD/MM/YYYY' } },
                { type: 'numeric', width: 100, mask: '$ #.##,00', decimal: '.' },
                { type: 'checkbox', width: 80 },
                { type: 'color', width: 80 },
                { type: 'text', width: 150 },
                { type: 'html', width: 200 } // HTML type
            ],
            // 2. Cell Styling: Pre-apply styles to specific cells
            style: {
                'A1': 'background-color: #e6f7ff; font-weight: bold;',
                'B1': 'background-color: #fffbe6;',
                'D1': 'color: green; font-weight: bold;',
                'A2': 'font-style: italic;',
                'C3': 'background-color: #f6ffed;'
            },
            // 3. Cell Comments: Add initial comments
            comments: {
                A1: 'Enter the main task description here',
                B1: 'Select current status from dropdown'
            },
            // 3. Custom Toolbar
            toolbar: [
                {
                    type: 'i',
                    content: 'undo',
                    onclick: function() {
                        self.spreadsheet.undo();
                    }
                },
                {
                    type: 'i',
                    content: 'redo',
                    onclick: function() {
                        self.spreadsheet.redo();
                    }
                },
                {
                    type: 'i',
                    content: 'save',
                    onclick: function () {
                        self.spreadsheet.download();
                    }
                },
                { type: 'divisor' },
                { type: 'i', content: 'format_bold', k: 'font-weight' },
                { type: 'i', content: 'format_italic', k: 'font-style' },
                { type: 'i', content: 'format_underlined', k: 'text-decoration' },
                { type: 'divisor' },
                { type: 'i', content: 'format_align_left', k: 'text-align' },
                { type: 'i', content: 'format_align_center', k: 'text-align' },
                { type: 'i', content: 'format_align_right', k: 'text-align' },
                { type: 'divisor' },
                { type: 'i', content: 'format_color_text', k: 'color' },
                { type: 'i', content: 'format_color_fill', k: 'background-color' },
                { type: 'divisor' },
                // Custom Button: Send to Lineage
                {
                    type: 'i',
                    content: 'hub',
                    tooltip: 'Send to Data Lineage',
                    onclick: function() {
                        // Get selected data
                        const selectedData = self.spreadsheet.getData(true);
                        
                        if (!selectedData || selectedData.length === 0) {
                            alert('Please select a range of data first.');
                            return;
                        }

                        const hasHeaders = confirm('Does the first row of your selection contain headers?');
                        
                        let headers = [];
                        let dataRows = [];

                        if (hasHeaders) {
                            headers = selectedData[0];
                            dataRows = selectedData.slice(1);
                        } else {
                            // Generate headers
                            headers = selectedData[0].map((_, i) => `Column ${i + 1}`);
                            dataRows = selectedData;
                        }

                        // Format columns for Lineage
                        const lineageColumns = headers.map(h => ({ name: h, type: 'string' }));

                        // Format data for Lineage (array of objects)
                        const lineageData = dataRows.map(row => {
                            const rowObj = {};
                            headers.forEach((h, i) => {
                                rowObj[h] = row[i];
                            });
                            return rowObj;
                        });

                        if (window.addTableToLineage) {
                            window.addTableToLineage('Fusion Selection', lineageColumns, lineageData);
                            
                            // Switch to Lineage tab
                            const lineageTab = document.getElementById('lineage-tab');
                            if (lineageTab) {
                                const tab = new bootstrap.Tab(lineageTab);
                                tab.show();
                            }
                        } else {
                            alert('Data Lineage module not loaded.');
                        }
                    }
                },
                // Custom Button: Clear Data
                {
                    type: 'i',
                    content: 'delete',
                    tooltip: 'Clear All Data',
                    onclick: function() {
                        if (confirm('Are you sure you want to clear the entire sheet?')) {
                            // Create empty data array of same size
                            const emptyData = Array(rows).fill().map(() => Array(cols).fill(''));
                            self.spreadsheet.setData(emptyData);
                        }
                    }
                }
            ],
            // 4. Context Menu for Column Types
            contextMenu: function(obj, x, y, e) {
                var items = [];
        
                if (y == null) {
                    // Header Context Menu
                    if (obj.options.allowInsertColumn) {
                        items.push({
                            title: 'Insert column before',
                            onclick: function() { obj.insertColumn(1, parseInt(x), 1); }
                        });
                        items.push({
                            title: 'Insert column after',
                            onclick: function() { obj.insertColumn(1, parseInt(x), 0); }
                        });
                    }
                    if (obj.options.allowDeleteColumn) {
                        items.push({
                            title: 'Delete selected columns',
                            onclick: function() { obj.deleteColumn(obj.getSelectedColumns().length ? undefined : parseInt(x)); }
                        });
                    }
                    
                    // Custom: Change Column Type
                    items.push({ type: 'line' });
                    items.push({
                        title: 'Change Column Type',
                        submenu: [
                            { title: 'Text', onclick: function() { obj.options.columns[x].type = 'text'; obj.refresh(); } },
                            { title: 'Numeric', onclick: function() { obj.options.columns[x].type = 'numeric'; obj.refresh(); } },
                            { title: 'Calendar', onclick: function() { obj.options.columns[x].type = 'calendar'; obj.options.columns[x].options = { format: 'DD/MM/YYYY' }; obj.refresh(); } },
                            { title: 'Checkbox', onclick: function() { obj.options.columns[x].type = 'checkbox'; obj.refresh(); } },
                            { title: 'Color', onclick: function() { obj.options.columns[x].type = 'color'; obj.refresh(); } },
                            { title: 'HTML', onclick: function() { obj.options.columns[x].type = 'html'; obj.refresh(); } },
                        ]
                    });
                } else {
                    // Cell Context Menu
                    if (obj.options.allowInsertRow) {
                        items.push({
                            title: 'Insert row before',
                            onclick: function() { obj.insertRow(1, parseInt(y), 1); }
                        });
                        items.push({
                            title: 'Insert row after',
                            onclick: function() { obj.insertRow(1, parseInt(y), 0); }
                        });
                    }
                    if (obj.options.allowDeleteRow) {
                        items.push({
                            title: 'Delete selected rows',
                            onclick: function() { obj.deleteRow(obj.getSelectedRows().length ? undefined : parseInt(y)); }
                        });
                    }
                    
                    items.push({ type: 'line' });
                    items.push({
                        title: 'Add/Edit Comment',
                        onclick: function() {
                            var comment = prompt('Enter comment:', obj.getComments(jspreadsheet.getColumnNameFromId([x, y])));
                            if (comment !== null) {
                                obj.setComments([x, y], comment);
                            }
                        }
                    });
                }
        
                return items;
            }
        });

        // Create filter bar (hidden by default) and attach toolbar buttons
        try {
            this.createFilterBar(container);
            // Add toolbar buttons into the existing toolbar area (if present)
            const toolbarEl = container.querySelector('.jexcel_toolbar');
            if (toolbarEl) {
                // Toggle Filters button
                const btnFilter = document.createElement('div');
                btnFilter.className = 'jexcel_toolbar_item';
                btnFilter.title = 'Toggle Filters';
                btnFilter.innerHTML = '<i class="material-icons">filter_list</i>';
                btnFilter.onclick = () => this.toggleFilterBar();
                toolbarEl.appendChild(btnFilter);

                // Clear Filters button
                const btnClear = document.createElement('div');
                btnClear.className = 'jexcel_toolbar_item';
                btnClear.title = 'Clear Filters';
                btnClear.innerHTML = '<i class="material-icons">filter_alt_off</i>';
                btnClear.onclick = () => this.clearFilters();
                toolbarEl.appendChild(btnClear);
            }
        } catch (err) {
            console.warn('Filter bar init failed', err);
        }
    }

    // Create a simple filter bar above the spreadsheet table
    createFilterBar(container) {
        if (!container) return;
        const columns = (this.spreadsheet && this.spreadsheet.options && this.spreadsheet.options.columns)
                        ? this.spreadsheet.options.columns.length
                        : (this.spreadsheet.getNumberColumns ? this.spreadsheet.getNumberColumns() : 10);

        const filterBar = document.createElement('div');
        filterBar.className = 'fusion-filter-bar';
        filterBar.style.display = 'none';
        filterBar.style.padding = '6px 8px';
        filterBar.style.borderBottom = '1px solid rgba(0,0,0,0.08)';
        filterBar.style.background = 'transparent';
        filterBar.style.overflowX = 'auto';

        for (let i = 0; i < columns; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.dataset.col = i;
            input.placeholder = this.spreadsheet && this.spreadsheet.getHeaders ? (this.spreadsheet.getHeaders()[i] || `Col ${i+1}`) : `Col ${i+1}`;
            input.className = 'fusion-filter-input';
            input.style.marginRight = '6px';
            input.style.padding = '6px 8px';
            input.style.minWidth = '100px';
            input.style.border = '1px solid #ddd';
            input.style.borderRadius = '4px';

            input.addEventListener('input', () => this.applyFilters());
            filterBar.appendChild(input);
        }

        // Insert filterBar before the table if possible
        const table = container.querySelector('table');
        if (table && table.parentElement) {
            table.parentElement.insertBefore(filterBar, table);
        } else {
            container.insertBefore(filterBar, container.firstChild);
        }

        this._filterBar = filterBar;
    }

    toggleFilterBar() {
        if (!this._filterBar) return;
        this._filterBar.style.display = this._filterBar.style.display === 'none' ? 'block' : 'none';
    }

    applyFilters() {
        if (!this._filterBar || !this.spreadsheet) return;
        const inputs = Array.from(this._filterBar.querySelectorAll('.fusion-filter-input'));
        const filters = inputs.map(i => (i.value || '').toString().toLowerCase());

        // Get underlying data
        const data = this.spreadsheet.getData();

        // Find table rows
        const container = document.getElementById(this.containerId);
        const tbody = container.querySelector('table tbody');
        const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];

        data.forEach((row, rowIndex) => {
            let visible = true;
            for (let c = 0; c < filters.length; c++) {
                const f = filters[c];
                if (f && f.length > 0) {
                    const cell = row[c] != null ? String(row[c]).toLowerCase() : '';
                    if (!cell.includes(f)) { visible = false; break; }
                }
            }
            if (rows[rowIndex]) rows[rowIndex].style.display = visible ? '' : 'none';
        });
    }

    clearFilters() {
        if (!this._filterBar || !this.spreadsheet) return;
        const inputs = Array.from(this._filterBar.querySelectorAll('.fusion-filter-input'));
        inputs.forEach(i => i.value = '');

        // Show all rows
        const container = document.getElementById(this.containerId);
        const tbody = container.querySelector('table tbody');
        const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
        rows.forEach(r => r.style.display = '');
    }
}

// Initialize when the tab is shown
document.addEventListener('DOMContentLoaded', () => {
    const fusionTab = document.getElementById('fusion-tab');
    if (fusionTab) {
        fusionTab.addEventListener('shown.bs.tab', () => {
            // Check if already initialized
            const container = document.getElementById('fusion-sheet-container');
            if (container && container.innerHTML === '') {
                new FusionSheet('fusion-sheet-container');
            }
        });
    }
});
