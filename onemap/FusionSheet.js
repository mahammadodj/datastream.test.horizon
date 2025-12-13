
class FusionSheet {
    constructor(containerId) {
        this.containerId = containerId;
        this.spreadsheet = null;
        this.isUpdatingFromFormulaBar = false;
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
            // Event Handlers for Formula Bar
            onselection: function(instance, x, y, x2, y2, origin) {
                const xInt = parseInt(x);
                const yInt = parseInt(y);
                self.selectedCell = [xInt, yInt];
                
                let val = '';
                // Try to get raw value if possible, otherwise formatted
                if (self.spreadsheet.getValueFromCoords) {
                    val = self.spreadsheet.getValueFromCoords(xInt, yInt);
                } else {
                    const cellName = jspreadsheet.getColumnNameFromId([xInt, yInt]);
                    val = self.spreadsheet.getValue(cellName);
                }
                
                if (self.formulaInput) {
                    self.formulaInput.value = (val === null || val === undefined) ? '' : val;
                }
            },
            onchange: function(instance, cell, x, y, value) {
                if (self.selectedCell && self.selectedCell[0] === parseInt(x) && self.selectedCell[1] === parseInt(y)) {
                    // Only update formula bar if the change didn't originate from it
                    if (!self.isUpdatingFromFormulaBar && self.formulaInput) {
                        self.formulaInput.value = (value === null || value === undefined) ? '' : value;
                    }
                }
            },
            onload: function() {
                // Enhance Toolbar Icons - Use setTimeout to ensure DOM is ready
                setTimeout(() => {
                    const toolbar = container.querySelector('.jexcel_toolbar') || container.querySelector('.jspreadsheet_toolbar');
                    if (toolbar) {
                        const items = toolbar.querySelectorAll('.jexcel_toolbar_item i.material-icons, .jspreadsheet_toolbar_item i.material-icons');
                        items.forEach(icon => {
                            const content = icon.textContent.trim();
                            // Handle cases where content might be different or empty
                            if (!content) return;
                            
                            const btn = icon.closest('.jexcel_toolbar_item') || icon.closest('.jspreadsheet_toolbar_item');
                            if (btn) {
                                btn.classList.add('fusion-btn-' + content);
                                // Add tooltip if not present
                                if (!btn.title) {
                                    const titles = {
                                        'undo': 'Undo', 'redo': 'Redo', 'save': 'Save',
                                        'format_bold': 'Bold', 'format_italic': 'Italic', 'format_underlined': 'Underline',
                                        'format_align_left': 'Align Left', 'format_align_center': 'Align Center', 'format_align_right': 'Align Right',
                                        'format_color_text': 'Text Color', 'format_color_fill': 'Fill Color',
                                        'hub': 'Send to Lineage', 'delete': 'Clear Data'
                                    };
                                    if (titles[content]) btn.title = titles[content];
                                }
                            }
                        });
                    }
                }, 100);
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
            this.createFormulaBar(container);
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

    // Create a formula bar above the spreadsheet
    createFormulaBar(container) {
        if (!container) return;

        const formulaBar = document.createElement('div');
        formulaBar.className = 'fusion-formula-bar';
        formulaBar.style.display = 'flex';
        formulaBar.style.alignItems = 'center';
        formulaBar.style.padding = '4px 8px';
        formulaBar.style.borderBottom = '1px solid #ddd';
        formulaBar.style.background = '#f8f9fa';
        formulaBar.style.marginBottom = '5px';
        formulaBar.style.position = 'relative'; // For absolute positioning of suggestions

        const label = document.createElement('div');
        label.innerText = 'fx';
        label.style.fontWeight = 'bold';
        label.style.color = '#666';
        label.style.marginRight = '10px';
        label.style.fontStyle = 'italic';
        label.style.userSelect = 'none';
        formulaBar.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'fusion-formula-input';
        input.style.flex = '1';
        input.style.border = '1px solid #ccc';
        input.style.padding = '4px 8px';
        input.style.borderRadius = '4px';
        input.style.height = '30px';
        formulaBar.appendChild(input);

        // Suggestion Box
        const suggestionBox = document.createElement('div');
        suggestionBox.className = 'fusion-formula-suggestions';
        suggestionBox.style.position = 'absolute';
        suggestionBox.style.top = '100%';
        suggestionBox.style.left = '35px'; // Offset for 'fx' label
        suggestionBox.style.width = '300px';
        suggestionBox.style.maxHeight = '200px';
        suggestionBox.style.overflowY = 'auto';
        suggestionBox.style.background = 'white';
        suggestionBox.style.border = '1px solid #ccc';
        suggestionBox.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        suggestionBox.style.zIndex = '1000';
        suggestionBox.style.display = 'none';
        formulaBar.appendChild(suggestionBox);

        this.formulaInput = input;
        this.selectedCell = null;

        // Supported Functions
        const SUPPORTED_FUNCTIONS = [
            'SUM', 'COUNT', 'MIN', 'MAX', 'AVG', 'AVERAGE', 'IF', 'SUMIF', 'COUNTIF', 
            'CONCATENATE', 'VLOOKUP', 'HLOOKUP', 'INDEX', 'MATCH', 'ROUND', 'FLOOR', 
            'CEILING', 'ABS', 'SQRT', 'POWER', 'MOD', 'TODAY', 'NOW', 'DATE', 'YEAR', 
            'MONTH', 'DAY', 'LEN', 'TRIM', 'UPPER', 'LOWER', 'PROPER', 'LEFT', 'RIGHT', 'MID'
        ];

        // Insert at the top
        container.insertBefore(formulaBar, container.firstChild);

        const closeSuggestions = () => {
            suggestionBox.style.display = 'none';
            suggestionBox.innerHTML = '';
        };

        const applySuggestion = (funcName) => {
            input.value = '=' + funcName + '(';
            input.focus();
            closeSuggestions();
            // Trigger update to spreadsheet
            updateSpreadsheet(input.value);
        };

        const updateSpreadsheet = (val) => {
            if (this.selectedCell) {
                this.isUpdatingFromFormulaBar = true;
                const [x, y] = this.selectedCell;
                
                // Save cursor position and selection
                const selectionStart = input.selectionStart;
                const selectionEnd = input.selectionEnd;

                if (this.spreadsheet.setValueFromCoords) {
                    this.spreadsheet.setValueFromCoords(x, y, val);
                } else {
                    const cellName = jspreadsheet.getColumnNameFromId([x, y]);
                    this.spreadsheet.setValue(cellName, val);
                }
                
                // Restore focus to input if it was lost (jspreadsheet might steal it)
                if (document.activeElement !== input) {
                    input.focus();
                    input.setSelectionRange(selectionStart, selectionEnd);
                }

                this.isUpdatingFromFormulaBar = false;
            }
        };

        // Event listener for input
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            updateSpreadsheet(val);

            // Autocomplete Logic
            if (val.startsWith('=')) {
                const query = val.substring(1).toUpperCase();
                // Find the last word being typed if it looks like a function start
                // Simple regex to find the last sequence of letters after = or non-word chars
                const match = query.match(/([A-Z]+)$/);
                
                if (match) {
                    const searchTerm = match[1];
                    const matches = SUPPORTED_FUNCTIONS.filter(f => f.startsWith(searchTerm));
                    
                    if (matches.length > 0) {
                        suggestionBox.innerHTML = '';
                        matches.forEach(func => {
                            const item = document.createElement('div');
                            item.innerText = func;
                            item.style.padding = '4px 8px';
                            item.style.cursor = 'pointer';
                            item.style.borderBottom = '1px solid #eee';
                            
                            item.onmouseover = () => { item.style.background = '#f0f0f0'; };
                            item.onmouseout = () => { item.style.background = 'white'; };
                            
                            item.onclick = () => {
                                // Replace the partial function name with the full one
                                const prefix = val.substring(0, val.lastIndexOf(searchTerm));
                                // Actually, for simplicity, if it's just =SU, replace with =SUM(
                                // If complex formula like =SUM(A1, SU, we might need better parsing.
                                // For now, let's assume simple start or simple replacement
                                
                                // Better replacement logic:
                                const newVal = val.substring(0, val.length - searchTerm.length) + func + '(';
                                input.value = newVal;
                                updateSpreadsheet(newVal);
                                input.focus();
                                closeSuggestions();
                            };
                            suggestionBox.appendChild(item);
                        });
                        suggestionBox.style.display = 'block';
                    } else {
                        closeSuggestions();
                    }
                } else {
                    closeSuggestions();
                }
            } else {
                closeSuggestions();
            }
        });

        // Close suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!formulaBar.contains(e.target)) {
                closeSuggestions();
            }
        });

        // Keyboard navigation for suggestions
        input.addEventListener('keydown', (e) => {
            if (suggestionBox.style.display === 'block') {
                if (e.key === 'Escape') {
                    closeSuggestions();
                }
                // Could add ArrowUp/Down navigation here
            }
        });
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
