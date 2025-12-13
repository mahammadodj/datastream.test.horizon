
// NEW: Settings Drawer for Radio Button
function openRadioSettings(container, wrapper) {
    const isDark = document.body.classList.contains('dark-theme');
    
    // Create Drawer Overlay
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex',
        justifyContent: 'flex-end', alignItems: 'stretch'
    });
    
    overlay.onclick = (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    };

    // Drawer Content
    const modal = document.createElement('div');
    Object.assign(modal.style, {
        backgroundColor: isDark ? '#333' : 'white',
        color: isDark ? '#eee' : '#333',
        width: '400px', 
        height: '100%',
        boxShadow: '-2px 0 10px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transform: 'translateX(100%)', transition: 'transform 0.3s ease-out'
    });
    
    requestAnimationFrame(() => {
        modal.style.transform = 'translateX(0)';
    });

    // Header
    const header = document.createElement('div');
    header.innerText = 'Radio Button Settings';
    Object.assign(header.style, {
        padding: '15px', borderBottom: isDark ? '1px solid #444' : '1px solid #ddd',
        fontWeight: 'bold', fontSize: '16px', display: 'flex', justifyContent: 'space-between'
    });
    const closeX = document.createElement('span');
    closeX.innerHTML = '&times;';
    closeX.style.cursor = 'pointer';
    closeX.onclick = () => document.body.removeChild(overlay);
    header.appendChild(closeX);
    modal.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.style.padding = '20px';
    content.style.overflowY = 'auto';
    content.style.flex = '1';

    // --- Data Binding Section ---
    const dataSection = document.createElement('div');
    dataSection.style.marginBottom = '20px';
    dataSection.style.paddingBottom = '15px';
    dataSection.style.borderBottom = isDark ? '1px solid #444' : '1px solid #eee';

    const sectionTitle = document.createElement('div');
    sectionTitle.innerText = 'Populate from Data';
    sectionTitle.style.fontWeight = 'bold';
    sectionTitle.style.marginBottom = '10px';
    dataSection.appendChild(sectionTitle);

    // Dataset Select
    const dsLabel = document.createElement('label');
    dsLabel.innerText = 'Select Dataset:';
    dsLabel.style.display = 'block'; dsLabel.style.fontSize = '12px';
    
    const dsSelect = document.createElement('select');
    dsSelect.style.width = '100%'; dsSelect.style.marginBottom = '10px';
    dsSelect.style.padding = '5px';
    dsSelect.style.backgroundColor = isDark ? '#444' : 'white';
    dsSelect.style.color = isDark ? '#eee' : '#333';
    dsSelect.style.border = '1px solid #888';
    
    const defaultOpt = document.createElement('option');
    defaultOpt.text = 'Select...';
    dsSelect.appendChild(defaultOpt);

    if (window.lineageData && window.lineageData.tables && window.lineageData.tables.length > 0) {
        window.lineageData.tables.forEach((t, i) => {
            const opt = document.createElement('option');
            opt.value = i; // Use index
            opt.text = t.name;
            dsSelect.appendChild(opt);
        });
    } else {
        const noDataOpt = document.createElement('option');
        noDataOpt.text = '(No datasets available)';
        noDataOpt.disabled = true;
        dsSelect.appendChild(noDataOpt);
    }

    dataSection.appendChild(dsLabel);
    dataSection.appendChild(dsSelect);

    // Column Select
    const colLabel = document.createElement('label');
    colLabel.innerText = 'Select Column:';
    colLabel.style.display = 'block'; colLabel.style.fontSize = '12px';
    
    const colSelect = document.createElement('select');
    colSelect.style.width = '100%'; colSelect.style.marginBottom = '10px';
    colSelect.style.padding = '5px';
    colSelect.style.backgroundColor = isDark ? '#444' : 'white';
    colSelect.style.color = isDark ? '#eee' : '#333';
    colSelect.style.border = '1px solid #888';
    colSelect.disabled = true;

    dataSection.appendChild(colLabel);
    dataSection.appendChild(colSelect);

    // Load Button
    const loadBtn = document.createElement('button');
    loadBtn.innerText = 'Load Values';
    Object.assign(loadBtn.style, {
        padding: '5px 10px', cursor: 'pointer', width: '100%',
        backgroundColor: '#28a745', border: 'none', borderRadius: '4px', color: 'white',
        fontSize: '12px'
    });
    loadBtn.disabled = true;
    loadBtn.style.opacity = '0.6';

    dataSection.appendChild(loadBtn);

    // Logic
    dsSelect.onchange = () => {
        colSelect.innerHTML = '';
        if (dsSelect.value === 'Select...' || !window.lineageData || !window.lineageData.tables) {
            colSelect.disabled = true;
            loadBtn.disabled = true;
            loadBtn.style.opacity = '0.6';
            return;
        }
        
        const table = window.lineageData.tables[dsSelect.value];
        if (table && table.columns) {
            table.columns.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.name;
                opt.text = c.name;
                colSelect.appendChild(opt);
            });
            colSelect.disabled = false;
            loadBtn.disabled = false;
            loadBtn.style.opacity = '1';
        }
    };

    loadBtn.onclick = () => {
        if (!window.lineageData || !window.lineageData.tables) return;
        const table = window.lineageData.tables[dsSelect.value];
        const colName = colSelect.value;
        
        if (table && colName && table.data) {
                // Extract unique values
                const values = new Set();
                table.data.forEach(row => {
                    if (row[colName] !== undefined && row[colName] !== null && row[colName] !== '') {
                        values.add(String(row[colName]));
                    }
                });
                
                // Update textarea
                // Limit to reasonable amount to prevent freezing
                const sortedValues = Array.from(values).sort().slice(0, 100); 
                textarea.value = sortedValues.join('\n');
                
                if (values.size > 100) {
                    alert(`Loaded first 100 unique values from ${values.size} found.`);
                }
            }
        };

        // Restore saved state
        if (wrapper.dataset.selectedDatasetIndex) {
            dsSelect.value = wrapper.dataset.selectedDatasetIndex;
            // Manually trigger change logic to populate columns
            dsSelect.onchange();
            
            if (wrapper.dataset.selectedColumnName) {
                colSelect.value = wrapper.dataset.selectedColumnName;
            }
        }

        content.appendChild(dataSection);

    // Edit Options
    const lbl = document.createElement('label');
    lbl.innerText = 'Options (one per line):';
    lbl.style.display = 'block'; lbl.style.marginBottom = '5px';
    
    const textarea = document.createElement('textarea');
    textarea.style.width = '100%';
    textarea.style.height = '150px';
    textarea.style.padding = '8px';
    textarea.style.marginBottom = '15px';
    textarea.style.backgroundColor = isDark ? '#444' : 'white';
    textarea.style.color = isDark ? '#eee' : '#333';
    textarea.style.border = '1px solid #888';
    
    // Get current options
    const currentLabels = Array.from(wrapper.querySelectorAll('label')).map(l => l.textContent);
    textarea.value = currentLabels.join('\n');
    
    const saveBtn = document.createElement('button');
    saveBtn.innerText = 'Apply Changes';
    Object.assign(saveBtn.style, {
        padding: '8px 15px', cursor: 'pointer',
        backgroundColor: '#0075ff', border: 'none', borderRadius: '4px', color: 'white'
    });
    
    saveBtn.onclick = () => {
        // Save state
        if (dsSelect.value !== 'Select...') {
            wrapper.dataset.selectedDatasetIndex = dsSelect.value;
            wrapper.dataset.selectedColumnName = colSelect.value;
        } else {
            delete wrapper.dataset.selectedDatasetIndex;
            delete wrapper.dataset.selectedColumnName;
        }

        const newOptions = textarea.value.split('\n').filter(s => s.trim() !== '');
        
        // Rebuild form
        const form = wrapper.querySelector('form');
        form.innerHTML = '';
        
        // Keep consistent name group
        const groupName = 'radio_group_' + Date.now();

        newOptions.forEach((val, idx) => {
            const div = document.createElement('div');
            div.style.marginBottom = '8px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = groupName; 
            input.id = `radio_${Date.now()}_${idx}`;
            input.value = val;
            if (idx === 0) input.checked = true;
            input.style.marginRight = '8px';
            input.style.cursor = 'pointer';
            
            const label = document.createElement('label');
            label.htmlFor = input.id;
            label.textContent = val;
            label.style.cursor = 'pointer';
            label.style.fontSize = '14px';
            
            div.appendChild(input);
            div.appendChild(label);
            form.appendChild(div);
        });
        
        document.body.removeChild(overlay);
    };

    content.appendChild(lbl);
    content.appendChild(textarea);
    content.appendChild(saveBtn);
    
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}
