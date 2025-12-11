
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
                { name: 'Pie Chart', icon: 'pie_chart' },
                { name: 'Scatter Plot', icon: 'scatter_plot' },
                { name: 'Line Plot', icon: 'show_chart' },
                { name: 'Area Chart', icon: 'area_chart' },
                { name: 'Bar Plot', icon: 'bar_chart' },
                { name: 'Box Plot', icon: 'candlestick_chart' },
                { name: 'Bubble Plot', icon: 'bubble_chart' },
                { name: 'Gantt Chart', icon: 'calendar_view_week' },
                { name: 'Tree Map', icon: 'dashboard' },
                { name: 'Radar Chart', icon: 'radar' }
            ]
        },
        {
            id: 'controls',
            title: 'Controls',
            icon: 'tune',
            widgets: [
                { name: 'Button', icon: 'smart_button' },
                { name: 'Checkbox', icon: 'check_box' },
                { name: 'Dropdown', icon: 'arrow_drop_down_circle' },
                { name: 'Input box', icon: 'text_fields' },
                { name: 'Multiselect box', icon: 'checklist' },
                { name: 'Radio button', icon: 'radio_button_checked' },
                { name: 'Segmented control', icon: 'view_column' },
                { name: 'Slider', icon: 'linear_scale' },
                { name: 'Textarea', icon: 'notes' },
                { name: 'Toggle', icon: 'toggle_on' }
            ]
        },
        {
            id: 'others',
            title: 'Components',
            icon: 'widgets',
            widgets: [
                { name: 'Data Table', icon: 'table_chart' },
                { name: 'Layout Container', icon: 'view_quilt' }
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
            <i class="material-icons expand-icon">expand_more</i>
        `;
        
        // Create Content
        const content = document.createElement('div');
        content.className = 'dashboard-group-content';
        // Default expanded
        content.style.display = 'block';
        header.classList.add('expanded');

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
            content.appendChild(item);
        });

        groupContainer.appendChild(header);
        groupContainer.appendChild(content);
        widgetList.appendChild(groupContainer);
    });

    initSidebarResizer();
    initSidebarToggle();
    initContextMenu();
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
