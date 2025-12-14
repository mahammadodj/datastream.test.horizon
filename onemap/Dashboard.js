// Global State for Saved Queries
let storedQueries = null;
try {
    const raw = localStorage.getItem('onemap_savedQueries');
    if (raw) storedQueries = JSON.parse(raw);
} catch (e) {
    console.warn('Failed to load saved queries:', e);
}

window.savedQueries = storedQueries || [
    { name: 'q_test_with_platform', query: 'SELECT * FROM [wells]', status: 'active' },
    { name: 'q_trends', query: 'SELECT * FROM [production]', status: 'active' },
    { name: 'q_WELL_SELECTION', query: 'SELECT * FROM [well_headers]', status: 'active' },
    { name: 'q_wells', query: 'SELECT * FROM [wells]', status: 'active' }
];

window.saveQueriesToStorage = () => {
    try {
        localStorage.setItem('onemap_savedQueries', JSON.stringify(window.savedQueries));
    } catch (e) {
        console.error('Failed to save queries:', e);
    }
};

window.renderSavedQueries = () => {
    const listContainer = document.querySelector('.queries-list');
    if (!listContainer) return;

    // Update Count Badge
    const countBadge = document.querySelector('#queries-panel .widget-count-badge');
    if (countBadge) {
        countBadge.textContent = window.savedQueries ? window.savedQueries.length : 0;
    }

    // Get search term
    const searchInput = document.querySelector('.queries-search-bar input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredQueries = window.savedQueries ? window.savedQueries.filter(q => q.name.toLowerCase().includes(searchTerm)) : [];

    if (filteredQueries.length === 0) {
        if (searchTerm) {
             listContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #888; font-size: 13px;">
                    No queries found matching "${searchTerm}"
                </div>
            `;
        } else {
            listContainer.innerHTML = `
            <div class="no-queries-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #888; text-align: center; padding-top: 40px;">
                <i class="material-icons" style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">storage</i>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 5px;">No queries</div>
                <div style="font-size: 12px; opacity: 0.7;">No queries available</div>
                <button id="create-query-btn-empty" style="margin-top: 15px; padding: 6px 12px; background: transparent; border: 1px solid #4a90e2; color: #4a90e2; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <i class="material-icons" style="font-size: 16px;">add</i> Create
                </button>
            </div>
        `;
            const emptyCreateBtn = listContainer.querySelector('#create-query-btn-empty');
            if (emptyCreateBtn) {
                emptyCreateBtn.addEventListener('click', () => {
                    if (typeof openQueryEditor === 'function') openQueryEditor();
                });
            }
        }
        return;
    }

    listContainer.innerHTML = '';
    filteredQueries.forEach((q) => {
        const index = window.savedQueries.indexOf(q);
        const item = document.createElement('div');
        item.className = 'query-item';
        
        // Highlight active query
        if (window.currentEditingQuery && window.currentEditingQuery === q) {
            item.classList.add('selected');
        }
        
        // Styles moved to CSS for theme support
        // item.style.display = 'flex'; ...

        const statusColor = q.status === 'error' ? '#f44336' : '#4caf50';
        const statusTitle = q.status === 'error' ? 'Error' : 'Active';

        item.innerHTML = `
            <i class="material-icons query-icon">storage</i>
            <span class="query-name">${q.name}</span>
            <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${statusColor}; margin-right: 10px;" title="${statusTitle}"></div>
            <i class="material-icons more-btn">more_horiz</i>
        `;

        // Context Menu Handler
        const moreBtn = item.querySelector('.more-btn');
        
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Remove any existing menus
            document.querySelectorAll('.query-context-menu').forEach(el => el.remove());

            const menu = document.createElement('div');
            menu.className = 'query-context-menu';
            
            // Positioning logic remains in JS
            const rect = moreBtn.getBoundingClientRect();
            menu.style.top = (rect.bottom + 5) + 'px';
            menu.style.left = (rect.right - 120) + 'px';

            menu.innerHTML = `
                <div class="menu-item delete-action">
                    <i class="material-icons">delete</i> Delete
                </div>
            `;

            const menuItem = menu.querySelector('.menu-item');
            menuItem.addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (confirm(`Are you sure you want to delete "${q.name}"?`)) {
                    const realIndex = window.savedQueries.indexOf(q);
                    if (realIndex > -1) {
                        window.savedQueries.splice(realIndex, 1);
                        if (window.saveQueriesToStorage) window.saveQueriesToStorage();
                        window.renderSavedQueries();
                    }
                }
                menu.remove();
            });

            // Close on outside click
            const closeMenu = (ev) => {
                if (!menu.contains(ev.target) && ev.target !== moreBtn) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);

            document.body.appendChild(menu);
        });

        item.addEventListener('click', () => {
            if (typeof openQueryEditor === 'function') {
                openQueryEditor(q);
            }
        });

        listContainer.appendChild(item);
    });
};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize when DOM is ready
    initDashboard();
});

// Also listen for tab change to ensure layout is correct if needed
document.addEventListener('shown.bs.tab', function (event) {
    if (event.target.id === 'dashboard-tab') {
        // Refresh or re-calc if needed
    }
});

function initDashboard() {
    const widgetList = document.getElementById('dashboard-widget-list');
    if (!widgetList) return;

    // Clear existing items if any
    widgetList.innerHTML = '';

    // Define Groups
    const groups = [
        {
            id: 'charts',
            title: 'Charts',
            icon: 'bar_chart',
            widgets: [
                { name: 'Pie Chart', icon: 'pie_chart', type: 'pie' },
                { name: 'Scatter Plot', icon: 'scatter_plot', type: 'scatter' },
                { name: 'Line Plot', icon: 'show_chart', type: 'line' },
                { name: 'Area Chart', icon: 'area_chart', type: 'area' },
                { name: 'Bar Plot', icon: 'bar_chart', type: 'bar' },
                { name: 'Box Plot', icon: 'candlestick_chart', type: 'box' },
                { name: 'Bubble Plot', icon: 'bubble_chart', type: 'bubble' },
                { name: 'Gantt Chart', icon: 'calendar_view_week', type: 'gantt' },
                { name: 'Tree Map', icon: 'dashboard', type: 'treemap' },
                { name: 'Radar Chart', icon: 'radar', type: 'radar' }
            ]
        },
        {
            id: 'controls',
            title: 'Controls',
            icon: 'tune',
            widgets: [
                { name: 'Button', icon: 'smart_button', type: 'button' },
                { name: 'Checkbox', icon: 'check_box', type: 'checkbox' },
                { name: 'Dropdown', icon: 'arrow_drop_down_circle', type: 'dropdown' },
                { name: 'Input box', icon: 'text_fields', type: 'input' },
                { name: 'Multiselect box', icon: 'checklist', type: 'multiselect' },
                { name: 'Radio button', icon: 'radio_button_checked', type: 'radio' },
                { name: 'Segmented control', icon: 'view_column', type: 'segmented' },
                { name: 'Slider', icon: 'linear_scale', type: 'slider' },
                { name: 'Textarea', icon: 'notes', type: 'textarea' },
                { name: 'Toggle', icon: 'toggle_on', type: 'toggle' }
            ]
        },
        {
            id: 'others',
            title: 'Components',
            icon: 'widgets',
            widgets: [
                { name: 'Data Table', icon: 'table_chart', type: 'table' },
                { name: 'Layout Container', icon: 'view_quilt', type: 'container' },
                { name: 'Queries', icon: 'terminal', type: 'query' },
                { name: 'Widgets List', icon: 'list', type: 'widgets-list' }
            ]
        }
    ];

    groups.forEach(group => {
        // Create Group Container
        const groupContainer = document.createElement('div');
        groupContainer.className = 'dashboard-widget-group';
        
        // Create Header
        const header = document.createElement('div');
        header.className = 'dashboard-group-header';
        header.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <i class="material-icons group-icon">${group.icon}</i>
                <span>${group.title}</span>
            </div>
            <i class="material-icons expand-icon">chevron_right</i>
        `;
        
        // Create Content
        const content = document.createElement('div');
        content.className = 'dashboard-group-content';
        // Default collapsed
        content.style.display = 'none';
        //header.classList.add('expanded');

        // Toggle Logic
        header.addEventListener('click', () => {
            const isExpanded = content.style.display === 'block';
            content.style.display = isExpanded ? 'none' : 'block';
            if (isExpanded) {
                header.classList.remove('expanded');
                header.querySelector('.expand-icon').textContent = 'chevron_right';
            } else {
                header.classList.add('expanded');
                header.querySelector('.expand-icon').textContent = 'expand_more';
            }
        });

        // Add Widgets to Content
        group.widgets.forEach(widget => {
            const item = document.createElement('div');
            item.className = 'dashboard-widget-item';
            item.draggable = true;
            item.innerHTML = `
                <i class="material-icons widget-icon">${widget.icon}</i>
                <span class="widget-name">${widget.name}</span>
            `;
            
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('widgetType', widget.type);
                e.dataTransfer.effectAllowed = 'copy';
            });

            // Special handler for Queries
            if (widget.type === 'query') {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => {
                    toggleQueriesPanel();
                });
            }

            // Special handler for Widgets List
            if (widget.type === 'widgets-list') {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => {
                    toggleWidgetsPanel();
                });
            }

            content.appendChild(item);
        });

        groupContainer.appendChild(header);
        groupContainer.appendChild(content);
        widgetList.appendChild(groupContainer);
    });

    initSidebarResizer();
    initSidebarToggle();
    initContextMenu();
    initQueriesPanel();
    initQueryEditor();
    initWidgetsPanel();
}

