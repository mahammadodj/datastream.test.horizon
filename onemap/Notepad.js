document.addEventListener('DOMContentLoaded', function() {
    const pagesContainer = document.getElementById('notepad-pages-container');
    const saveBtn = document.getElementById('save-notes-btn');
    const statusSpan = document.getElementById('notepad-status');
    const titleInput = document.getElementById('np-title-input');
    const noteList = document.getElementById('notepad-list');
    const newNoteBtn = document.getElementById('np-new-note');
    const insertPageBtn = document.getElementById('np-insert-page');
    
    if (!pagesContainer || !saveBtn) return;

    // State
    let notes = [];
    let currentNoteId = null;
    let currentFontSize = parseInt(localStorage.getItem('onemap_notepad_fontsize')) || 14;

    // --- Initialization ---

    function init() {
        // Prevent writing in the container itself
        pagesContainer.contentEditable = false;

        // Handle clicks on the background to focus the page
        pagesContainer.addEventListener('click', (e) => {
            if (e.target === pagesContainer) {
                const pages = pagesContainer.querySelectorAll('.notepad-page');
                if (pages.length > 0) {
                    // Focus the last page
                    const lastPage = pages[pages.length - 1];
                    lastPage.focus();
                    
                    // Move cursor to end
                    const range = document.createRange();
                    range.selectNodeContents(lastPage);
                    range.collapse(false);
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
            }
        });

        // Check for migration
        const oldNotes = localStorage.getItem('onemap_user_notes_html');
        const storedData = localStorage.getItem('onemap_user_notes_data');

        if (storedData) {
            notes = JSON.parse(storedData);
        } else if (oldNotes) {
            // Migrate old single note
            notes = [{
                id: Date.now(),
                title: 'My Notes',
                content: `<div class="notepad-page" contenteditable="true" data-page="1">${oldNotes}</div>`,
                date: new Date().toISOString()
            }];
            localStorage.removeItem('onemap_user_notes_html');
            saveNotesToStorage();
        } else {
            // Default new note
            createNoteObject('My First Note', '<div class="notepad-page" contenteditable="true" data-page="1"></div>');
        }

        // Select first note
        if (notes.length > 0) {
            loadNote(notes[0].id);
        }

        renderNoteList();
        updateFontSizeDisplay();
        
        // Restore line height if saved (global setting for now)
        const savedLineHeight = localStorage.getItem('onemap_notepad_lineheight') || '1.5';
        const lhSelect = document.getElementById('np-line-height');
        if (lhSelect) {
            lhSelect.value = savedLineHeight;
            updateLineHeight(savedLineHeight);
        }
    }

    // --- Core Functions ---

    function cleanOrphanNodes() {
        // Moves any text/elements outside of .notepad-page into the last page
        const nodes = Array.from(pagesContainer.childNodes);
        let hasChanges = false;
        
        nodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                if (node.textContent.trim() !== '') {
                    // Found orphan text
                    const pages = pagesContainer.querySelectorAll('.notepad-page');
                    if (pages.length > 0) {
                        const lastPage = pages[pages.length - 1];
                        // Append text to last page
                        lastPage.insertAdjacentText('beforeend', node.textContent);
                    }
                    node.remove();
                    hasChanges = true;
                } else {
                    // Remove whitespace
                    node.remove();
                }
            } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('notepad-page')) {
                // Orphan element
                const pages = pagesContainer.querySelectorAll('.notepad-page');
                if (pages.length > 0) {
                    const lastPage = pages[pages.length - 1];
                    lastPage.appendChild(node);
                }
                else {
                    // Should not happen if init works, but just in case
                    const newPage = document.createElement('div');
                    newPage.className = 'notepad-page';
                    newPage.contentEditable = true;
                    newPage.dataset.page = 1;
                    newPage.appendChild(node);
                    pagesContainer.appendChild(newPage);
                }
                // Don't remove node here because appendChild moves it
                hasChanges = true;
            }
        });
        
        if (hasChanges) attachPageListeners();
    }

    function createNoteObject(title, content) {
        const newNote = {
            id: Date.now(),
            title: title,
            content: content,
            date: new Date().toISOString()
        };
        notes.unshift(newNote); // Add to top
        saveNotesToStorage();
        return newNote;
    }

    function saveNotesToStorage() {
        localStorage.setItem('onemap_user_notes_data', JSON.stringify(notes));
    }

    function renderNoteList() {
        if (!noteList) return;
        noteList.innerHTML = '';

        notes.forEach(note => {
            const item = document.createElement('div');
            item.className = `notepad-list-item ${note.id === currentNoteId ? 'active' : ''}`;
            item.dataset.id = note.id;
            
            const titleSpan = document.createElement('span');
            titleSpan.className = 'notepad-list-item-title';
            titleSpan.textContent = note.title || 'Untitled Page';
            
            const deleteBtn = document.createElement('i');
            deleteBtn.className = 'material-icons notepad-list-item-delete';
            deleteBtn.style.fontSize = '16px';
            deleteBtn.textContent = 'close';
            deleteBtn.title = 'Delete Page';
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteNote(note.id);
            });

            item.appendChild(titleSpan);
            item.appendChild(deleteBtn);
            
            item.addEventListener('click', () => {
                if (currentNoteId !== note.id) {
                    saveCurrentNote(); // Save previous before switching
                    loadNote(note.id);
                }
            });

            noteList.appendChild(item);
        });
    }

    function loadNote(id) {
        const note = notes.find(n => n.id === id);
        if (!note) return;

        currentNoteId = id;
        // Ensure content has at least one page
        if (!note.content || !note.content.includes('notepad-page')) {
            pagesContainer.innerHTML = `<div class="notepad-page" contenteditable="true" data-page="1">${note.content || ''}</div>`;
        } else {
            pagesContainer.innerHTML = note.content;
        }
        
        cleanOrphanNodes(); // Clean up any mess

        if (titleInput) titleInput.value = note.title;
        
        // Re-attach listeners to new pages
        attachPageListeners();
        
        renderNoteList(); // To update active state
    }

    function saveCurrentNote() {
        if (!currentNoteId) return;
        
        cleanOrphanNodes(); // Ensure clean before saving

        const noteIndex = notes.findIndex(n => n.id === currentNoteId);
        if (noteIndex !== -1) {
            notes[noteIndex].content = pagesContainer.innerHTML;
            notes[noteIndex].title = titleInput ? titleInput.value : notes[noteIndex].title;
            notes[noteIndex].date = new Date().toISOString();
            
            // Move to top of list
            const note = notes.splice(noteIndex, 1)[0];
            notes.unshift(note);
            
            saveNotesToStorage();
            renderNoteList();
        }
    }

    function deleteNote(id) {
        if (!confirm('Are you sure you want to delete this page?')) return;
        
        const index = notes.findIndex(n => n.id === id);
        if (index !== -1) {
            notes.splice(index, 1);
            saveNotesToStorage();
            
            if (notes.length === 0) {
                createNoteObject('Untitled Page', '<div class="notepad-page" contenteditable="true" data-page="1"></div>');
                loadNote(notes[0].id);
            } else if (id === currentNoteId) {
                loadNote(notes[0].id);
            } else {
                renderNoteList();
            }
        }
    }

    function attachPageListeners() {
        const pages = pagesContainer.querySelectorAll('.notepad-page');
        pages.forEach(page => {
            // Ensure contenteditable is true (sometimes lost in innerHTML)
            page.contentEditable = true;
            
            // Simple pagination check on input
            page.addEventListener('input', function() {
                checkPageOverflow(this);
            });
        });
    }

    function checkPageOverflow(page) {
        // A4 height approx 1056px (11in * 96dpi) - padding (100px) = ~950px content
        // But we set min-height: 1056px.
        // If scrollHeight > clientHeight, it's overflowing.
        if (page.scrollHeight > page.clientHeight) {
            // Create new page if not exists next
            let nextPage = page.nextElementSibling;
            if (!nextPage || !nextPage.classList.contains('notepad-page')) {
                nextPage = document.createElement('div');
                nextPage.className = 'notepad-page';
                nextPage.contentEditable = true;
                nextPage.dataset.page = parseInt(page.dataset.page) + 1;
                page.parentNode.insertBefore(nextPage, page.nextSibling);
                attachPageListeners(); // Re-attach for new page
            }
            
            // Move focus to new page (simple approach)
            // Ideally we move the last word, but that's complex.
            // For now, just let the user know they are on a new page by focusing it?
            // No, that interrupts typing.
            // Let's just ensure the new page exists so they can click into it.
        }
    }

    function insertNewPage() {
        const pages = pagesContainer.querySelectorAll('.notepad-page');
        const lastPage = pages[pages.length - 1];
        const newPage = document.createElement('div');
        newPage.className = 'notepad-page';
        newPage.contentEditable = true;
        newPage.dataset.page = pages.length + 1;
        pagesContainer.appendChild(newPage);
        attachPageListeners();
        newPage.focus();
        // Scroll to new page
        newPage.scrollIntoView({ behavior: 'smooth' });
    }

    if (insertPageBtn) {
        insertPageBtn.addEventListener('click', insertNewPage);
    }

    // --- Event Listeners ---

    if (newNoteBtn) {
        newNoteBtn.addEventListener('click', () => {
            saveCurrentNote();
            const newNote = createNoteObject('Untitled Page', '<div class="notepad-page" contenteditable="true" data-page="1"></div>');
            loadNote(newNote.id);
        });
    }

    if (titleInput) {
        titleInput.addEventListener('input', () => {
            // Update title in list in real-time (optional, or just on save)
            const note = notes.find(n => n.id === currentNoteId);
            if (note) {
                note.title = titleInput.value;
                renderNoteList(); // Re-render to show new title
            }
        });
        
        // Save on blur
        titleInput.addEventListener('blur', saveNotesToStorage);
    }

    saveBtn.addEventListener('click', () => {
        saveCurrentNote();
        
        // Visual feedback
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="material-icons" style="font-size: 16px; margin-right: 5px;">check</i> Saved!';
        saveBtn.classList.remove('btn-primary');
        saveBtn.classList.add('btn-success');
        
        statusSpan.textContent = 'Last saved: ' + new Date().toLocaleTimeString();
        
        setTimeout(() => {
            saveBtn.innerHTML = originalHTML;
            saveBtn.classList.remove('btn-success');
            saveBtn.classList.add('btn-primary');
        }, 2000);
    });

    // Auto-save
    setInterval(() => {
        if (currentNoteId) {
            const note = notes.find(n => n.id === currentNoteId);
            if (note && (note.content !== pagesContainer.innerHTML || note.title !== titleInput.value)) {
                saveCurrentNote();
                statusSpan.textContent = 'Auto-saved: ' + new Date().toLocaleTimeString();
            }
        }
    }, 30000);


    // --- Toolbar Actions ---

    function format(command, value = null) {
        document.execCommand(command, false, value);
        // Focus the active page or the last one
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            let node = selection.anchorNode;
            while (node && !node.classList?.contains('notepad-page')) {
                node = node.parentNode;
            }
            if (node) node.focus();
        }
    }

    // Clear
    document.getElementById('np-clear')?.addEventListener('click', () => {
        if (confirm('Clear content of this page?')) {
            // Reset to one empty page
            pagesContainer.innerHTML = '<div class="notepad-page" contenteditable="true" data-page="1"></div>';
            attachPageListeners();
            pagesContainer.querySelector('.notepad-page').focus();
        }
    });

    // Copy
    document.getElementById('np-copy')?.addEventListener('click', () => {
        // Select all content across pages? Or just active?
        // Let's select all text in container
        const range = document.createRange();
        range.selectNodeContents(pagesContainer);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('copy');
        selection.removeAllRanges();
        
        const btn = document.getElementById('np-copy');
        const originalColor = btn.style.color;
        btn.style.color = '#28a745';
        setTimeout(() => btn.style.color = originalColor, 1000);
    });

    // Download Menu
    const dlMenuBtn = document.getElementById('np-download-menu-btn');
    const dlMenu = document.getElementById('np-download-menu');
    if (dlMenuBtn && dlMenu) {
        dlMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dlMenu.style.display = dlMenu.style.display === 'block' ? 'none' : 'block';
        });
        document.addEventListener('click', () => dlMenu.style.display = 'none');
    }

    function downloadFile(content, type, extension) {
        const title = titleInput ? titleInput.value.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'note';
        const blob = new Blob([content], { type: type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `onemap_${title}_${new Date().toISOString().slice(0,10)}${extension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    document.getElementById('np-download-html')?.addEventListener('click', () => {
        // Strip page divs for clean HTML export? Or keep them?
        // Keeping them preserves layout.
        const content = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titleInput.value}</title><style>body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; padding: 20px; } .notepad-page { background: white; padding: 50px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); max-width: 800px; margin: 0 auto; }</style></head><body>${pagesContainer.innerHTML}</body></html>`;
        downloadFile(content, 'text/html', '.html');
    });

    document.getElementById('np-download-txt')?.addEventListener('click', () => {
        downloadFile(pagesContainer.innerText, 'text/plain', '.txt');
    });

    document.getElementById('np-download-doc')?.addEventListener('click', () => {
         const content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset="utf-8"><title>${titleInput.value}</title><style>body { font-family: 'Segoe UI', sans-serif; }</style></head><body>${pagesContainer.innerHTML}</body></html>`;
        downloadFile(content, 'application/msword', '.doc');
    });

    // Print
    document.getElementById('np-print')?.addEventListener('click', () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>${titleInput.value}</title><style>
            body { font-family: 'Segoe UI', sans-serif; background: white; }
            .notepad-page { page-break-after: always; padding: 40px; margin-bottom: 20px; }
            @media print { 
                body { background: none; }
                .notepad-page { box-shadow: none; border: none; margin: 0; padding: 0; }
            }
        </style></head><body>${pagesContainer.innerHTML}<script>window.onload = function() { window.print(); window.close(); }<\/script></body></html>`);
        printWindow.document.close();
    });

    // Formatting
    document.getElementById('np-bold')?.addEventListener('click', () => format('bold'));
    document.getElementById('np-italic')?.addEventListener('click', () => format('italic'));
    document.getElementById('np-underline')?.addEventListener('click', () => format('underline'));
    
    document.getElementById('np-align-left')?.addEventListener('click', () => format('justifyLeft'));
    document.getElementById('np-align-center')?.addEventListener('click', () => format('justifyCenter'));
    document.getElementById('np-align-right')?.addEventListener('click', () => format('justifyRight'));

    // Lists
    document.getElementById('np-list-ul')?.addEventListener('click', () => format('insertUnorderedList'));
    document.getElementById('np-list-ol')?.addEventListener('click', () => format('insertOrderedList'));

    // Font Family
    document.getElementById('np-font-family')?.addEventListener('change', function() {
        format('fontName', this.value);
    });

    // Colors
    document.getElementById('np-color')?.addEventListener('input', function() {
        format('foreColor', this.value);
    });
    
    document.getElementById('np-highlight')?.addEventListener('input', function() {
        format('hiliteColor', this.value);
    });

    // Line Height
    function updateLineHeight(val) {
        const pages = pagesContainer.querySelectorAll('.notepad-page');
        pages.forEach(p => p.style.lineHeight = val);
        localStorage.setItem('onemap_notepad_lineheight', val);
    }

    document.getElementById('np-line-height')?.addEventListener('change', function() {
        updateLineHeight(this.value);
    });

    // Timestamp
    document.getElementById('np-time')?.addEventListener('click', () => {
        format('insertText', new Date().toLocaleString());
    });

    // Font Size
    function updateFontSizeDisplay() {
        const pages = pagesContainer.querySelectorAll('.notepad-page');
        pages.forEach(p => p.style.fontSize = currentFontSize + 'px');
        
        const display = document.getElementById('np-font-size-display');
        if (display) display.textContent = currentFontSize + 'px';
        localStorage.setItem('onemap_notepad_fontsize', currentFontSize);
    }

    document.getElementById('np-font-dec')?.addEventListener('click', () => {
        if (currentFontSize > 8) {
            currentFontSize -= 2;
            updateFontSizeDisplay();
        }
    });

    document.getElementById('np-font-inc')?.addEventListener('click', () => {
        if (currentFontSize < 32) {
            currentFontSize += 2;
            updateFontSizeDisplay();
        }
    });

    // Initialize
    init();
});
