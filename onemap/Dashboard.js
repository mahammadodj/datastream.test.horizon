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
                { name: 'Queries', icon: 'terminal', type: 'query' }
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
    panel.querySelector('#add-query-btn').addEventListener('click', () => {
        openQueryEditor();
    });

    // Empty State Create Handler
    const emptyCreateBtn = panel.querySelector('#create-query-btn-empty');
    if (emptyCreateBtn) {
        emptyCreateBtn.addEventListener('click', () => {
            openQueryEditor();
        });
    }
}

function initQueryEditor() {
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
FROM "foundry_sync"."ssid_table"
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
                    <i class="material-icons action-icon">upload</i>
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
        alert(`Saving query: "${name}"\n\n${query}`);
        // Here you would implement the actual save logic
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

    textarea.addEventListener('input', updateHighlight);
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
            // Here you would switch the view content
        });
    });

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

function openQueryEditor() {
    const win = document.getElementById('query-editor-window');
    if (win) {
        win.style.display = 'flex';
    }
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