function initQueriesPanel() {
    if (document.getElementById('queries-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'queries-panel';
    panel.className = 'queries-panel';
    panel.innerHTML = `
        <div class="queries-panel-header">
            <div class="queries-header-title">
                <span>Queries</span>
                <span class="widget-count-badge">0</span>
            </div>
            <div class="queries-header-actions">
                <i class="material-icons action-icon" id="add-query-btn" style="cursor: pointer;">add</i>
                <i class="material-icons action-icon close-panel" style="cursor: pointer;">keyboard_double_arrow_left</i>
            </div>
        </div>
        <div class="queries-search-bar">
            <i class="material-icons search-icon">search</i>
            <input type="text" placeholder="Search..." />
        </div>
        <div class="queries-list">
            <div class="no-queries-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #888; text-align: center; padding-top: 40px;">
                <i class="material-icons" style="font-size: 48px; margin-bottom: 10px; opacity: 0.3;">storage</i>
                <div style="font-size: 16px; font-weight: 500; margin-bottom: 5px;">No queries</div>
                <div style="font-size: 12px; opacity: 0.7;">No queries available</div>
                <button id="create-query-btn-empty" style="margin-top: 15px; padding: 6px 12px; background: transparent; border: 1px solid #4a90e2; color: #4a90e2; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                    <i class="material-icons" style="font-size: 16px;">add</i> Create
                </button>
            </div>
        </div>
    `;
    
    // Append to dashboard-main or body. 
    // Assuming dashboard-main is the container.
    const dashboardMain = document.querySelector('.dashboard-main') || document.body;
    dashboardMain.appendChild(panel);

    // Close handler
    panel.querySelector('.close-panel').addEventListener('click', () => {
        panel.classList.remove('open');
        const editor = document.getElementById('query-editor-window');
        if (editor) {
            editor.style.display = 'none';
        }
    });

    // Add Query Handler
    const addBtn = panel.querySelector('#add-query-btn');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openQueryEditor();
        });
    }

    // Search Handler
    const searchInput = panel.querySelector('.queries-search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (window.renderSavedQueries) window.renderSavedQueries();
        });
    }

    // Initial Render
    if (window.renderSavedQueries) window.renderSavedQueries();
}

