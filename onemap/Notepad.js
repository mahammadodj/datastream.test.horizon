document.addEventListener('DOMContentLoaded', function() {
    const textarea = document.getElementById('notepad-textarea');
    const saveBtn = document.getElementById('save-notes-btn');
    const statusSpan = document.getElementById('notepad-status');
    
    if (!textarea || !saveBtn) return;

    // Load saved notes
    const savedNotes = localStorage.getItem('onemap_user_notes');
    if (savedNotes) {
      textarea.value = savedNotes;
    }
    
    // Save notes function
    function saveNotes() {
      localStorage.setItem('onemap_user_notes', textarea.value);
      
      // Visual feedback
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      saveBtn.classList.remove('btn-primary');
      saveBtn.classList.add('btn-success');
      
      statusSpan.textContent = 'Last saved: ' + new Date().toLocaleTimeString();
      
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-primary');
      }, 2000);
    }
    
    saveBtn.addEventListener('click', saveNotes);
    
    // Auto-save every 30 seconds if changed
    setInterval(() => {
        const currentNotes = textarea.value;
        const storedNotes = localStorage.getItem('onemap_user_notes') || '';
        
        if (currentNotes !== storedNotes) {
            localStorage.setItem('onemap_user_notes', currentNotes);
            statusSpan.textContent = 'Auto-saved: ' + new Date().toLocaleTimeString();
        }
    }, 30000);

    // Handle Dark Mode
    function updateNotepadTheme() {
        const isDark = document.body.classList.contains('dark-theme');
        const title = document.querySelector('#notepad-content h3');
        
        if (isDark) {
            textarea.style.backgroundColor = '#2d2d2d';
            textarea.style.color = '#e0e0e0';
            textarea.style.borderColor = '#444';
            if (title) title.style.color = '#e0e0e0';
        } else {
            textarea.style.backgroundColor = '#fff';
            textarea.style.color = '#333';
            textarea.style.borderColor = '#ccc';
            if (title) title.style.color = '#333';
        }
    }

    // Initial check
    updateNotepadTheme();

    // Observer for theme changes
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === "class") {
                updateNotepadTheme();
            }
        });
    });

    observer.observe(document.body, {
        attributes: true
    });
});
