
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

        const highlightedLinkId = ref(null);
        const highlightLink = (id) => {
            highlightedLinkId.value = id;
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
                    name: `Connection ${links.value.length + 1}`,
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
        const isDragOver = ref(false);

        const triggerImport = () => {
            fileInput.value.click();
        };

        const processFile = (file) => {
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

        const handleFileUpload = (event) => {
            const file = event.target.files[0];
            processFile(file);
        };

        const handleDragOver = (event) => {
            isDragOver.value = true;
        };

        const handleDragLeave = (event) => {
            // Only set to false if we are leaving the main container, not entering a child
            if (event.currentTarget.contains(event.relatedTarget)) return;
            isDragOver.value = false;
        };

        const handleDrop = (event) => {
            isDragOver.value = false;
            const files = event.dataTransfer.files;
            if (files.length > 0) {
                processFile(files[0]);
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

        // Expose addTable globally
        window.addTableToLineage = (name, columns, data) => {
            addTable(name, columns, data);
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
            let counter = 1;
            let newColName = `Column ${previewModal.columns.length + counter}`;
            while (previewModal.columns.some(c => c.name === newColName)) {
                counter++;
                newColName = `Column ${previewModal.columns.length + counter}`;
            }
            
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

        const addColumnToTableFromMenu = () => {
            if (contextMenu.targetTable) {
                const table = contextMenu.targetTable;
                
                let counter = 1;
                let newColName = `Column ${table.columns.length + counter}`;
                while (table.columns.some(c => c.name === newColName)) {
                    counter++;
                    newColName = `Column ${table.columns.length + counter}`;
                }
                
                table.columns.push({ name: newColName, type: 'string' });
                if (table.data) {
                    table.data.forEach(row => row[newColName] = '');
                }
                notifyChange();
                
                // Open preview to let user edit the new column
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

        const getTableName = (id) => {
            const t = tables.value.find(x => x.id === id);
            return t ? t.name : 'Unknown';
        };

        const deleteLink = (index) => {
            links.value.splice(index, 1);
            notifyChange();
        };

        // Sidebar Logic
        const sidebarWidth = ref(300);
        const isSidebarOpen = ref(true);
        const isResizingSidebar = ref(false);

        const toggleSidebar = () => {
            isSidebarOpen.value = !isSidebarOpen.value;
        };

        const startResizeSidebar = (event) => {
            isResizingSidebar.value = true;
            document.addEventListener('mousemove', onResizeSidebar);
            document.addEventListener('mouseup', stopResizeSidebar);
        };

        const onResizeSidebar = (event) => {
            if (!isResizingSidebar.value) return;
            const newWidth = window.innerWidth - event.clientX;
            if (newWidth > 200 && newWidth < 600) {
                sidebarWidth.value = newWidth;
            }
        };

        const stopResizeSidebar = () => {
            isResizingSidebar.value = false;
            document.removeEventListener('mousemove', onResizeSidebar);
            document.removeEventListener('mouseup', stopResizeSidebar);
        };

        return {
            tables,
            links,
            highlightedLinkId,
            highlightLink,
            getTableName,
            deleteLink,
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
            addColumnToTableFromMenu,
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
            removeRow,
            isDragOver,
            handleDragOver,
            handleDragLeave,
            handleDrop,
            sidebarWidth,
            isSidebarOpen,
            toggleSidebar,
            startResizeSidebar
        };
    },
    template: `
        <div class="dataset-lineage-container" 
             style="position: relative; width: 100%; height: 100%; background-color: #f4f4f4; overflow: hidden;"
             @contextmenu.prevent="showContextMenu"
             @dragover.prevent="handleDragOver"
             @dragleave.prevent="handleDragLeave"
             @drop.prevent="handleDrop">
            
            <div v-if="isDragOver" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(106, 17, 203, 0.1); z-index: 50; pointer-events: none; display: flex; justify-content: center; align-items: center; border: 4px dashed #6a11cb;">
                <div style="background: white; padding: 20px 40px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); font-size: 24px; color: #6a11cb; font-weight: bold;">
                    Drop file to import
                </div>
            </div>

            <div class="toolbar" style="position: absolute; top: 20px; left: 20px; z-index: 100;">
                <button @click="triggerImport" class="import-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cloud-upload" viewBox="0 0 16 16" style="margin-right: 8px;">
                        <path fill-rule="evenodd" d="M4.406 1.342A5.53 5.53 0 0 1 8 0c2.69 0 4.923 2 5.166 4.579C14.758 4.804 16 6.137 16 7.773 16 9.633 14.533 11.1 12.667 11.1h-1.586A4.65 4.65 0 0 1 11 10.5c-.055-.156-.102-.312-.142-.469l-.004-.017A3.9 3.9 0 0 0 8 8.5a3.9 3.9 0 0 0-2.854 1.514l-.004.017c-.04.157-.087.313-.142.469A4.65 4.65 0 0 1 5 11.1H3.333C1.467 11.1 0 9.633 0 7.773c0-1.636 1.242-2.969 2.834-3.193C3.065 2.033 4.284 1.342 4.406 1.342m8.082 3.666a4.54 4.54 0 0 0-1.117-3.066C10.992 1.363 9.63 0 8 0c-2.347 0-4.198 1.603-4.617 3.88-.32.074-.605.168-.85.275A5.27 5.27 0 0 0 0 7.773C0 10.249 2.014 12.26 4.5 12.26h4.306a2.99 2.99 0 0 1 1.294-1.16H4.5a3.77 3.77 0 0 1-3.3-2.228 3.77 3.77 0 0 1 1.218-4.88 3.7 3.7 0 0 1 3.644-.424.75.75 0 0 0 .988-.216 3.54 3.54 0 0 1 5.095-.217.75.75 0 0 0 1.052-.081 3.74 3.74 0 0 1 3.3 2.228 3.77 3.77 0 0 1-1.218 4.88c.35.12.68.28 1.01.48A5.27 5.27 0 0 0 16 7.773c0-2.476-2.014-4.487-4.5-4.487h-.332z"/>
                        <path fill-rule="evenodd" d="M8 11.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5m-2.854-4.354a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L8 12.207l-.646.647a.5.5 0 0 1-.708-.708z"/>
                    </svg>
                    Import Dataset
                </button>
                <input type="file" ref="fileInput" @change="handleFileUpload" accept=".csv, .xlsx, .xls" style="display: none;" />
            </div>

            <!-- Collapsed Sidebar -->
            <div v-if="!isSidebarOpen" 
                 @click="toggleSidebar"
                 class="collapsed-sidebar"
                 style="position: absolute; right: 0; top: 0; width: 32px; height: 100%; background: white; border-left: 1px solid #ddd; z-index: 90; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
                <div style="transform: rotate(-90deg); white-space: nowrap; font-weight: 600; color: #555; letter-spacing: 1px; font-size: 12px;">
                    DATA RELATIONSHIPS
                </div>
            </div>

            <!-- Relationships Sidebar -->
            <div v-if="isSidebarOpen" class="relationships-sidebar" 
                 :style="{ width: sidebarWidth + 'px' }"
                 style="position: absolute; right: 0; top: 0; height: 100%; background: white; border-left: 1px solid #ddd; box-shadow: -2px 0 5px rgba(0,0,0,0.05); z-index: 90; display: flex; flex-direction: column;">
                
                <div class="sidebar-resizer" @mousedown="startResizeSidebar"></div>

                <div style="padding: 15px; border-bottom: 1px solid #eee; background: #f8f9fa; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px; color: #333;">Data Relationships</h3>
                    <button @click="toggleSidebar" class="close-btn" style="width: 24px; height: 24px; font-size: 16px; background: transparent;">&times;</button>
                </div>
                <div style="flex-grow: 1; overflow-y: auto; padding: 15px;">
                    <div v-if="links.length === 0" style="text-align: center; color: #999; font-style: italic; padding-top: 20px;">
                        No relationships created.
                    </div>
                    <div v-for="(link, index) in links" :key="link.id" 
                         @click="highlightLink(link.id)"
                         :style="{ 
                             background: link.id === highlightedLinkId ? '#f0fff4' : '#fff', 
                             border: link.id === highlightedLinkId ? '2px solid #2ecc71' : '1px solid #eee',
                             borderRadius: '6px', 
                             padding: '10px', 
                             marginBottom: '10px', 
                             position: 'relative', 
                             transition: 'all 0.2s',
                             cursor: 'pointer'
                         }">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                            <input 
                                v-model="link.name" 
                                @click.stop 
                                class="connection-name-input" 
                                placeholder="Connection Name"
                            />
                            <button @click.stop="deleteLink(index)" style="background: none; border: none; color: #dc3545; cursor: pointer; padding: 2px;" title="Delete Connection">&times;</button>
                        </div>
                        <div style="font-size: 12px; color: #555; display: flex; align-items: center; gap: 5px;">
                            <span style="font-weight: 500;">{{ getTableName(link.sourceTableId) }}</span>
                            <span style="color: #999;">.</span>
                            <span>{{ link.sourceCol }}</span>
                        </div>
                        <div style="text-align: center; color: #999; font-size: 10px; margin: 2px 0;">↓</div>
                        <div style="font-size: 12px; color: #555; display: flex; align-items: center; gap: 5px;">
                            <span style="font-weight: 500;">{{ getTableName(link.targetTableId) }}</span>
                            <span style="color: #999;">.</span>
                            <span>{{ link.targetCol }}</span>
                        </div>
                    </div>
                </div>
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
                        <h3>{{ previewModal.title }}</h3>
                        <button class="close-btn" @click="closePreview" title="Close">&times;</button>
                    </div>
                    <div class="preview-body">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th v-for="(col, index) in previewModal.columns" :key="index">
                                        <div class="header-input-group">
                                            <div class="header-name-row">
                                                <input 
                                                    :value="col.name" 
                                                    @change="updateColumnName(index, $event.target.value)"
                                                    class="header-input"
                                                    placeholder="Column Name"
                                                />
                                                <button @click="removeColumn(index)" class="btn-icon-danger" title="Remove Column">&times;</button>
                                            </div>
                                            <select v-model="col.type" class="header-type-select">
                                                <option v-for="type in availableTypes" :key="type" :value="type">{{ type }}</option>
                                            </select>
                                        </div>
                                    </th>
                                    <th style="vertical-align: middle; text-align: center; width: 50px; min-width: 50px;">
                                        <button @click="addColumn" class="btn-icon-success" title="Add Column">+</button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, rowIndex) in previewModal.rows" :key="rowIndex">
                                    <td v-for="(col, colIndex) in previewModal.columns" :key="colIndex"
                                        :class="{ 'invalid-cell': !validateCell(row[col.name], col.type) }"
                                        :title="!validateCell(row[col.name], col.type) ? 'Value does not match type ' + col.type : ''">
                                        <input v-model="row[col.name]" class="cell-input" />
                                    </td>
                                    <td class="text-center">
                                        <button @click="removeRow(rowIndex)" class="btn-icon-danger" title="Remove Row">&times;</button>
                                    </td>
                                </tr>
                                <tr v-if="previewModal.rows.length === 0">
                                    <td :colspan="previewModal.columns.length + 1" class="text-center text-muted p-4">
                                        No data available. Click "Add Row" to start.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="add-row-container">
                            <button @click="addRow" class="btn-add-row">+ Add New Row</button>
                        </div>
                    </div>
                    <div class="preview-footer">
                        <div v-if="hasPreviewErrors" class="validation-error">
                            <span style="margin-right: 6px;">⚠️</span>
                            Fix validation errors before applying
                        </div>
                        <button class="btn-secondary-custom" @click="closePreview">Cancel</button>
                        <button class="btn-primary-custom" @click="applyPreviewChanges" :disabled="hasPreviewErrors">Apply Changes</button>
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
                    <i class="bi bi-pencil-square" style="margin-right: 8px;"></i> Edit / Preview Data
                </div>
                <div v-if="contextMenu.type === 'table'" class="context-menu-item" @click="addColumnToTableFromMenu">
                    <i class="bi bi-plus-square" style="margin-right: 8px;"></i> Add Column
                </div>
            </div>

            <svg class="connections-layer">
                <path v-for="link in links" :key="link.id" 
                      :d="calculatePath(link)" 
                      class="connection-line"
                      :style="{ 
                          stroke: link.id === highlightedLinkId ? '#2ecc71' : '#5c6bc0', 
                          strokeWidth: link.id === highlightedLinkId ? '4px' : '2px',
                          zIndex: link.id === highlightedLinkId ? 10 : 1
                      }"
                />
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
                    <div v-for="col in table.columns" :key="col.name" class="table-column" :title="table.data && table.data.length > 0 ? 'Sample: ' + table.data[0][col.name] : 'No data'">
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
    .import-btn {
        background: #ffffff;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        color: #444;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .import-btn:hover {
        background: #f8f9fa;
        border-color: #ccc;
        color: #222;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .import-btn:active {
        background: #f1f1f1;
        box-shadow: none;
        transform: translateY(1px);
    }
    
    /* Modal Styling */
    .preview-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.4);
        backdrop-filter: blur(2px);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .preview-modal {
        background: white;
        width: 85%;
        max-width: 1000px;
        height: 85%;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 50px rgba(0,0,0,0.2);
        border: 1px solid rgba(0,0,0,0.1);
        animation: modalFadeIn 0.2s ease-out;
    }
    @keyframes modalFadeIn {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
    }
    .preview-header {
        padding: 20px 25px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #fff;
        border-radius: 12px 12px 0 0;
    }
    .preview-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #2c3e50;
    }
    .close-btn {
        background: #f8f9fa;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        transition: all 0.2s;
    }
    .close-btn:hover {
        background: #e9ecef;
        color: #dc3545;
    }
    .preview-body {
        padding: 0;
        overflow: auto;
        flex-grow: 1;
        background: #fff;
    }
    
    /* Table Styling */
    .preview-body table {
        margin-bottom: 0;
        border-collapse: separate;
        border-spacing: 0;
        width: 100%;
    }
    .preview-body table th {
        background: #f8f9fa;
        position: sticky;
        top: 0;
        z-index: 10;
        border-bottom: 1px solid #dee2e6;
        padding: 12px 15px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.02);
        min-width: 180px; /* Ensure headers have enough space */
    }
    .preview-body table td {
        padding: 8px 15px;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: middle;
        min-width: 180px; /* Match header width */
    }
    .preview-body table tr:last-child td {
        border-bottom: none;
    }
    .preview-body table tr:hover td {
        background-color: #f8faff;
    }

    /* Input Styling in Table */
    .cell-input {
        width: 100%;
        border: 1px solid transparent;
        background: transparent;
        outline: none;
        font-family: inherit;
        font-size: inherit;
        padding: 4px 8px;
        border-radius: 4px;
        transition: all 0.2s;
    }
    .cell-input:focus {
        background: #fff;
        border-color: #86b7fe;
        box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25);
    }
    
    /* Header Inputs */
    .header-input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
    }
    .header-name-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
    }
    .header-input {
        border: 1px solid transparent;
        background: transparent;
        font-weight: 600;
        font-size: 13px;
        color: #333;
        flex-grow: 1; /* Ensure it takes available space */
        width: 0; /* Allow flex-grow to work properly */
        min-width: 0;
        padding: 2px 4px;
        border-radius: 4px;
    }
    .header-input:hover, .header-input:focus {
        background: #fff;
        border-color: #dee2e6;
    }
    .header-type-select {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 10px;
        border: 1px solid #dee2e6;
        background: #fff;
        color: #666;
        width: 100%;
        cursor: pointer;
        appearance: auto; /* Ensure dropdown arrow is visible */
    }
    
    /* Action Buttons */
    .btn-icon-danger {
        background: none;
        border: none;
        color: #adb5bd;
        cursor: pointer;
        padding: 2px;
        border-radius: 4px;
        font-size: 16px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    }
    .btn-icon-danger:hover {
        color: #dc3545;
        background: rgba(220, 53, 69, 0.1);
    }
    .btn-icon-success {
        background: #198754;
        border: none;
        color: white;
        cursor: pointer;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        font-size: 16px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
        margin: 0 auto;
    }
    .btn-icon-success:hover {
        background: #157347;
        transform: scale(1.1);
    }

    /* Add Row Button */
    .add-row-container {
        padding: 15px;
        text-align: center;
        border-top: 1px solid #f0f0f0;
        background: #fff;
    }
    .btn-add-row {
        width: 100%;
        border: 2px dashed #dee2e6;
        background: transparent;
        color: #6c757d;
        padding: 8px;
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.2s;
        cursor: pointer;
    }
    .btn-add-row:hover {
        border-color: #0d6efd;
        color: #0d6efd;
        background: rgba(13, 110, 253, 0.05);
    }

    /* Footer */
    .preview-footer {
        padding: 15px 25px;
        border-top: 1px solid #f0f0f0;
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 12px;
        background: #fff;
        border-radius: 0 0 12px 12px;
    }
    .validation-error {
        color: #d9534f;
        margin-right: auto;
        display: flex;
        align-items: center;
        font-size: 14px;
        font-weight: 500;
    }
    
    /* Buttons */
    .btn-primary-custom {
        background-color: #0d6efd;
        color: white;
        border: none;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.2s;
        cursor: pointer;
    }
    .btn-primary-custom:hover {
        background-color: #0b5ed7;
        transform: translateY(-1px);
    }
    .btn-primary-custom:disabled {
        background-color: #a0c3ff;
        transform: none;
        cursor: not-allowed;
    }
    .btn-secondary-custom {
        background-color: #fff;
        color: #6c757d;
        border: 1px solid #dee2e6;
        padding: 8px 20px;
        border-radius: 6px;
        font-weight: 500;
        transition: all 0.2s;
        cursor: pointer;
    }
    .btn-secondary-custom:hover {
        background-color: #f8f9fa;
        color: #333;
        border-color: #c6c7c8;
    }

    .invalid-cell {
        background-color: #fff5f5 !important;
        position: relative;
    }
    .invalid-cell input {
        color: #dc3545;
    }
    .invalid-cell::after {
        content: "!";
        position: absolute;
        top: 50%;
        right: 8px;
        transform: translateY(-50%);
        font-size: 12px;
        font-weight: bold;
        color: #dc3545;
        pointer-events: none;
    }

    /* Node Styles */
    .table-node {
        position: absolute;
        width: 280px;
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
        max-height: 600px;
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
        transition: stroke 0.2s, stroke-width 0.2s;
    }
    .connection-name-input {
        border: 1px solid transparent;
        background: transparent;
        font-weight: 600;
        font-size: 13px;
        color: #5c6bc0;
        width: 100%;
        padding: 2px 4px;
        border-radius: 4px;
        outline: none;
        font-family: inherit;
    }
    .connection-name-input:hover, .connection-name-input:focus {
        background: #fff;
        border-color: #dee2e6;
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

    /* Sidebar Resizer */
    .sidebar-resizer {
        position: absolute;
        left: 0;
        top: 0;
        width: 5px;
        height: 100%;
        cursor: col-resize;
        background: transparent;
        z-index: 100;
    }
    .sidebar-resizer:hover {
        background: rgba(0,0,0,0.1);
    }
    
    .collapsed-sidebar:hover {
        background: #f8f9fa !important;
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