window.toggleWidgetsPanel = () => {
    const panel = document.getElementById('widgets-panel');
    if (!panel) return;
    
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
        panel.classList.remove('open');
    } else {
        // Close other panels if needed
        const queriesPanel = document.getElementById('queries-panel');
        if (queriesPanel && queriesPanel.classList.contains('open')) {
            queriesPanel.classList.remove('open');
        }
        
        panel.classList.add('open');
        if (window.refreshWidgetsPanel) window.refreshWidgetsPanel();
    }
};

function initWidgetsPanel() {
    if (document.getElementById('widgets-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'widgets-panel';
    panel.className = 'widgets-panel';
    panel.innerHTML = `
        <div class="widgets-panel-header">
            <div class="widgets-header-title">
                <span>Widgets</span>
                <span class="widget-count-badge">0</span>
            </div>
            <div class="widgets-header-actions">
                <i class="material-icons action-icon" id="add-widget-btn" style="cursor: pointer;">add</i>
                <i class="material-icons action-icon close-panel" style="cursor: pointer;">keyboard_double_arrow_left</i>
            </div>
        </div>
        <div class="widgets-search-bar">
            <i class="material-icons search-icon">search</i>
            <input type="text" placeholder="Search widgets..." />
        </div>
        <div class="widgets-list">
            <!-- Widgets will be rendered here -->
        </div>
    `;
    
    const dashboardMain = document.querySelector('.dashboard-main') || document.body;
    dashboardMain.appendChild(panel);

    // Add Widget Handler (opens sidebar)
    const addBtn = panel.querySelector('#add-widget-btn');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sidebar = document.getElementById('dashboard-sidebar');
            if (sidebar && !sidebar.classList.contains('open')) {
                const toggleBtn = document.getElementById('sidebar-toggle-btn');
                if (toggleBtn) toggleBtn.click();
            }
        });
    }

    // Close Handler
    const closeBtn = panel.querySelector('.close-panel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            toggleWidgetsPanel();
        });
    }

    // Search Handler
    const searchInput = panel.querySelector('.widgets-search-bar input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (window.refreshWidgetsPanel) window.refreshWidgetsPanel();
        });
    }

    // Global refresh function
    window.refreshWidgetsPanel = () => {
        const listContainer = panel.querySelector('.widgets-list');
        const countBadge = panel.querySelector('.widget-count-badge');
        const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
        
        // Find all widgets
        const widgets = Array.from(document.querySelectorAll('.dashboard-chart-container, .dashboard-layout-container'));
        
        if (countBadge) countBadge.textContent = widgets.length;
        
        listContainer.innerHTML = '';
        
        if (widgets.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #888; font-size: 13px;">
                    No widgets added
                </div>
            `;
            return;
        }

        widgets.forEach(widget => {
            // Get title
            let title = 'Untitled Widget';
            const headerTitle = widget.querySelector('.dashboard-chart-header span');
            if (headerTitle) title = headerTitle.textContent;
            
            // Filter
            if (searchTerm && !title.toLowerCase().includes(searchTerm)) return;
            
            // Determine icon based on content/class
            let icon = 'bar_chart'; // default
            if (widget.classList.contains('dashboard-layout-container')) icon = 'view_quilt';
            else if (title.includes('Table')) icon = 'table_chart';
            else if (title.includes('Text')) icon = 'text_fields';
            else if (title.includes('Button')) icon = 'smart_button';
            else if (title.includes('Input')) icon = 'input';
            else if (title.includes('List')) icon = 'list';
            else if (title.includes('Code')) icon = 'code';
            
            const item = document.createElement('div');
            item.className = 'widget-list-item';
            
            // Check if selected (we can use a class on the widget container)
            if (widget.classList.contains('selected-widget')) {
                item.classList.add('selected');
            }
            
            item.innerHTML = `
                <i class="material-icons widget-list-icon">${icon}</i>
                <span class="widget-list-name">${title}</span>
                <i class="material-icons widget-more-btn">more_horiz</i>
            `;
            
            // Click to select/scroll to
            item.addEventListener('click', () => {
                // Deselect others
                document.querySelectorAll('.dashboard-chart-container, .dashboard-layout-container').forEach(w => w.classList.remove('selected-widget'));
                document.querySelectorAll('.widget-list-item').forEach(i => i.classList.remove('selected'));
                
                widget.classList.add('selected-widget');
                item.classList.add('selected');
                
                widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Add visual highlight effect to widget
                const originalBorder = widget.style.borderColor;
                widget.style.borderColor = '#0078d4';
                widget.style.boxShadow = '0 0 0 2px rgba(0, 120, 212, 0.3)';
                setTimeout(() => {
                    widget.style.borderColor = originalBorder;
                    widget.style.boxShadow = '';
                }, 2000);
            });

            // Context Menu
            const moreBtn = item.querySelector('.widget-more-btn');
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                // Remove existing menus
                document.querySelectorAll('.widget-context-menu').forEach(el => el.remove());
                
                const menu = document.createElement('div');
                menu.className = 'widget-context-menu';
                const rect = moreBtn.getBoundingClientRect();
                menu.style.top = (rect.bottom + 5) + 'px';
                menu.style.left = (rect.right - 120) + 'px';
                
                menu.innerHTML = `
                    <div class="menu-item delete-action">
                        <i class="material-icons">delete</i> Delete
                    </div>
                `;
                
                menu.querySelector('.delete-action').addEventListener('click', () => {
                    if (confirm(`Delete widget "${title}"?`)) {
                        widget.remove();
                        if (window.updateDashboardEmptyState) window.updateDashboardEmptyState();
                        window.refreshWidgetsPanel();
                    }
                    menu.remove();
                });
                
                document.body.appendChild(menu);
                
                const closeMenu = (ev) => {
                    if (!menu.contains(ev.target) && ev.target !== moreBtn) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeMenu), 0);
            });

            listContainer.appendChild(item);
        });
    };

    // Initial refresh
    window.refreshWidgetsPanel();
}

function initQueryEditor() {
    // Helper for execution/validation
    const executeMockQuery = (sql) => {
        // Simple parser for SELECT * FROM [Table]
        const match = sql.match(/FROM\s+(?:\[)?([a-zA-Z0-9_]+)(?:\])?/i);
        if (!match) {
            // Fallback: if no FROM clause, try to return first table if available, or error
            if (window.lineageData && window.lineageData.tables && window.lineageData.tables.length > 0) {
                 const t = window.lineageData.tables[0];
                 return { data: t.data || [], columns: t.columns || [] };
            }
            throw new Error("Invalid query. Please use 'SELECT * FROM [TableName]'.");
        }
        
        const tableName = match[1];
        
        if (window.lineageData && window.lineageData.tables) {
            // Case insensitive search
            const table = window.lineageData.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase());
            if (table) {
                return { data: table.data || [], columns: table.columns || [] };
            }
        }
        
        throw new Error(`Table '${tableName}' not found.`);
    };

    if (document.getElementById('query-editor-window')) return;

    const win = document.createElement('div');
    win.id = 'query-editor-window';
    win.className = 'query-editor-window';
    win.style.display = 'none';
    
    win.innerHTML = `
        <div class="query-editor-content">
            <div class="query-editor-header">
                <div class="editor-tabs-container" style="display: flex; height: 100%;">
                    <div class="editor-tab active">
                        <i class="material-icons tab-icon" style="font-size: 16px; margin-right: 8px; color: #7f8c8d;">storage</i>
                        <span class="tab-name">New Query</span>
                        <i class="material-icons tab-close" style="font-size: 14px; margin-left: 8px; color: #999; cursor: pointer;">close</i>
                    </div>
                </div>
                <div class="editor-actions">
                    <button class="btn-save-query" style="background: none; border: none; cursor: pointer; color: #666; display: flex; align-items: center; gap: 5px; margin-right: 10px;">
                        <i class="material-icons" style="font-size: 18px;">save</i>
                        <span style="font-size: 13px;">Save</span>
                    </button>
                    <i class="material-icons close-editor" style="cursor: pointer; display: none;">close</i>
                </div>
            </div>
            <div class="query-editor-body">
                <div class="line-numbers">
                    ${Array.from({length: 20}, (_, i) => `<div>${i+1}</div>`).join('')}
                </div>
                <div class="editor-container">
                    <pre class="editor-backdrop" aria-hidden="true"></pre>
                    <textarea class="query-textarea" spellcheck="false">-- Example SQL Script
SELECT * 
FROM [example_table]
LIMIT 100;</textarea>
                </div>
            </div>
            <div class="editor-resizer"></div>
            <div class="query-editor-footer">
                <div class="footer-left">
                    <div class="footer-label">Preview</div>
                    <div class="footer-tabs">
                        <div class="footer-tab active" data-tab="json">JSON</div>
                        <div class="footer-tab" data-tab="table">Table</div>
                    </div>
                </div>
                <div class="footer-actions">
                    <i class="material-icons action-icon btn-export-csv" title="Export CSV" style="cursor: pointer;">upload</i>
                    <button class="btn-test">
                        Test <span class="shortcut">ctrl ↵</span>
                    </button>
                </div>
            </div>
            <div class="query-results-container">
                <div class="query-results-empty-state">
                    <div class="empty-state-icon">
                        <div class="skeleton-line" style="width: 60%;"></div>
                        <div class="skeleton-line" style="width: 80%;"></div>
                        <div class="skeleton-line" style="width: 50%;"></div>
                        <div class="skeleton-line" style="width: 70%;"></div>
                    </div>
                    <p>Preview query results before updating</p>
                    <button class="btn-test-primary">Test</button>
                </div>
            </div>
        </div>
    `;

    // Append to dashboard-main or body
    const dashboardMain = document.querySelector('.dashboard-main') || document.body;
    dashboardMain.appendChild(win);

    // Close handler
    win.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        win.style.display = 'none';
    });

    // Rename Query Handler
    const tabName = win.querySelector('.tab-name');
    tabName.addEventListener('dblclick', () => {
        const currentName = tabName.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentName;
        input.style.border = '1px solid #007bff';
        input.style.borderRadius = '3px';
        input.style.padding = '2px 5px';
        input.style.fontSize = '13px';
        input.style.outline = 'none';
        input.style.width = '120px';
        
        const saveName = () => {
            const newName = input.value.trim() || currentName;
            tabName.textContent = newName;
            // Re-attach double click listener if element was replaced? 
            // No, we are replacing content of tabName or replacing tabName itself?
            // Let's replace tabName with input, then swap back.
        };

        // Replace span with input
        tabName.style.display = 'none';
        tabName.parentNode.insertBefore(input, tabName);
        input.focus();

        const finishEditing = () => {
            const newName = input.value.trim() || currentName;
            tabName.textContent = newName;
            tabName.style.display = '';
            input.remove();
        };

        input.addEventListener('blur', finishEditing);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                finishEditing();
            }
        });
    });

    // Save Button Handler
    win.querySelector('.btn-save-query').addEventListener('click', () => {
        const name = win.querySelector('.tab-name').textContent;
        const query = win.querySelector('.query-textarea').value;
        
        let status = 'active';
        try {
            executeMockQuery(query);
        } catch (e) {
            status = 'error';
        }

        if (!window.savedQueries) window.savedQueries = [];
        const existingIndex = window.savedQueries.findIndex(q => q.name === name);
        
        if (existingIndex >= 0) {
            window.savedQueries[existingIndex].query = query;
            window.savedQueries[existingIndex].status = status;
        } else {
            window.savedQueries.push({ name, query, status });
        }
        
        if (window.saveQueriesToStorage) window.saveQueriesToStorage();
        if (window.renderSavedQueries) window.renderSavedQueries();
        
        // Visual feedback
        const btn = win.querySelector('.btn-save-query');
        const originalContent = btn.innerHTML;
        if (status === 'active') {
             btn.innerHTML = '<i class="material-icons" style="font-size: 18px;">check</i> <span style="font-size: 13px;">Saved</span>';
        } else {
             btn.innerHTML = '<i class="material-icons" style="font-size: 18px; color: #f44336;">error</i> <span style="font-size: 13px; color: #f44336;">Error</span>';
        }
        setTimeout(() => {
            btn.innerHTML = originalContent;
        }, 1500);
    });

    // Syntax Highlighting Logic
    const textarea = win.querySelector('.query-textarea');
    const backdrop = win.querySelector('.editor-backdrop');

    const applyHighlight = (text) => {
        let html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const keywords = [
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'DELETE', 'UPDATE', 'CREATE', 'DROP', 'ALTER',
            'TABLE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'AS', 'DISTINCT',
            'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AND', 'OR', 'NOT', 'IN',
            'IS', 'NULL', 'VALUES', 'INTO', 'SET', 'TOP', 'UNION', 'ALL', 'LIKE', 'BETWEEN', 'EXISTS'
        ];

        const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');
        
        html = html.replace(keywordRegex, (match) => {
            return `<span style="color: #569cd6; font-weight: bold;">${match}</span>`; // Blue
        });
        
        // Strings
        html = html.replace(/'([^']*)'/g, '<span style="color: #ce9178;">\'$1\'</span>'); // Orange/Red
        
        // Numbers
        html = html.replace(/\b(\d+)\b/g, '<span style="color: #b5cea8;">$1</span>'); // Light Green
        
        // Comments (Simple -- style)
        html = html.replace(/--.*$/gm, '<span style="color: #6a9955;">$&</span>'); // Green

        // Handle trailing newline for pre-wrap
        if (html.endsWith('\n')) {
            html += '<br>';
        }
        
        return html;
    };

    const updateHighlight = () => {
        backdrop.innerHTML = applyHighlight(textarea.value);
        updateLineNumbers();
    };

    const syncScroll = () => {
        backdrop.scrollTop = textarea.scrollTop;
        backdrop.scrollLeft = textarea.scrollLeft;
        win.querySelector('.line-numbers').scrollTop = textarea.scrollTop;
    };

    const updateLineNumbers = () => {
        const lines = textarea.value.split('\n').length;
        const lineNumbersEl = win.querySelector('.line-numbers');
        // Ensure at least 20 lines for visual consistency if empty
        const count = Math.max(lines, 20);
        lineNumbersEl.innerHTML = Array.from({length: count}, (_, i) => `<div>${i+1}</div>`).join('');
    };

    // --- Suggestions Logic ---
    const suggestionsBox = document.createElement('div');
    suggestionsBox.className = 'sql-suggestions-box';
    Object.assign(suggestionsBox.style, {
        position: 'absolute', display: 'none',
        backgroundColor: '#252526', border: '1px solid #454545',
        zIndex: '1000', maxHeight: '150px', overflowY: 'auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
        color: '#cccccc', fontFamily: 'Consolas, monospace', fontSize: '12px',
        minWidth: '200px'
    });
    win.querySelector('.editor-container').appendChild(suggestionsBox);

    let activeSuggestionIndex = -1;

    const getCaretCoordinates = () => {
        const container = win.querySelector('.editor-container');
        const measureDiv = document.createElement('div');
        Object.assign(measureDiv.style, {
            position: 'absolute', top: '0', left: '0', visibility: 'hidden',
            height: 'auto', width: textarea.clientWidth + 'px',
            whiteSpace: 'pre-wrap',
            fontFamily: getComputedStyle(textarea).fontFamily,
            fontSize: getComputedStyle(textarea).fontSize,
            lineHeight: getComputedStyle(textarea).lineHeight,
            padding: getComputedStyle(textarea).padding,
            border: getComputedStyle(textarea).border,
            boxSizing: 'border-box',
            overflow: 'hidden'
        });
        container.appendChild(measureDiv);

        const start = textarea.selectionStart;
        const text = textarea.value.substring(0, start);
        measureDiv.textContent = text;
        
        const span = document.createElement('span');
        span.textContent = '|';
        measureDiv.appendChild(span);
        
        const spanRect = span.getBoundingClientRect();
        const measureRect = measureDiv.getBoundingClientRect();
        
        const top = (spanRect.top - measureRect.top) - textarea.scrollTop;
        const left = (spanRect.left - measureRect.left) - textarea.scrollLeft;
        
        container.removeChild(measureDiv);
        return { top, left };
    };

    const showSuggestions = () => {
        const cursorPos = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, cursorPos);
        const match = textBefore.match(/([a-zA-Z0-9_]+)$/);
        
        if (!match) {
            suggestionsBox.style.display = 'none';
            return;
        }

        const word = match[1];
        if (word.length < 1) {
            suggestionsBox.style.display = 'none';
            return;
        }

        let suggestions = [];
        // Lineage Data
        if (window.lineageData && window.lineageData.tables) {
            const lowerWord = word.toLowerCase();
            window.lineageData.tables.forEach(t => {
                if (t.name.toLowerCase().includes(lowerWord)) {
                    suggestions.push({ text: t.name, type: 'Table', info: 'Table' });
                }
                t.columns.forEach(c => {
                    if (c.name.toLowerCase().includes(lowerWord)) {
                        suggestions.push({ text: c.name, type: 'Column', info: t.name });
                    }
                });
            });
        }

        // SQL Keywords
        const keywords = ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN', 'ON', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'AND', 'OR', 'NOT', 'NULL', 'AS', 'IN', 'VALUES', 'SET', 'CREATE', 'TABLE', 'DROP', 'ALTER'];
        keywords.forEach(k => {
            if (k.toLowerCase().startsWith(word.toLowerCase()) && !suggestions.find(s => s.text === k)) {
                suggestions.push({ text: k, type: 'Keyword', info: 'SQL' });
            }
        });

        if (suggestions.length === 0) {
            suggestionsBox.style.display = 'none';
            return;
        }

        suggestionsBox.innerHTML = '';
        activeSuggestionIndex = 0;
        
        suggestions.forEach((s, i) => {
            const item = document.createElement('div');
            Object.assign(item.style, {
                padding: '4px 8px', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: i === 0 ? '#094771' : 'transparent'
            });
            
            const left = document.createElement('div');
            left.style.display = 'flex'; left.style.alignItems = 'center'; left.style.gap = '5px';
            
            const icon = document.createElement('i');
            icon.className = 'material-icons';
            icon.style.fontSize = '14px';
            if (s.type === 'Table') { icon.textContent = 'table_chart'; icon.style.color = '#4ec9b0'; }
            else if (s.type === 'Column') { icon.textContent = 'view_column'; icon.style.color = '#9cdcfe'; }
            else { icon.textContent = 'code'; icon.style.color = '#c586c0'; }
            
            const text = document.createElement('span');
            text.textContent = s.text;
            
            left.appendChild(icon);
            left.appendChild(text);
            
            const right = document.createElement('span');
            right.textContent = s.info;
            right.style.fontSize = '10px'; right.style.color = '#808080';
            
            item.appendChild(left);
            item.appendChild(right);
            
            item.onmouseover = () => {
                activeSuggestionIndex = i;
                updateActiveSuggestion();
            };
            
            item.onmousedown = (e) => {
                e.preventDefault();
                applySuggestion(s.text);
            };
            
            suggestionsBox.appendChild(item);
        });

        const coords = getCaretCoordinates();
        suggestionsBox.style.top = (coords.top + 20) + 'px';
        suggestionsBox.style.left = coords.left + 'px';
        suggestionsBox.style.display = 'block';
    };

    const updateActiveSuggestion = () => {
        Array.from(suggestionsBox.children).forEach((child, i) => {
            child.style.backgroundColor = i === activeSuggestionIndex ? '#094771' : 'transparent';
        });
    };

    const applySuggestion = (text) => {
        const cursorPos = textarea.selectionStart;
        const textBefore = textarea.value.substring(0, cursorPos);
        const match = textBefore.match(/([a-zA-Z0-9_]+)$/);
        
        if (match) {
            const prefix = match[1];
            const newText = textarea.value.substring(0, cursorPos - prefix.length) + text + textarea.value.substring(cursorPos);
            textarea.value = newText;
            textarea.selectionStart = textarea.selectionEnd = cursorPos - prefix.length + text.length;
            updateHighlight();
            suggestionsBox.style.display = 'none';
            textarea.focus();
        }
    };

    textarea.addEventListener('keydown', (e) => {
        if (suggestionsBox.style.display === 'block') {
            const items = suggestionsBox.children;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                updateActiveSuggestion();
                items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                updateActiveSuggestion();
                items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                const selected = items[activeSuggestionIndex];
                if (selected) selected.onmousedown(e);
            } else if (e.key === 'Escape') {
                suggestionsBox.style.display = 'none';
            }
        }
    });

    textarea.addEventListener('input', () => {
        updateHighlight();
        showSuggestions();
    });
    
    textarea.addEventListener('blur', () => {
        setTimeout(() => suggestionsBox.style.display = 'none', 200);
    });

    textarea.addEventListener('scroll', syncScroll);
    
    // Initial highlight
    updateHighlight();
    updateLineNumbers();

    // Tab Switching Logic
    const tabs = win.querySelectorAll('.footer-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (currentResultData) {
                displayResults(currentResultData);
            }
        });
    });

    // --- Test / Run Query Logic ---
    let currentResultData = null;
    let currentResultColumns = null;

    // executeMockQuery is defined at the top of initQueryEditor

    const displayResults = (data, columns = null) => {
        currentResultData = data;
        currentResultColumns = columns;
        const resultsContainer = win.querySelector('.query-results-container');
        const activeTab = win.querySelector('.footer-tab.active').dataset.tab;
        const isDark = document.body.classList.contains('dark-theme');
        
        if (!data || data.length === 0) {
            resultsContainer.innerHTML = `
                <div style="padding: 20px; color: #666; font-style: italic;">
                    Query returned no results.
                </div>
            `;
            return;
        }

        if (activeTab === 'json') {
            resultsContainer.innerHTML = `
                <pre style="margin: 0; padding: 10px; overflow: auto; height: 100%; font-family: Consolas, monospace; font-size: 12px; color: ${isDark ? '#ce9178' : '#333'};">${JSON.stringify(data, null, 2)}</pre>
            `;
        } else {
            // Table View
            let headers;
            if (columns && columns.length > 0) {
                headers = columns.map(c => c.name);
            } else {
                // Fallback: Collect all unique keys from all rows
                headers = Array.from(new Set(data.flatMap(Object.keys)));
            }
            
            let html = `
                <div style="overflow: auto; height: 100%;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 12px; font-family: sans-serif;">
                        <thead>
                            <tr>
                                ${headers.map(h => `<th style="text-align: left; padding: 8px; background-color: ${isDark ? '#333' : '#f0f0f0'}; color: ${isDark ? '#eee' : '#333'}; border-bottom: 1px solid ${isDark ? '#555' : '#ddd'}; position: sticky; top: 0;">${h}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr>
                                    ${headers.map(h => `<td style="padding: 8px; border-bottom: 1px solid ${isDark ? '#444' : '#eee'}; color: ${isDark ? '#ccc' : '#333'};">${row[h] !== undefined ? row[h] : ''}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            resultsContainer.innerHTML = html;
        }
    };

    const runQuery = () => {
        const query = textarea.value.trim();
        const resultsContainer = win.querySelector('.query-results-container');
        
        // Show Loading
        resultsContainer.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; color: #666;">
                <div class="spinner" style="border: 3px solid #f3f3f3; border-top: 3px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin-right: 10px;"></div>
                Running query...
            </div>
            <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
        `;

        // Simulate delay
        setTimeout(() => {
            try {
                const result = executeMockQuery(query);
                // Handle both legacy array return and new object return
                if (Array.isArray(result)) {
                    displayResults(result);
                } else {
                    displayResults(result.data, result.columns);
                }
            } catch (err) {
                resultsContainer.innerHTML = `
                    <div style="padding: 20px; color: #d32f2f;">
                        <strong>Error:</strong> ${err.message}
                    </div>
                `;
            }
        }, 500);
    };

    win.querySelector('.btn-test').addEventListener('click', runQuery);
    const btnPrimary = win.querySelector('.btn-test-primary');
    if (btnPrimary) btnPrimary.addEventListener('click', runQuery);

    // Add Ctrl+Enter shortcut
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            runQuery();
        }
    });

    // Export CSV Logic
    const btnExport = win.querySelector('.btn-export-csv');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            if (!currentResultData || currentResultData.length === 0) {
                alert('No data to export. Please run a query first.');
                return;
            }

            // Determine headers: use explicit columns if available, otherwise infer
            let headers;
            if (currentResultColumns && currentResultColumns.length > 0) {
                headers = currentResultColumns.map(c => c.name);
            } else {
                headers = Array.from(new Set(currentResultData.flatMap(Object.keys)));
            }

            const csvRows = [];
            csvRows.push(headers.join(','));

            for (const row of currentResultData) {
                const values = headers.map(header => {
                    const val = row[header] === null || row[header] === undefined ? '' : row[header];
                    const escaped = ('' + val).replace(/"/g, '""');
                    return `"${escaped}"`;
                });
                csvRows.push(values.join(','));
            }
            
            const csvString = csvRows.join('\n');
            const blob = new Blob([csvString], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.setAttribute('hidden', '');
            a.setAttribute('href', url);
            a.setAttribute('download', 'query_result.csv');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    // Resizer Logic
    const resizer = win.querySelector('.editor-resizer');
    const editorBody = win.querySelector('.query-editor-body');
    
    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        resizer.classList.add('resizing');
        
        // Add listeners to document to handle drag outside the element
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault(); 
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        
        // Calculate new height relative to the window top
        const winRect = win.getBoundingClientRect();
        const headerHeight = win.querySelector('.query-editor-header').offsetHeight;
        
        // New height = Mouse Y - Window Top - Header Height
        let newHeight = e.clientY - winRect.top - headerHeight;
        
        // Constraints
        if (newHeight < 100) newHeight = 100; // Min height
        if (newHeight > winRect.height - 150) newHeight = winRect.height - 150; // Max height (leave space for footer/results)

        editorBody.style.height = `${newHeight}px`;
    }

    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        document.body.style.cursor = 'default';
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

function openQueryEditor(queryData = null) {
    const win = document.getElementById('query-editor-window');
    if (!win) return;
    
    // Set active query state
    window.currentEditingQuery = queryData;
    if (typeof window.renderSavedQueries === 'function') {
        window.renderSavedQueries();
    }
    
    win.style.display = 'flex';
    
    const tabName = win.querySelector('.tab-name');
    const textarea = win.querySelector('.query-textarea');
    const resultsContainer = win.querySelector('.query-results-container');
    const btnSave = win.querySelector('.btn-save-query');

    // Reset Save Button State
    if (btnSave) {
        btnSave.innerHTML = '<i class="material-icons" style="font-size: 18px;">save</i> <span style="font-size: 13px;">Save</span>';
    }

    if (queryData) {
        // Load existing query
        if (tabName) tabName.textContent = queryData.name;
        if (textarea) textarea.value = queryData.query;
    } else {
        // New Query
        if (tabName) tabName.textContent = 'New Query';
        if (textarea) textarea.value = '-- New SQL Query\nSELECT * \nFROM [table_name]\nLIMIT 100;';
        
        // Clear results to empty state
        if (resultsContainer) {
            resultsContainer.innerHTML = `
            <div class="query-results-empty-state">
                <div class="empty-state-icon">
                    <div class="skeleton-line" style="width: 60%;"></div>
                    <div class="skeleton-line" style="width: 80%;"></div>
                    <div class="skeleton-line" style="width: 50%;"></div>
                    <div class="skeleton-line" style="width: 70%;"></div>
                </div>
                <p>Preview query results before updating</p>
                <button class="btn-test-primary">Test</button>
            </div>`;
            
            // Re-attach listener to new button by delegating to main test button
            const btnPrimary = resultsContainer.querySelector('.btn-test-primary');
            if (btnPrimary) {
                 btnPrimary.addEventListener('click', () => {
                     const mainTestBtn = win.querySelector('.btn-test');
                     if (mainTestBtn) mainTestBtn.click();
                 });
            }
        }
    }
    
    // Trigger input event to update highlight
    if (textarea) textarea.dispatchEvent(new Event('input'));
}

function toggleQueriesPanel() {
    const panel = document.getElementById('queries-panel');
    if (panel) {
        panel.classList.toggle('open');
    }
}

function initContextMenu() {
    const dashboardMain = document.querySelector('.dashboard-main');
    if (!dashboardMain) return;

    // Create Context Menu Element
    const menu = document.createElement('div');
    menu.id = 'dashboard-context-menu';
    menu.className = 'dashboard-context-menu';
    menu.style.display = 'none';
    menu.innerHTML = `
        <div class="context-menu-item" id="ctx-remove-all">
            <i class="material-icons">delete_sweep</i> Remove All
        </div>
        <div class="context-menu-item" id="ctx-align-all">
            <i class="material-icons">grid_view</i> Align All
        </div>
    `;
    document.body.appendChild(menu);

    // Show Menu
    dashboardMain.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const { clientX: mouseX, clientY: mouseY } = e;

        menu.style.top = `${mouseY}px`;
        menu.style.left = `${mouseX}px`;
        menu.style.display = 'block';
    });

    // Hide Menu on Click Elsewhere
    document.addEventListener('click', (e) => {
        if (e.target.closest('#dashboard-context-menu')) return;
        menu.style.display = 'none';
    });

    // Actions
    document.getElementById('ctx-remove-all').addEventListener('click', () => {
        if (confirm('Are you sure you want to remove all widgets?')) {
            // Logic to clear widgets (currently just clearing the empty state text for demo)
            const emptyState = dashboardMain.querySelector('.dashboard-empty-state');
            if (emptyState) emptyState.innerHTML = '<h3>Dashboard Canvas</h3><p>Cleared!</p>';
            menu.style.display = 'none';
        }
    });

    document.getElementById('ctx-align-all').addEventListener('click', () => {
        alert('Align All triggered');
        menu.style.display = 'none';
    });
}

function initSidebarResizer() {
    const sidebar = document.getElementById('dashboard-sidebar');
    const resizer = document.getElementById('dashboard-sidebar-resizer');
    
    if (!sidebar || !resizer) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'col-resize';
        resizer.classList.add('resizing');
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        e.preventDefault(); // Prevent text selection
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        const container = sidebar.parentElement;
        const containerRect = container.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        
        if (newWidth > 150 && newWidth < 500) {
            sidebar.style.width = `${newWidth}px`;
        }
    }

    function handleMouseUp() {
        isResizing = false;
        document.body.style.cursor = 'default';
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
}

function initSidebarToggle() {
    const sidebar = document.getElementById('dashboard-sidebar');
    const collapsedSidebar = document.getElementById('dashboard-sidebar-collapsed');
    const toggleBtn = document.getElementById('dashboard-sidebar-toggle');
    const expandBtn = document.getElementById('dashboard-sidebar-expand');

    if (!sidebar || !collapsedSidebar || !toggleBtn || !expandBtn) return;

    toggleBtn.addEventListener('click', () => {
        sidebar.style.display = 'none';
        collapsedSidebar.style.display = 'flex';
    });

    expandBtn.addEventListener('click', () => {
        sidebar.style.display = 'flex';
        collapsedSidebar.style.display = 'none';
    });
}
