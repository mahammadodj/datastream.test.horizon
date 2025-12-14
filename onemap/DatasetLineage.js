
const { createApp, ref, reactive, onMounted, computed, nextTick } = Vue;

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
            if (highlightedLinkId.value === id) {
                highlightedLinkId.value = null;
            } else {
                highlightedLinkId.value = id;
            }
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

        // Sheet Selection State
        const sheetSelectionModal = reactive({
            isOpen: false,
            sheets: [],
            selectedSheet: '',
            workbook: null,
            fileName: ''
        });

        const closeSheetSelection = () => {
            sheetSelectionModal.isOpen = false;
            sheetSelectionModal.workbook = null;
            sheetSelectionModal.sheets = [];
            sheetSelectionModal.selectedSheet = '';
            sheetSelectionModal.fileName = '';
            isLoading.value = false;
            loadingMessage.value = '';
            if (fileInput.value) fileInput.value.value = '';
        };

        const findHeaderRow = (data) => {
            const limit = Math.min(data.length, 20);
            let maxNonEmpty = -1;
            let bestIndex = 0;

            for (let i = 0; i < limit; i++) {
                const row = data[i];
                if (!Array.isArray(row)) continue;
                
                const nonEmptyCount = row.filter(cell => 
                    cell !== null && 
                    cell !== undefined && 
                    String(cell).trim() !== ''
                ).length;

                if (nonEmptyCount > maxNonEmpty) {
                    maxNonEmpty = nonEmptyCount;
                    bestIndex = i;
                }
            }

            // Heuristic: If the first row has almost as many columns as the best row,
            // and the best row looks like data (mostly numbers) while the first row
            // looks like headers (mostly strings), prefer the first row.
            if (bestIndex > 0 && data[0] && Array.isArray(data[0])) {
                const row0 = data[0];
                const count0 = row0.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
                
                if (count0 >= maxNonEmpty - 1 && count0 > 0) {
                    const rowBest = data[bestIndex];
                    
                    let bestNumbers = 0;
                    let bestStrings = 0;
                    rowBest.forEach(c => {
                        if (c === null || c === undefined) return;
                        if (typeof c === 'number') bestNumbers++;
                        else if (typeof c === 'string' && c.trim() !== '') {
                            if (!isNaN(parseFloat(c)) && isFinite(c)) bestNumbers++;
                            else bestStrings++;
                        }
                    });

                    let row0Numbers = 0;
                    let row0Strings = 0;
                    row0.forEach(c => {
                        if (c === null || c === undefined) return;
                        if (typeof c === 'number') row0Numbers++;
                        else if (typeof c === 'string' && c.trim() !== '') {
                            if (!isNaN(parseFloat(c)) && isFinite(c)) row0Numbers++;
                            else row0Strings++;
                        }
                    });

                    if (bestNumbers > bestStrings && row0Strings >= row0Numbers) {
                        return 0;
                    }
                }
            }

            return bestIndex;
        };

        const inferType = (values) => {
            if (!values || values.length === 0) return 'string';

            let isInt = true;
            let isDecimal = true;
            let isBool = true;
            let isDate = true;
            let hasValidValue = false;

            for (const val of values) {
                if (val === null || val === undefined || String(val).trim() === '') continue;
                hasValidValue = true;
                const strVal = String(val).trim();

                // Boolean check
                const lower = strVal.toLowerCase();
                if (!['true', 'false', 'yes', 'no', '0', '1'].includes(lower)) {
                    isBool = false;
                }

                // Number check
                const num = Number(strVal);
                if (isNaN(num) || strVal === '') {
                    isInt = false;
                    isDecimal = false;
                } else {
                    if (!Number.isInteger(num)) {
                        isInt = false;
                    }
                }

                // Date check
                // If it's a number, assume it's NOT a date for this simple inference
                // If it is a string that parses to date...
                const date = Date.parse(strVal);
                // Exclude plain numbers from being dates
                if (isNaN(date) || !isNaN(num)) { 
                    isDate = false;
                }
            }

            if (!hasValidValue) return 'string';
            if (isBool) return 'boolean';
            if (isInt) return 'int';
            if (isDecimal) return 'decimal';
            if (isDate) return 'datetime';
            return 'string';
        };

        const confirmSheetSelection = () => {
            if (!sheetSelectionModal.selectedSheet) return;
            
            const workbook = sheetSelectionModal.workbook;
            const sheetName = sheetSelectionModal.selectedSheet;
            // Use sheet name as table name if multiple sheets, or append it
            const tableName = sheetSelectionModal.fileName.split('.')[0] + ` - ${sheetName}`; 
            
            try {
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (json && json.length > 0) {
                    const headerRowIndex = findHeaderRow(json);
                    const headerRow = json[headerRowIndex];
                    
                    if (Array.isArray(headerRow)) {
                        const sampleData = json.slice(headerRowIndex + 1, headerRowIndex + 51);
                        
                        const columns = [];
                        headerRow.forEach((h, index) => {
                            if (h !== null && h !== undefined && String(h).trim() !== '') {
                                const colValues = sampleData.map(row => row[index]);
                                columns.push({
                                    name: String(h).trim(),
                                    type: inferType(colValues),
                                    originalIndex: index
                                });
                            }
                        });
                        
                        // Extract preview data (first 20 rows after header)
                        const previewData = json.slice(headerRowIndex + 1, headerRowIndex + 21).map(row => {
                            const rowObj = {};
                            columns.forEach((col) => {
                                rowObj[col.name] = row[col.originalIndex];
                            });
                            return rowObj;
                        });

                        if (columns.length > 0) {
                            addTable(tableName, columns, previewData);
                        } else {
                            alert("No valid headers found in selected sheet.");
                        }
                    } else {
                        alert("Invalid header format in selected sheet.");
                    }
                } else {
                    alert("Selected sheet appears to be empty.");
                }
            } catch (error) {
                console.error("Error processing sheet:", error);
                alert("Error processing sheet: " + error.message);
            } finally {
                closeSheetSelection();
            }
        };

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
                        isLoading.value = false;
                        loadingMessage.value = '';
                        if (fileInput.value) fileInput.value.value = '';
                    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
                        const data = evt.target.result;
                        if (typeof XLSX !== 'undefined') {
                            const workbook = XLSX.read(data, { type: 'array' });
                            
                            if (workbook.SheetNames.length > 1) {
                                // Multiple sheets - ask user
                                sheetSelectionModal.workbook = workbook;
                                sheetSelectionModal.fileName = file.name;
                                sheetSelectionModal.sheets = workbook.SheetNames;
                                sheetSelectionModal.selectedSheet = workbook.SheetNames[0];
                                sheetSelectionModal.isOpen = true;
                                // Don't clear loading state yet, wait for user selection
                            } else {
                                // Single sheet - proceed as before
                                const firstSheetName = workbook.SheetNames[0];
                                const worksheet = workbook.Sheets[firstSheetName];
                                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                                if (json && json.length > 0) {
                                    const headerRowIndex = findHeaderRow(json);
                                    const headerRow = json[headerRowIndex];
                                    
                                    if (Array.isArray(headerRow)) {
                                        const sampleData = json.slice(headerRowIndex + 1, headerRowIndex + 51);
                                        
                                        const columns = [];
                                        headerRow.forEach((h, index) => {
                                            if (h !== null && h !== undefined && String(h).trim() !== '') {
                                                const colValues = sampleData.map(row => row[index]);
                                                columns.push({
                                                    name: String(h).trim(),
                                                    type: inferType(colValues),
                                                    originalIndex: index
                                                });
                                            }
                                        });
                                        
                                        const previewData = json.slice(headerRowIndex + 1, headerRowIndex + 21).map(row => {
                                            const rowObj = {};
                                            columns.forEach((col) => {
                                                rowObj[col.name] = row[col.originalIndex];
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
                                isLoading.value = false;
                                loadingMessage.value = '';
                                if (fileInput.value) fileInput.value.value = '';
                            }
                        } else {
                            alert('XLSX library not loaded.');
                            isLoading.value = false;
                            loadingMessage.value = '';
                            if (fileInput.value) fileInput.value.value = '';
                        }
                    } else {
                        alert('Unsupported file format. Please use CSV or XLSX.');
                        isLoading.value = false;
                        loadingMessage.value = '';
                        if (fileInput.value) fileInput.value.value = '';
                    }
                } catch (error) {
                    console.error("Error processing file:", error);
                    alert("Error processing file: " + error.message);
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
            
            // Parse first 50 rows for type inference
            const sampleLines = lines.slice(1, 51).filter(l => l.trim());
            
            const columns = headers.map((h, index) => {
                const values = sampleLines.map(line => {
                    const vals = line.split(',');
                    return vals[index] ? vals[index].trim() : '';
                });
                return { name: h, type: inferType(values) };
            });
            
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

        const saveQueryAsDataset = () => {
            const name = prompt("Enter name for new dataset:", "Query Result");
            if (!name) return;

            const newTable = addTable(name, JSON.parse(JSON.stringify(previewModal.columns)));
            newTable.data = JSON.parse(JSON.stringify(previewModal.rows));
            
            // Position it in center of view or near others
            newTable.x = 100;
            newTable.y = 100;
            
            notifyChange();
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

        // SQL Query Logic
        const sqlQuery = ref('');
        const isQueryBarOpen = ref(true);
        const queryBarHeight = ref(150);
        const isResizingQueryBar = ref(false);

        const toggleQueryBar = () => {
            isQueryBarOpen.value = !isQueryBarOpen.value;
        };

        const startResizeQueryBar = (event) => {
            isResizingQueryBar.value = true;
            document.addEventListener('mousemove', onResizeQueryBar);
            document.addEventListener('mouseup', stopResizeQueryBar);
        };

        const onResizeQueryBar = (event) => {
            if (!isResizingQueryBar.value) return;
            const newHeight = window.innerHeight - event.clientY;
            if (newHeight > 40 && newHeight < 600) {
                queryBarHeight.value = newHeight;
            }
        };

        const stopResizeQueryBar = () => {
            isResizingQueryBar.value = false;
            document.removeEventListener('mousemove', onResizeQueryBar);
            document.removeEventListener('mouseup', stopResizeQueryBar);
        };
        
        // Query Result State
        const queryResult = reactive({
            columns: [],
            rows: [],
            message: '',
            error: null
        });

        const saveQueryResultAsDataset = () => {
            const name = prompt("Enter name for new dataset:", "Query Result");
            if (!name) return;

            const newTable = addTable(name, queryResult.columns.map(c => ({ name: c, type: 'string' })));
            newTable.data = JSON.parse(JSON.stringify(queryResult.rows));
            
            // Position it in center of view or near others
            newTable.x = 100;
            newTable.y = 100;
            
            notifyChange();
        };

        // Syntax Highlighting
        const backdrop = ref(null);
        const lineNumbersRef = ref(null);

        const lineNumbersHtml = computed(() => {
            const contentLines = sqlQuery.value.split('\n').length;
            // Calculate visible lines based on editor height (minus toolbar 40px) and line height (~21px)
            const visibleLines = Math.max(1, Math.floor((queryBarHeight.value - 40) / 21));
            // Show at least content lines, or enough to fill the view (minimum 20)
            const totalLines = Math.max(contentLines, visibleLines, 20);
            return Array.from({ length: totalLines }, (_, i) => i + 1).join('<br>');
        });
        
        const syncScroll = (event) => {
            if (backdrop.value) {
                backdrop.value.scrollTop = event.target.scrollTop;
                backdrop.value.scrollLeft = event.target.scrollLeft;
            }
            if (lineNumbersRef.value) {
                lineNumbersRef.value.scrollTop = event.target.scrollTop;
            }
        };

        // Autocomplete Logic
        const suggestions = ref([]);
        const showSuggestions = ref(false);
        const activeSuggestionIndex = ref(0);
        const suggestionPosition = reactive({ top: 0, left: 0 });
        const textareaRef = ref(null);

        const sqlKeywords = [
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'DELETE', 'UPDATE', 'CREATE', 'DROP', 'ALTER',
            'TABLE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'AS', 'DISTINCT',
            'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'AND', 'OR', 'NOT', 'IN',
            'IS', 'NULL', 'VALUES', 'INTO', 'SET', 'TOP', 'UNION', 'ALL', 'LIKE', 'BETWEEN', 'EXISTS'
        ];

        const getCaretCoordinates = (element, position) => {
            const div = document.createElement('div');
            const style = window.getComputedStyle(element);
            
            Array.from(style).forEach(prop => {
                div.style.setProperty(prop, style.getPropertyValue(prop), style.getPropertyPriority(prop));
            });
            
            div.style.position = 'absolute';
            div.style.visibility = 'hidden';
            div.style.top = '0px';
            div.style.left = '0px';
            div.style.whiteSpace = 'pre-wrap';
            div.style.height = 'auto';
            div.style.width = element.clientWidth + 'px';
            div.style.overflow = 'hidden'; // Important for wrapping
            
            div.textContent = element.value.substring(0, position);
            
            const span = document.createElement('span');
            span.textContent = '|'; // Marker
            div.appendChild(span);
            
            document.body.appendChild(div);
            
            const coordinates = {
                top: span.offsetTop,
                left: span.offsetLeft
            };
            
            document.body.removeChild(div);
            
            // Adjust for scroll
            coordinates.top -= element.scrollTop;
            coordinates.left -= element.scrollLeft;
            
            return coordinates;
        };

        const updateSuggestions = (event) => {
            const textarea = event.target;
            const cursorIndex = textarea.selectionStart;
            const text = textarea.value;
            
            // Find word being typed
            let start = cursorIndex - 1;
            while (start >= 0 && /[\w\[\]\.]/.test(text[start])) {
                start--;
            }
            start++;
            
            const currentWord = text.substring(start, cursorIndex);
            
            if (!currentWord || currentWord.length < 1) {
                showSuggestions.value = false;
                return;
            }

            // Collect candidates
            let candidates = [...sqlKeywords];
            tables.value.forEach(t => {
                candidates.push(`[${t.name}]`);
                t.columns.forEach(c => candidates.push(c.name));
            });
            
            const lowerWord = currentWord.toLowerCase();
            const matches = candidates.filter(c => c.toLowerCase().startsWith(lowerWord));
            
            if (matches.length > 0) {
                suggestions.value = matches.slice(0, 10);
                showSuggestions.value = true;
                activeSuggestionIndex.value = 0;
                
                const coords = getCaretCoordinates(textarea, cursorIndex);
                // Adjust position relative to the container
                // Since the textarea is inside a relative container, we need to be careful.
                // The coords returned are relative to the textarea's content box (top-left).
                // We'll position the suggestions box absolutely within the query bar container.
                
                suggestionPosition.top = coords.top + 20; // Line height approx
                suggestionPosition.left = coords.left;
            } else {
                showSuggestions.value = false;
            }
        };

        const insertSuggestion = (suggestion) => {
            const textarea = textareaRef.value;
            if (!textarea) return;
            
            const cursorIndex = textarea.selectionStart;
            const text = textarea.value;
            
            let start = cursorIndex - 1;
            while (start >= 0 && /[\w\[\]\.]/.test(text[start])) {
                start--;
            }
            start++;
            
            const before = text.substring(0, start);
            const after = text.substring(cursorIndex);
            
            sqlQuery.value = before + suggestion + after;
            showSuggestions.value = false;
            
            nextTick(() => {
                textarea.focus();
                const newCursorPos = start + suggestion.length;
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                // Trigger highlight update
                updateSuggestions({ target: textarea });
                showSuggestions.value = false; // Hide after insert
            });
        };

        const handleKeyDown = (event) => {
            if (!showSuggestions.value) return;
            
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                activeSuggestionIndex.value = (activeSuggestionIndex.value + 1) % suggestions.value.length;
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                activeSuggestionIndex.value = (activeSuggestionIndex.value - 1 + suggestions.value.length) % suggestions.value.length;
            } else if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                insertSuggestion(suggestions.value[activeSuggestionIndex.value]);
            } else if (event.key === 'Escape') {
                showSuggestions.value = false;
            }
        };

        const highlightedSql = computed(() => {
            if (!sqlQuery.value) return '';
            
            let html = sqlQuery.value
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
                return `<span style="color: #0000ff; font-weight: bold;">${match}</span>`; // Blue
            });
            
            // Strings
            html = html.replace(/'([^']*)'/g, '<span style="color: #a31515;">\'$1\'</span>'); // Red
            
            // Numbers
            html = html.replace(/\b(\d+)\b/g, '<span style="color: #098658;">$1</span>'); // Dark Green
            
            // Comments (Simple -- style)
            html = html.replace(/--.*$/gm, '<span style="color: #008000;">$&</span>'); // Green

            // Handle trailing newline for pre-wrap
            if (html.endsWith('\n')) {
                html += '<br>';
            }
            
            return html;
        });
        
        const isCopied = ref(false);

        const copyQuery = () => {
            if (!sqlQuery.value) return;
            navigator.clipboard.writeText(sqlQuery.value).then(() => {
                isCopied.value = true;
                setTimeout(() => {
                    isCopied.value = false;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        };

        const resetQuery = () => {
            if (confirm('Are you sure you want to clear the editor?')) {
                sqlQuery.value = '';
            }
        };

        const runQuery = () => {
            if (!sqlQuery.value.trim()) return;
            
            try {
                isLoading.value = true;
                loadingMessage.value = 'Running Query...';
                
                // Register tables in Alasql
                tables.value.forEach(table => {
                    if (table.data) {
                         // Use brackets to handle spaces in table names
                         alasql(`CREATE TABLE IF NOT EXISTS [${table.name}]`);
                         alasql(`DELETE FROM [${table.name}]`); 
                         alasql(`INSERT INTO [${table.name}] SELECT * FROM ?`, [table.data]);
                    }
                });

                const result = alasql(sqlQuery.value);
                
                queryResult.error = null;
                queryResult.message = '';
                
                if (Array.isArray(result) && result.length > 0) {
                    queryResult.columns = Object.keys(result[0]);
                    queryResult.rows = result;
                } else if (Array.isArray(result) && result.length === 0) {
                     queryResult.columns = [];
                     queryResult.rows = [];
                     queryResult.message = 'Query executed successfully but returned no results.';
                } else {
                     queryResult.columns = [];
                     queryResult.rows = [];
                     queryResult.message = 'Query executed successfully.';
                }

            } catch (e) {
                queryResult.error = e.message;
                queryResult.columns = [];
                queryResult.rows = [];
            } finally {
                isLoading.value = false;
            }
        };

        const editorWidth = ref(50); // Percentage

        const startResizeEditor = (e) => {
            const startX = e.clientX;
            const startWidth = editorWidth.value;
            const containerWidth = e.target.parentElement.offsetWidth;

            const doDrag = (e) => {
                const deltaX = e.clientX - startX;
                const deltaPercent = (deltaX / containerWidth) * 100;
                let newWidth = startWidth + deltaPercent;
                
                // Constraints
                if (newWidth < 10) newWidth = 10;
                if (newWidth > 90) newWidth = 90;
                
                editorWidth.value = newWidth;
            };

            const stopDrag = () => {
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };

            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
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
            saveQueryAsDataset,
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
            sheetSelectionModal,
            confirmSheetSelection,
            closeSheetSelection,
            sidebarWidth,
            isSidebarOpen,
            toggleSidebar,
            startResizeSidebar,
            sqlQuery,
            runQuery,
            copyQuery,
            resetQuery,
            isCopied,
            isQueryBarOpen,
            queryBarHeight,
            toggleQueryBar,
            startResizeQueryBar,
            saveQueryResultAsDataset,
            queryResult,
            highlightedSql,
            backdrop,
            syncScroll,
            lineNumbersRef,
            lineNumbersHtml,
            suggestions,
            showSuggestions,
            activeSuggestionIndex,
            suggestionPosition,
            textareaRef,
            updateSuggestions,
            insertSuggestion,
            handleKeyDown,
            editorWidth,
            startResizeEditor
        };
    },
    template: `
        <div class="dataset-lineage-container" 
             style="position: relative; width: 100%; height: 100%; overflow: hidden;"
             @contextmenu.prevent="showContextMenu"
             @dragover.prevent="handleDragOver"
             @dragleave.prevent="handleDragLeave"
             @drop.prevent="handleDrop">
            
            <div v-if="isDragOver" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(106, 17, 203, 0.1); z-index: 50; pointer-events: none; display: flex; justify-content: center; align-items: center; border: 4px dashed #6a11cb;">
                <div class="drop-message-box" style="padding: 20px 40px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); font-size: 24px; color: #6a11cb; font-weight: bold;">
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
                 style="position: absolute; right: 0; top: 0; width: 32px; height: 100%; border-left: 1px solid #ddd; z-index: 90; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.2s;">
                <div style="transform: rotate(-90deg); white-space: nowrap; font-weight: 600; color: #555; letter-spacing: 1px; font-size: 12px;">
                    DATA RELATIONSHIPS
                </div>
            </div>

            <!-- Relationships Sidebar -->
            <div v-if="isSidebarOpen" class="relationships-sidebar" 
                 :style="{ width: sidebarWidth + 'px', paddingBottom: isQueryBarOpen ? queryBarHeight + 'px' : '40px' }"
                 style="position: absolute; right: 0; top: 0; height: 100%; border-left: 1px solid #ddd; box-shadow: -2px 0 5px rgba(0,0,0,0.05); z-index: 90; display: flex; flex-direction: column; transition: padding-bottom 0.1s;">
                
                <div class="sidebar-resizer" @mousedown="startResizeSidebar"></div>

                <div class="sidebar-header" style="padding: 15px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
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

            <div v-if="isLoading" class="loading-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 200; display: flex; justify-content: center; align-items: center; flex-direction: column;">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div class="loading-text" style="margin-top: 15px; font-weight: bold; font-size: 16px;">{{ loadingMessage }}</div>
            </div>

            <!-- Preview Modal -->
            <div v-if="previewModal.visible" class="preview-modal-overlay" @click.self="closePreview">
                <div class="preview-modal" :class="{ 'query-result-modal': previewModal.title === 'Query Result' }">
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
                                                    v-if="previewModal.title !== 'Query Result'"
                                                    :value="col.name" 
                                                    @change="updateColumnName(index, $event.target.value)"
                                                    class="header-input"
                                                    placeholder="Column Name"
                                                />
                                                <span v-else class="header-input" style="cursor: default;">{{ col.name }}</span>
                                                <button v-if="previewModal.title !== 'Query Result'" @click="removeColumn(index)" class="btn-icon-danger" title="Remove Column">&times;</button>
                                            </div>
                                            <select v-if="previewModal.title !== 'Query Result'" v-model="col.type" class="header-type-select">
                                                <option v-for="type in availableTypes" :key="type" :value="type">{{ type }}</option>
                                            </select>
                                            <span v-else style="font-size: 11px; color: #666; padding: 2px 6px;">{{ col.type }}</span>
                                        </div>
                                    </th>
                                    <th v-if="previewModal.title !== 'Query Result'" style="vertical-align: middle; text-align: center; width: 50px; min-width: 50px;">
                                        <button @click="addColumn" class="btn-icon-success" title="Add Column">+</button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, rowIndex) in previewModal.rows" :key="rowIndex">
                                    <td v-for="(col, colIndex) in previewModal.columns" :key="colIndex"
                                        :class="{ 'invalid-cell': previewModal.title !== 'Query Result' && !validateCell(row[col.name], col.type) }"
                                        :title="previewModal.title !== 'Query Result' && !validateCell(row[col.name], col.type) ? 'Value does not match type ' + col.type : ''">
                                        <input v-model="row[col.name]" class="cell-input" :readonly="previewModal.title === 'Query Result'" />
                                    </td>
                                    <td v-if="previewModal.title !== 'Query Result'" class="text-center">
                                        <button @click="removeRow(rowIndex)" class="btn-icon-danger" title="Remove Row">&times;</button>
                                    </td>
                                </tr>
                                <tr v-if="previewModal.rows.length === 0">
                                    <td :colspan="previewModal.columns.length + 1" class="text-center text-muted p-4">
                                        No data available. <span v-if="previewModal.title !== 'Query Result'">Click "Add Row" to start.</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div v-if="previewModal.title !== 'Query Result'" class="add-row-container">
                            <button @click="addRow" class="btn-add-row">+ Add New Row</button>
                        </div>
                    </div>
                    <div class="preview-footer">
                        <div v-if="hasPreviewErrors && previewModal.title !== 'Query Result'" class="validation-error">
                            <span style="margin-right: 6px;">⚠️</span>
                            Fix validation errors before applying
                        </div>
                        <button class="btn-secondary-custom" @click="closePreview">Cancel</button>
                        <button v-if="previewModal.title === 'Query Result'" class="btn-primary-custom" @click="saveQueryAsDataset" :disabled="hasPreviewErrors" style="margin-left: 10px;">Save as Dataset</button>
                        <button v-else class="btn-primary-custom" @click="applyPreviewChanges" :disabled="hasPreviewErrors">Apply Changes</button>
                    </div>
                </div>
            </div>

            <!-- Sheet Selection Modal -->
            <div v-if="sheetSelectionModal.isOpen" class="preview-modal-overlay" style="z-index: 10000;">
                <div class="preview-modal" style="width: 400px; max-width: 90%;">
                    <div class="preview-header">
                        <h3>Select Sheet</h3>
                        <button class="close-btn" @click="closeSheetSelection" title="Close">&times;</button>
                    </div>
                    <div class="preview-body" style="padding: 20px;">
                        <p style="margin-bottom: 15px;">The file <strong>{{ sheetSelectionModal.fileName }}</strong> contains multiple sheets. Please select one to import:</p>
                        <select v-model="sheetSelectionModal.selectedSheet" class="form-control" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #ccc;">
                            <option v-for="sheet in sheetSelectionModal.sheets" :key="sheet" :value="sheet">
                                {{ sheet }}
                            </option>
                        </select>
                    </div>
                    <div class="preview-footer">
                        <button class="btn-secondary-custom" @click="closeSheetSelection">Cancel</button>
                        <button class="btn-primary-custom" @click="confirmSheetSelection">Import Sheet</button>
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

            <!-- SQL Query Bar -->
            <div class="sql-query-bar" 
                 :style="{ height: isQueryBarOpen ? queryBarHeight + 'px' : '40px' }"
                 style="position: absolute; bottom: 0; left: 0; width: 100%; z-index: 95; display: flex; flex-direction: column; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); transition: height 0.1s;">
                
                <!-- Resizer -->
                <div v-if="isQueryBarOpen" 
                     @mousedown="startResizeQueryBar"
                     style="position: absolute; top: -5px; left: 0; width: 100%; height: 10px; cursor: ns-resize; z-index: 100; background: transparent;">
                </div>

                <div class="sql-toolbar" style="padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; height: 40px; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <button @click="toggleQueryBar" class="toggle-btn" style="background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center;">
                            <svg v-if="isQueryBarOpen" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                            </svg>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path fill-rule="evenodd" d="M7.646 4.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1-.708.708L8 5.707l-5.646 5.647a.5.5 0 0 1-.708-.708l6-6z"/>
                            </svg>
                        </button>
                        <span class="sql-title" style="font-weight: 600; font-size: 13px;">SQL Query Editor</span>
                        <button @click="resetQuery" class="btn btn-sm btn-light" style="font-size: 12px; padding: 3px 12px; display: flex; align-items: center; gap: 6px; border-radius: 4px; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: 1px solid #ccc; background: white; color: #d32f2f; margin-right: 5px;">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                            Reset
                        </button>
                        <button @click="copyQuery" class="btn btn-sm btn-light" style="font-size: 12px; padding: 3px 12px; display: flex; align-items: center; gap: 6px; border-radius: 4px; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border: 1px solid #ccc; background: white; color: #333; margin-right: 5px;">
                            <svg v-if="!isCopied" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                                <path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/>
                            </svg>
                            <svg v-else xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="color: #2e7d32;">
                                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                            </svg>
                            {{ isCopied ? 'Copied!' : 'Copy' }}
                        </button>
                        <button @click="runQuery" class="btn btn-sm btn-success" style="font-size: 12px; padding: 3px 12px; display: flex; align-items: center; gap: 6px; border-radius: 4px; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/></svg>
                            Run
                        </button>
                    </div>
                    <div>
                        <!-- Right side toolbar items if needed -->
                    </div>
                </div>
                <div v-show="isQueryBarOpen" style="flex-grow: 1; display: flex; height: calc(100% - 40px); overflow: hidden;">
                    <!-- Left Side: Editor -->
                    <div class="sql-editor-wrapper" :style="{ width: editorWidth + '%', display: 'flex', height: '100%', position: 'relative' }">
                        <!-- Line Numbers -->
                        <div class="line-numbers" 
                             ref="lineNumbersRef"
                             style="width: 40px; background: #f0f0f0; border-right: 1px solid #ddd; text-align: right; padding: 10px 5px; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.5; color: #999; overflow: hidden; user-select: none;"
                             v-html="lineNumbersHtml">
                        </div>

                        <div class="sql-editor-container" style="flex-grow: 1; position: relative; height: 100%;">
                            <!-- Backdrop (Highlighter) -->
                            <pre aria-hidden="true" 
                                 class="sql-backdrop"
                                 style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 10px; border: none; box-sizing: border-box; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.5; pointer-events: none; white-space: pre-wrap; overflow: hidden;"
                                 v-html="highlightedSql"
                                 ref="backdrop"
                            ></pre>
                            
                            <!-- Textarea (Input) -->
                            <textarea 
                                ref="textareaRef"
                                v-model="sqlQuery" 
                                @scroll="syncScroll"
                                @input="updateSuggestions"
                                @keydown="handleKeyDown"
                                @blur="setTimeout(() => showSuggestions = false, 200)"
                                class="sql-editor-textarea"
                                placeholder="-- Write your SQL query here...
SELECT * FROM [TableName]" 
                                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; margin: 0; padding: 10px; border: none; box-sizing: border-box; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 14px; line-height: 1.5; outline: none; resize: none;"
                                spellcheck="false"
                            ></textarea>

                            <!-- Suggestions Box -->
                            <div v-if="showSuggestions" 
                                 class="suggestions-box" 
                                 :style="{ top: suggestionPosition.top + 'px', left: suggestionPosition.left + 'px' }">
                                <div v-for="(s, i) in suggestions" :key="s" 
                                     class="suggestion-item"
                                     :class="{ active: i === activeSuggestionIndex }"
                                     @mousedown.prevent="insertSuggestion(s)">
                                     {{ s }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Resize Handle -->
                    <div @mousedown="startResizeEditor" 
                         class="sql-resize-handle"
                         style="width: 5px; cursor: col-resize; z-index: 10; flex-shrink: 0;">
                    </div>

                    <!-- Right Side: Results -->
                    <div class="sql-results-container" :style="{ width: (100 - editorWidth) + '%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }">
                        <!-- Toolbar for results -->
                        <div v-if="queryResult.rows.length > 0" class="sql-results-toolbar" style="padding: 8px 15px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
                             <span class="sql-results-count" style="font-size: 12px; font-weight: 500;">{{ queryResult.rows.length }} rows returned</span>
                             <button @click="saveQueryResultAsDataset" class="btn btn-sm btn-outline-primary" style="font-size: 11px; padding: 2px 10px;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 4px;"><path d="M1 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path fill-rule="evenodd" d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5z"/></svg>
                                Save as Dataset
                             </button>
                        </div>
                        
                        <!-- Table -->
                        <div style="flex-grow: 1; overflow: auto; padding: 0;">
                            <table v-if="queryResult.rows.length > 0" class="table table-sm table-hover sql-results-table" style="margin: 0; font-size: 13px; border-collapse: separate; border-spacing: 0; width: 100%;">
                                <thead style="position: sticky; top: 0; z-index: 5;">
                                    <tr>
                                        <th v-for="col in queryResult.columns" :key="col" 
                                            class="sql-results-th"
                                            style="padding: 8px 12px; font-weight: 600; border-top: none; white-space: nowrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align: left;">
                                            {{ col }}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, i) in queryResult.rows" :key="i" style="transition: background-color 0.1s;">
                                        <td v-for="col in queryResult.columns" :key="col" 
                                            class="sql-results-td"
                                            style="padding: 6px 12px; white-space: nowrap; vertical-align: middle;">
                                            {{ row[col] }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <div v-else-if="queryResult.error" style="padding: 20px; color: #dc3545; font-family: monospace; background: #fff5f5; height: 100%;">
                                <strong>Error:</strong> {{ queryResult.error }}
                            </div>
                            <div v-else-if="queryResult.message" style="padding: 20px; color: #28a745; font-style: italic; background: #f0fff4; height: 100%;">
                                {{ queryResult.message }}
                            </div>
                            <div v-else class="sql-empty-state" style="padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16" style="margin-bottom: 15px; opacity: 0.5;">
                                    <path d="M3 2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V2zm6 11a1 1 0 1 0-2 0 1 1 0 0 0 2 0z"/>
                                </svg>
                                <p style="margin: 0; font-size: 14px;">Run a query to see results here.</p>
                            </div>
                        </div>
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

    /* SQL Editor Styles */
    .sql-editor-textarea {
        color: transparent;
        background: transparent;
        caret-color: black;
    }
    .sql-editor-textarea::placeholder {
        color: #008000;
    }

    /* Suggestions Box */
    .suggestions-box {
        position: absolute;
        background: #ffffff;
        border: 1px solid #e0e0e0;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        z-index: 1000;
        max-height: 200px;
        overflow-y: auto;
        min-width: 150px;
        border-radius: 4px;
    }
    .suggestion-item {
        padding: 4px 8px;
        cursor: pointer;
        color: #333333;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 13px;
    }
    .suggestion-item:hover, .suggestion-item.active {
        background-color: #094771;
        color: white;
    }
    .query-result-modal {
        border: 2px solid #569cd6;
    }
    .query-result-modal .preview-header {
        background: linear-gradient(to right, #f8f9fa, #e3f2fd);
    }

    /* SQL Query Bar & Results Theme Support */
    .sql-query-bar {
        background: white;
        border-top: 1px solid #ddd;
    }
    .sql-toolbar {
        background: #f8f9fa;
        border-bottom: 1px solid #eee;
    }
    .sql-title {
        color: #555;
    }
    .toggle-btn {
        color: #555;
    }
    .sql-editor-container {
        background-color: #ffffff;
        border-right: 1px solid #ddd;
    }
    .sql-backdrop {
        background-color: #ffffff;
        color: #333333;
    }
    .sql-resize-handle {
        background-color: #f0f0f0;
        border-left: 1px solid #ddd;
        border-right: 1px solid #ddd;
    }
    .sql-results-container {
        background-color: #fff;
    }
    .sql-results-toolbar {
        background: #fff;
        border-bottom: 1px solid #eee;
    }
    .sql-results-count {
        color: #666;
    }
    .sql-results-table {
        background: white;
        color: #333;
    }
    .sql-results-th {
        background: #f8f9fa;
        color: #495057;
        border-bottom: 1px solid #dee2e6;
    }
    .sql-results-td {
        border-bottom: 1px solid #f1f1f1;
        color: #333;
    }
    .sql-empty-state {
        color: #adb5bd;
    }

    /* Dark Theme Overrides */
    body.dark-theme .sql-query-bar {
        background: #1e1e1e;
        border-top: 1px solid #333;
    }
    body.dark-theme .sql-toolbar {
        background: #252526;
        border-bottom: 1px solid #333;
    }
    body.dark-theme .sql-title {
        color: #ccc;
    }
    body.dark-theme .toggle-btn {
        color: #ccc;
    }
    body.dark-theme .sql-editor-container {
        background-color: #1e1e1e;
        border-right: 1px solid #333;
    }
    body.dark-theme .sql-backdrop {
        background-color: #1e1e1e;
        color: #d4d4d4;
    }
    body.dark-theme .sql-editor-textarea {
        caret-color: white;
    }
    body.dark-theme .sql-resize-handle {
        background-color: #333;
        border-left: 1px solid #444;
        border-right: 1px solid #444;
    }
    body.dark-theme .sql-results-container {
        background-color: #1e1e1e;
    }
    body.dark-theme .sql-results-toolbar {
        background: #252526;
        border-bottom: 1px solid #333;
    }
    body.dark-theme .sql-results-count {
        color: #aaa;
    }
    body.dark-theme .sql-results-table {
        background: #1e1e1e;
        color: #d4d4d4;
    }
    body.dark-theme .sql-results-th {
        background: #2d2d2d;
        color: #e0e0e0;
        border-bottom: 1px solid #444;
    }
    body.dark-theme .sql-results-td {
        border-bottom: 1px solid #333;
        color: #d4d4d4;
    }
    body.dark-theme .sql-empty-state {
        color: #666;
    }
    
    /* Suggestions Box Dark Theme */
    body.dark-theme .suggestions-box {
        background: #252526;
        border: 1px solid #444;
        color: #d4d4d4;
    }
    body.dark-theme .suggestion-item {
        color: #d4d4d4;
    }
    body.dark-theme .suggestion-item:hover, body.dark-theme .suggestion-item.active {
        background-color: #094771;
        color: white;
    }

    /* Default Styles for elements with removed inline styles */
    .dataset-lineage-container {
        background-color: #f4f4f4;
    }
    .relationships-sidebar, .collapsed-sidebar {
        background: white;
    }
    .sidebar-header {
        background: #f8f9fa;
    }

    /* Comprehensive Dark Theme Overrides */
    body.dark-theme .dataset-lineage-container {
        background-color: #1e1e1e;
    }
    body.dark-theme .relationships-sidebar, 
    body.dark-theme .collapsed-sidebar {
        background: #252526;
        border-left: 1px solid #333 !important;
    }
    body.dark-theme .sidebar-header {
        background: #2d2d2d;
        border-bottom: 1px solid #333 !important;
    }
    body.dark-theme .sidebar-header h3 {
        color: #e0e0e0 !important;
    }
    body.dark-theme .close-btn {
        color: #e0e0e0;
    }
    body.dark-theme .table-node {
        background: #252526;
        border-color: #444;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    body.dark-theme .table-header {
        background: linear-gradient(to bottom, #333, #2d2d2d);
        border-bottom: 1px solid #444;
        color: #e0e0e0;
    }
    body.dark-theme .table-title {
        color: #e0e0e0;
    }
    body.dark-theme .table-column {
        color: #d4d4d4;
        border-bottom: 1px solid #333;
    }
    body.dark-theme .table-column:hover {
        background-color: #2a2d2e;
    }
    body.dark-theme .col-type-select {
        background: #333;
        border: 1px solid #555;
        color: #d4d4d4;
    }
    body.dark-theme .col-type-select:hover {
        background: #444;
    }
    body.dark-theme .line-numbers {
        background: #252526 !important;
        border-right: 1px solid #333 !important;
        color: #858585 !important;
    }
    body.dark-theme .context-menu {
        background: #252526;
        border: 1px solid #444;
        color: #d4d4d4;
    }
    body.dark-theme .context-menu-item {
        color: #d4d4d4;
    }
    body.dark-theme .context-menu-item:hover {
        background-color: #094771;
        color: white;
    }
    body.dark-theme .connection-name-input {
        color: #a5b3ff;
    }
    body.dark-theme .connection-name-input:hover, 
    body.dark-theme .connection-name-input:focus {
        background: #333;
        border-color: #555;
    }
    body.dark-theme .import-btn {
        background: #252526;
        border-color: #444;
        color: #e0e0e0;
    }
    body.dark-theme .import-btn:hover {
        background: #333;
        border-color: #555;
        color: white;
    }

    /* Modal Dark Theme */
    body.dark-theme .preview-modal {
        background: #1e1e1e;
        border-color: #444;
    }
    body.dark-theme .preview-header {
        background: #252526;
        border-bottom: 1px solid #333;
    }
    body.dark-theme .preview-header h3 {
        color: #e0e0e0;
    }
    body.dark-theme .preview-body {
        background: #1e1e1e;
    }
    body.dark-theme .close-btn {
        background: #333;
        color: #e0e0e0;
    }
    body.dark-theme .close-btn:hover {
        background: #444;
    }
    body.dark-theme .preview-body table th {
        background: #2d2d2d;
        border-bottom: 1px solid #444;
    }
    body.dark-theme .preview-body table td {
        border-bottom: 1px solid #333;
        color: #d4d4d4;
    }
    body.dark-theme .preview-body table tr:hover td {
        background-color: #2a2d2e;
    }
    body.dark-theme .cell-input {
        color: #d4d4d4;
    }
    body.dark-theme .cell-input:focus {
        background: #333;
        border-color: #555;
    }
    body.dark-theme .header-input {
        color: #e0e0e0;
    }
    body.dark-theme .header-input:hover, 
    body.dark-theme .header-input:focus {
        background: #333;
        border-color: #555;
    }
    body.dark-theme .header-type-select {
        background: #333;
        border-color: #555;
        color: #d4d4d4;
    }
    body.dark-theme .preview-footer {
        background: #252526;
        border-top: 1px solid #333;
    }
    body.dark-theme .btn-secondary-custom {
        background: #333;
        border-color: #555;
        color: #e0e0e0;
    }
    body.dark-theme .btn-secondary-custom:hover {
        background: #444;
    }
    body.dark-theme .add-row-container {
        background: #1e1e1e;
        border-top: 1px solid #333;
    }
    body.dark-theme .btn-add-row {
        border-color: #444;
        color: #aaa;
    }
    body.dark-theme .btn-add-row:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
    }

    /* Drop Message & Loading Overlay Dark Theme */
    .drop-message-box {
        background: white;
    }
    body.dark-theme .drop-message-box {
        background: #252526;
        color: #a5b3ff !important;
    }
    .loading-overlay {
        background: rgba(255,255,255,0.8);
    }
    .loading-text {
        color: #555;
    }
    body.dark-theme .loading-overlay {
        background: rgba(30, 30, 30, 0.8);
    }
    body.dark-theme .loading-text {
        color: #e0e0e0;
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
