
const { createApp, ref, reactive, onMounted, computed } = Vue;

const DatasetLineage = {
    setup() {
        const tables = ref([]);
        const links = ref([]);

        const isDragging = ref(false);
        const currentTableId = ref(null);
        const offset = reactive({ x: 0, y: 0 });

        const startDrag = (event, table) => {
            if (event.target.classList.contains('port')) return;
            isDragging.value = true;
            currentTableId.value = table.id;
            offset.x = event.clientX - table.x;
            offset.y = event.clientY - table.y;
            
            document.addEventListener('mousemove', onDrag);
            document.addEventListener('mouseup', stopDrag);
        };

        const onDrag = (event) => {
            if (!isDragging.value) return;
            const table = tables.value.find(t => t.id === currentTableId.value);
            if (table) {
                table.x = event.clientX - offset.x;
                table.y = event.clientY - offset.y;
            }
        };

        const notifyChange = () => {
            const event = new CustomEvent('efs:lineage-updated', {
                detail: {
                    tables: JSON.parse(JSON.stringify(tables.value)),
                    links: JSON.parse(JSON.stringify(links.value)),
                    timestamp: Date.now()
                }
            });
            window.dispatchEvent(event);
        };

        const stopDrag = () => {
            if (isDragging.value) {
                notifyChange();
            }
            isDragging.value = false;
            currentTableId.value = null;
            document.removeEventListener('mousemove', onDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        // Linking Logic
        const tempLink = reactive({ startX: 0, startY: 0, endX: 0, endY: 0, active: false });
        const linkingSource = ref(null);

        const getPortPosition = (tableId, colName, isRight = true) => {
            const table = tables.value.find(t => t.id === tableId);
            if (!table) return { x: 0, y: 0 };
            const colIndex = table.columns.findIndex(c => c.name === colName);
            const headerHeight = 45; 
            const rowHeight = 35;
            const tableWidth = 240;
            const paddingY = 5;

            const y = table.y + headerHeight + paddingY + (colIndex * rowHeight) + (rowHeight / 2);
            const x = table.x + (isRight ? (tableWidth - 8) : 8);
            return { x, y };
        };

        const startLinking = (event, table, col, isRight) => {
            event.stopPropagation();
            const pos = getPortPosition(table.id, col.name, isRight);
            linkingSource.value = { tableId: table.id, colName: col.name, isRight };
            
            tempLink.startX = pos.x;
            tempLink.startY = pos.y;
            
            const container = document.querySelector('.dataset-lineage-container');
            const rect = container.getBoundingClientRect();
            tempLink.endX = event.clientX - rect.left;
            tempLink.endY = event.clientY - rect.top;
            
            tempLink.active = true;

            document.addEventListener('mousemove', onLinking);
            document.addEventListener('mouseup', stopLinking);
        };

        const onLinking = (event) => {
            if (!tempLink.active) return;
            const container = document.querySelector('.dataset-lineage-container');
            if (!container) return;
            const rect = container.getBoundingClientRect();
            tempLink.endX = event.clientX - rect.left;
            tempLink.endY = event.clientY - rect.top;
        };

        const completeLinking = (event, table, col, isRight) => {
            event.stopPropagation();
            if (linkingSource.value && tempLink.active) {
                if (linkingSource.value.tableId === table.id && linkingSource.value.colName === col.name) {
                    stopLinking();
                    return;
                }

                links.value.push({
                    id: Date.now(),
                    sourceTableId: linkingSource.value.tableId,
                    sourceCol: linkingSource.value.colName,
                    targetTableId: table.id,
                    targetCol: col.name
                });
                notifyChange();
            }
            stopLinking();
        };

        const stopLinking = () => {
            tempLink.active = false;
            linkingSource.value = null;
            document.removeEventListener('mousemove', onLinking);
            document.removeEventListener('mouseup', stopLinking);
        };

        const calculatePath = (link) => {
            const sourceTable = tables.value.find(t => t.id === link.sourceTableId);
            const targetTable = tables.value.find(t => t.id === link.targetTableId);
            
            if (!sourceTable || !targetTable) return '';

            // Determine optimal ports based on relative position
            const isSourceLeftOfTarget = sourceTable.x < targetTable.x;

            let start, end;
            let cp1x, cp2x;
            const curvature = 0.5;

            if (isSourceLeftOfTarget) {
                // Source [Right Port] ----> [Left Port] Target
                start = getPortPosition(link.sourceTableId, link.sourceCol, true);
                end = getPortPosition(link.targetTableId, link.targetCol, false);
                
                const dx = end.x - start.x;
                const controlDist = Math.max(Math.abs(dx) * curvature, 50);
                
                cp1x = start.x + controlDist;
                cp2x = end.x - controlDist;
            } else {
                // Target [Right Port] <---- [Left Port] Source
                start = getPortPosition(link.sourceTableId, link.sourceCol, false);
                end = getPortPosition(link.targetTableId, link.targetCol, true);
                
                const dx = start.x - end.x; // positive distance
                const controlDist = Math.max(Math.abs(dx) * curvature, 50);
                
                cp1x = start.x - controlDist;
                cp2x = end.x + controlDist;
            }
            
            return `M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`;
        };
        
        const tempLinkPath = () => {
            if (!tempLink.active) return '';
            const start = { x: tempLink.startX, y: tempLink.startY };
            const end = { x: tempLink.endX, y: tempLink.endY };
            
            // Use the source port direction if available
            const isSourceRight = linkingSource.value ? linkingSource.value.isRight : true;
            
            const dist = Math.abs(end.x - start.x) * 0.5;
            const controlDist = Math.max(dist, 50);
            
            const cp1x = isSourceRight ? start.x + controlDist : start.x - controlDist;
            
            // For the end point (mouse cursor), we can just infer direction or make it symmetric
            const cp2x = (end.x > start.x) ? end.x - controlDist : end.x + controlDist;
            
            return `M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`;
        };

        const fileInput = ref(null);
        const isLoading = ref(false);
        const loadingMessage = ref('');

        const triggerImport = () => {
            fileInput.value.click();
        };

        const handleFileUpload = (event) => {
            const file = event.target.files[0];
            if (!file) return;

            isLoading.value = true;
            loadingMessage.value = `Processing ${file.name}...`;

            const reader = new FileReader();
            const name = file.name.toLowerCase();
            const tableName = file.name.split('.')[0];

            reader.onload = (evt) => {
                try {
                    if (name.endsWith('.csv')) {
                        const text = evt.target.result;
                        const { columns, data } = parseCSV(text);
                        if (columns.length > 0) {
                            addTable(tableName, columns, data);
                        } else {
                            alert("No valid headers found in CSV.");
                        }
                    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                        const data = evt.target.result;
                        if (typeof XLSX !== 'undefined') {
                            const workbook = XLSX.read(data, { type: 'array' });
                            const firstSheetName = workbook.SheetNames[0];
                            const worksheet = workbook.Sheets[firstSheetName];
                            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                            if (json && json.length > 0) {
                                const headers = json[0];
                                if (Array.isArray(headers)) {
                                    const columns = headers
                                        .filter(h => h !== null && h !== undefined && String(h).trim() !== '')
                                        .map(h => ({ name: String(h).trim(), type: 'string' }));
                                    
                                    // Extract preview data (first 20 rows)
                                    const previewData = json.slice(1, 21).map(row => {
                                        const rowObj = {};
                                        columns.forEach((col, index) => {
                                            // Find index in original headers
                                            const originalIndex = headers.indexOf(col.name);
                                            rowObj[col.name] = row[originalIndex];
                                        });
                                        return rowObj;
                                    });

                                    if (columns.length > 0) {
                                        addTable(tableName, columns, previewData);
                                    } else {
                                        alert("No valid headers found in Excel file.");
                                    }
                                } else {
                                    alert("Invalid header format in Excel file.");
                                }
                            } else {
                                alert("Excel file appears to be empty.");
                            }
                        } else {
                            alert('XLSX library not loaded.');
                        }
                    } else {
                        alert('Unsupported file format. Please use CSV or XLSX.');
                    }
                } catch (error) {
                    console.error("Error processing file:", error);
                    alert("Error processing file: " + error.message);
                } finally {
                    isLoading.value = false;
                    loadingMessage.value = '';
                    if (fileInput.value) fileInput.value.value = '';
                }
            };

            reader.onerror = (err) => {
                console.error("File reading error:", err);
                isLoading.value = false;
                loadingMessage.value = '';
                alert("Error reading file.");
            };

            if (name.endsWith('.csv')) {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        };

        const parseCSV = (text) => {
            const lines = text.split('\n');
            const firstLine = lines[0];
            if (!firstLine) return { columns: [], data: [] };
            
            const headers = firstLine.split(',').map(h => h ? h.trim() : '').filter(h => h !== '');
            const columns = headers.map(h => ({ name: h, type: 'string' }));
            
            // Parse first 20 rows for preview
            const data = lines.slice(1, 21).filter(l => l.trim()).map(line => {
                const values = line.split(',');
                const row = {};
                headers.forEach((h, i) => {
                    row[h] = values[i] ? values[i].trim() : '';
                });
                return row;
            });

            return { columns, data };
        };

        const addTable = (name, columns, data = []) => {
            const newTable = {
                id: Date.now(),
                name: name,
                x: 50 + (tables.value.length * 20),
                y: 50 + (tables.value.length * 20),
                columns: columns,
                data: data // Store preview data
            };
            tables.value.push(newTable);
            notifyChange();
            return newTable;
        };

        // Preview Modal Logic
        const previewModal = reactive({
            visible: false,
            title: '',
            columns: [],
            rows: [],
            originalTableId: null
        });

        const openPreview = () => {
            if (contextMenu.targetTable) {
                const table = contextMenu.targetTable;
                previewModal.title = table.name;
                // Deep copy columns to allow editing without immediate effect
                previewModal.columns = JSON.parse(JSON.stringify(table.columns));
                // Deep copy rows to allow editing
                previewModal.rows = JSON.parse(JSON.stringify(table.data || []));
                previewModal.originalTableId = table.id;
                previewModal.visible = true;
                closeContextMenu();
            }
        };

        const closePreview = () => {
            previewModal.visible = false;
            previewModal.originalTableId = null;
        };

        const applyPreviewChanges = () => {
            const table = tables.value.find(t => t.id === previewModal.originalTableId);
            if (table) {
                table.columns = JSON.parse(JSON.stringify(previewModal.columns));
                table.data = JSON.parse(JSON.stringify(previewModal.rows));
                notifyChange();
            }
            closePreview();
        };

        const addColumn = () => {
            const newColName = `Column ${previewModal.columns.length + 1}`;
            previewModal.columns.push({ name: newColName, type: 'string' });
            // Add this key to all rows
            previewModal.rows.forEach(row => {
                row[newColName] = '';
            });
        };

        const removeColumn = (index) => {
            const colName = previewModal.columns[index].name;
            previewModal.columns.splice(index, 1);
            // Remove key from rows
            previewModal.rows.forEach(row => {
                delete row[colName];
            });
        };

        const updateColumnName = (index, newName) => {
            const oldName = previewModal.columns[index].name;
            if (oldName === newName) return;
            
            previewModal.columns[index].name = newName;
            
            // Update rows
            previewModal.rows.forEach(row => {
                row[newName] = row[oldName];
                delete row[oldName];
            });
        };

        const addRow = () => {
            const newRow = {};
            previewModal.columns.forEach(col => {
                newRow[col.name] = '';
            });
            previewModal.rows.push(newRow);
        };

        const removeRow = (index) => {
            previewModal.rows.splice(index, 1);
        };

        // Context Menu Logic
        const contextMenu = reactive({
            visible: false,
            x: 0,
            y: 0,
            type: 'background', // 'background' or 'table'
            targetTable: null
        });

        const showContextMenu = (event) => {
            event.preventDefault();
            contextMenu.visible = true;
            contextMenu.x = event.clientX;
            contextMenu.y = event.clientY;
            contextMenu.type = 'background';
            contextMenu.targetTable = null;
            adjustMenuPosition();
            document.addEventListener('click', closeContextMenu);
        };

        const showTableContextMenu = (event, table) => {
            event.preventDefault();
            event.stopPropagation(); // Prevent background menu
            contextMenu.visible = true;
            contextMenu.x = event.clientX;
            contextMenu.y = event.clientY;
            contextMenu.type = 'table';
            contextMenu.targetTable = table;
            adjustMenuPosition();
            document.addEventListener('click', closeContextMenu);
        };

        const adjustMenuPosition = () => {
            const menuWidth = 150;
            const menuHeight = 100;
            if (contextMenu.x + menuWidth > window.innerWidth) {
                contextMenu.x -= menuWidth;
            }
            if (contextMenu.y + menuHeight > window.innerHeight) {
                contextMenu.y -= menuHeight;
            }
        };

        const closeContextMenu = () => {
            contextMenu.visible = false;
            document.removeEventListener('click', closeContextMenu);
        };

        const createTableFromContextMenu = () => {
            const name = prompt("Enter dataset name:", "New Dataset");
            if (name) {
                // Create with a default ID column
                const newTable = addTable(name, [{ name: 'ID', type: 'int' }]);
                // Open preview immediately to let user edit
                contextMenu.targetTable = newTable;
                openPreview();
            }
        };

        const deleteTable = (tableId) => {
            if (confirm("Are you sure you want to delete this dataset?")) {
                tables.value = tables.value.filter(t => t.id !== tableId);
                // Also remove associated links
                links.value = links.value.filter(l => l.sourceTableId !== tableId && l.targetTableId !== tableId);
                notifyChange();
            }
        };

        // Renaming Logic
        const renamingTableId = ref(null);

        const startRenaming = (table) => {
            renamingTableId.value = table.id;
            // Use setTimeout to wait for DOM update
            setTimeout(() => {
                const input = document.getElementById('rename-input-' + table.id);
                if (input) input.focus();
            }, 0);
        };

        const finishRenaming = () => {
            renamingTableId.value = null;
            notifyChange();
        };

        const validateCell = (value, type) => {
            if (value === null || value === undefined || value === '') return true;
            const strVal = String(value).trim();
            if (strVal === '') return true;

            switch (type) {
                case 'int':
                    return /^-?\d+$/.test(strVal);
                case 'decimal':
                    return !isNaN(parseFloat(strVal)) && isFinite(strVal);
                case 'datetime':
                    // Stricter check: must not be a plain number (e.g. "401.3")
                    if (!isNaN(strVal)) return false;
                    const date = Date.parse(strVal);
                    return !isNaN(date);
                case 'boolean':
                    const lower = strVal.toLowerCase();
                    return ['true', 'false', '0', '1', 'yes', 'no'].includes(lower);
                default:
                    return true;
            }
        };

        const hasPreviewErrors = computed(() => {
            if (!previewModal.visible) return false;
            return previewModal.rows.some(row => 
                previewModal.columns.some(col => !validateCell(row[col.name], col.type))
            );
        });

        const availableTypes = ['string', 'int', 'decimal', 'datetime', 'boolean'];

        return {
            tables,
            links,
            startDrag,
            fileInput,
            triggerImport,
            handleFileUpload,
            isLoading,
            loadingMessage,
            startLinking,
            completeLinking,
            calculatePath,
            tempLink,
            tempLinkPath,
            contextMenu,
            showContextMenu,
            createTableFromContextMenu,
            deleteTable,
            availableTypes,
            notifyChange,
            previewModal,
            openPreview,
            closePreview,
            applyPreviewChanges,
            hasPreviewErrors,
            showTableContextMenu,
            renamingTableId,
            startRenaming,
            finishRenaming,
            validateCell,
            addColumn,
            removeColumn,
            updateColumnName,
            addRow,
            removeRow
        };
    },
    template: `
        <div class="dataset-lineage-container" 
             style="position: relative; width: 100%; height: 100%; background-color: #f4f4f4; overflow: hidden;"
             @contextmenu.prevent="showContextMenu">
            
            <div class="toolbar" style="position: absolute; top: 10px; left: 10px; z-index: 100;">
                <button @click="triggerImport" class="btn btn-primary btn-sm" style="box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    Import Dataset
                </button>
                <input type="file" ref="fileInput" @change="handleFileUpload" accept=".csv, .xlsx, .xls" style="display: none;" />
            </div>

            <div v-if="isLoading" class="loading-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); z-index: 200; display: flex; justify-content: center; align-items: center; flex-direction: column;">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div style="margin-top: 15px; font-weight: bold; color: #555; font-size: 16px;">{{ loadingMessage }}</div>
            </div>

            <!-- Preview Modal -->
            <div v-if="previewModal.visible" class="preview-modal-overlay" @click.self="closePreview">
                <div class="preview-modal">
                    <div class="preview-header">
                        <h3>Preview: {{ previewModal.title }}</h3>
                        <button class="close-btn" @click="closePreview">&times;</button>
                    </div>
                    <div class="preview-body">
                        <table class="table table-striped table-bordered table-sm">
                            <thead>
                                <tr>
                                    <th v-for="(col, index) in previewModal.columns" :key="index">
                                        <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 5px;">
                                            <div style="display: flex; align-items: center; gap: 5px; width: 100%;">
                                                <input 
                                                    :value="col.name" 
                                                    @change="updateColumnName(index, $event.target.value)"
                                                    class="form-control form-control-sm"
                                                    style="font-weight: bold; font-size: 12px; padding: 2px 5px;"
                                                />
                                                <button @click="removeColumn(index)" class="btn btn-outline-danger btn-sm" style="padding: 0 4px; font-size: 10px; line-height: 1;">&times;</button>
                                            </div>
                                            <select v-model="col.type" class="col-type-select" style="margin-left: 0; margin-top: 0; width: 100%;">
                                                <option v-for="type in availableTypes" :key="type" :value="type">{{ type }}</option>
                                            </select>
                                        </div>
                                    </th>
                                    <th style="vertical-align: middle; text-align: center; width: 40px; min-width: 40px;">
                                        <button @click="addColumn" class="btn btn-success btn-sm" style="padding: 0 6px; font-size: 14px; line-height: 1;" title="Add Column">+</button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, rowIndex) in previewModal.rows" :key="rowIndex">
                                    <td v-for="(col, colIndex) in previewModal.columns" :key="colIndex"
                                        :class="{ 'invalid-cell': !validateCell(row[col.name], col.type) }"
                                        :title="!validateCell(row[col.name], col.type) ? 'Value does not match type ' + col.type : ''">
                                        <input v-model="row[col.name]" style="width: 100%; border: none; background: transparent; outline: none; font-family: inherit; font-size: inherit;" />
                                    </td>
                                    <td class="text-center">
                                        <button @click="removeRow(rowIndex)" class="btn btn-outline-danger btn-sm" style="padding: 0 4px; font-size: 10px; line-height: 1;">&times;</button>
                                    </td>
                                </tr>
                                <tr v-if="previewModal.rows.length === 0">
                                    <td :colspan="previewModal.columns.length + 1" class="text-center">No data available. Add a row to start editing.</td>
                                </tr>
                            </tbody>
                        </table>
                        <button @click="addRow" class="btn btn-outline-primary btn-sm mt-2" style="margin-top: 10px;">+ Add Row</button>
                    </div>
                    <div class="preview-footer" style="padding: 15px; border-top: 1px solid #eee; display: flex; justify-content: flex-end; gap: 10px;">
                        <div v-if="hasPreviewErrors" style="color: #d9534f; margin-right: auto; display: flex; align-items: center; font-size: 14px;">
                            <span style="margin-right: 5px;">⚠️</span>
                            Validation errors found. Please fix types before applying.
                        </div>
                        <button class="btn btn-secondary" @click="closePreview">Cancel</button>
                        <button class="btn btn-primary" @click="applyPreviewChanges" :disabled="hasPreviewErrors">Apply Changes</button>
                    </div>
                </div>
            </div>

            <!-- Context Menu -->
            <div v-if="contextMenu.visible" 
                 class="context-menu" 
                 :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">
                <div v-if="contextMenu.type === 'background'" class="context-menu-item" @click="createTableFromContextMenu">
                    <i class="bi bi-plus-circle" style="margin-right: 8px;"></i> Create Dataset
                </div>
                <div v-if="contextMenu.type === 'table'" class="context-menu-item" @click="openPreview">
                    <i class="bi bi-eye" style="margin-right: 8px;"></i> Preview Data
                </div>
            </div>

            <svg class="connections-layer">
                <path v-for="link in links" :key="link.id" :d="calculatePath(link)" class="connection-line" />
                <path v-if="tempLink.active" :d="tempLinkPath()" class="connection-line" style="stroke-dasharray: 5,5;" />
            </svg>

            <div v-for="table in tables" :key="table.id" 
                 class="table-node"
                 :style="{ left: table.x + 'px', top: table.y + 'px' }"
                 @mousedown="startDrag($event, table)"
                 @contextmenu.prevent.stop="showTableContextMenu($event, table)">
                <div class="table-header" @dblclick.stop="startRenaming(table)">
                    <span v-if="renamingTableId !== table.id" class="table-title">{{ table.name }}</span>
                    <input 
                        v-else 
                        :id="'rename-input-' + table.id"
                        v-model="table.name" 
                        @blur="finishRenaming" 
                        @keyup.enter="finishRenaming"
                        class="table-title-input"
                        @mousedown.stop 
                    />
                    <button class="delete-btn" @click.stop="deleteTable(table.id)" title="Delete Dataset">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>
                <div class="table-body">
                    <div v-for="col in table.columns" :key="col.name" class="table-column">
                        <div class="port port-left" @mousedown.stop="startLinking($event, table, col, false)" @mouseup.stop="completeLinking($event, table, col, false)"></div>
                        <span class="col-name">{{ col.name }}</span>
                        <select v-model="col.type" @change="notifyChange" class="col-type-select" @mousedown.stop>
                            <option v-for="type in availableTypes" :key="type" :value="type">{{ type }}</option>
                        </select>
                        <div class="port port-right" @mousedown.stop="startLinking($event, table, col, true)" @mouseup.stop="completeLinking($event, table, col, true)"></div>
                    </div>
                </div>
            </div>
        </div>
    `
};

// Add styles dynamically
const style = document.createElement('style');
style.textContent = `
    .preview-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .preview-modal {
        background: white;
        width: 80%;
        max-width: 900px;
        height: 80%;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
    .preview-header {
        padding: 15px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .preview-header h3 {
        margin: 0;
        font-size: 18px;
    }
    .close-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    .preview-body {
        padding: 15px;
        overflow: auto;
        flex-grow: 1;
    }
    .preview-body table th, .preview-body table td {
        white-space: nowrap;
        min-width: 150px;
        vertical-align: middle;
    }
    .invalid-cell {
        background-color: #ffe6e6 !important;
        color: #d9534f !important;
        position: relative;
    }
    .invalid-cell::after {
        content: "!";
        position: absolute;
        top: 2px;
        right: 2px;
        font-size: 10px;
        font-weight: bold;
        color: #d9534f;
    }
    .table-node {
        position: absolute;
        width: 240px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        border: 1px solid #e0e0e0;
        cursor: move;
        user-select: none;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        z-index: 1;
        display: flex;
        flex-direction: column;
        max-height: 400px;
        transition: box-shadow 0.2s, border-color 0.2s;
    }
    .table-node:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        border-color: #b0b0b0;
    }
    .table-header {
        height: 45px;
        padding: 0 15px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
        border-bottom: 1px solid #dee2e6;
        font-weight: 600;
        border-radius: 8px 8px 0 0;
        color: #333;
        box-sizing: border-box;
        overflow: hidden;
        flex-shrink: 0;
    }
    .table-title {
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        flex-grow: 1;
        margin-right: 10px;
    }
    .table-title-input {
        flex-grow: 1;
        margin-right: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 2px 5px;
        font-size: 14px;
        font-weight: 600;
        font-family: inherit;
    }
    .delete-btn {
        background: none;
        border: none;
        color: #999;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    .delete-btn:hover {
        background-color: #ffebee;
        color: #d32f2f;
    }
    .table-body {
        padding: 5px 0;
        overflow-y: auto;
        overflow-x: hidden;
        flex-grow: 1;
    }
    /* Custom Scrollbar for Table Body */
    .table-body::-webkit-scrollbar {
        width: 4px;
    }
    .table-body::-webkit-scrollbar-track {
        background: transparent; 
    }
    .table-body::-webkit-scrollbar-thumb {
        background: #d1d1d1; 
        border-radius: 2px;
    }
    .table-body::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8; 
    }

    .table-column {
        height: 35px;
        padding: 0 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #495057;
        font-size: 13px;
        position: relative;
        box-sizing: border-box;
        border-bottom: 1px solid #f8f9fa;
    }
    .table-column:last-child {
        border-bottom: none;
    }
    .table-column:hover {
        background-color: #e3f2fd;
    }
    .col-name {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 120px;
    }
    .col-type-select {
        font-size: 11px;
        color: #495057;
        background: #f1f3f5;
        border: 1px solid #ced4da;
        border-radius: 4px;
        padding: 1px 4px;
        margin-left: 8px;
        cursor: pointer;
        outline: none;
        max-width: 80px;
    }
    .col-type-select:hover {
        background: #e9ecef;
    }
    .port {
        width: 8px;
        height: 8px;
        background: #adb5bd;
        border: 1px solid #868e96;
        border-radius: 50%;
        cursor: crosshair;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
        transition: all 0.2s;
    }
    .port:hover {
        background: #5c6bc0;
        border-color: #3949ab;
        transform: translateY(-50%) scale(1.3);
    }
    .port-right {
        right: 2px;
    }
    .port-left {
        left: 2px;
    }
    .connections-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
    }
    .connection-line {
        stroke: #5c6bc0;
        stroke-width: 2px;
        fill: none;
    }
    
    /* Context Menu Styles */
    .context-menu {
        position: fixed;
        background: white;
        border: 1px solid #ddd;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        border-radius: 4px;
        z-index: 1000;
        min-width: 150px;
        padding: 5px 0;
    }
    .context-menu-item {
        padding: 8px 15px;
        cursor: pointer;
        font-size: 14px;
        color: #333;
        display: flex;
        align-items: center;
    }
    .context-menu-item:hover {
        background-color: #f8f9fa;
        color: #007bff;
    }
`;
document.head.appendChild(style);

// Mount the app
document.addEventListener('DOMContentLoaded', () => {
    const mountPoint = document.getElementById('dataset-tab');
    if (mountPoint) {
        createApp(DatasetLineage).mount('#dataset-tab');
    }
});
