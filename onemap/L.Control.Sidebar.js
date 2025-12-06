L.Control.Sidebar = L.Control.extend({

    includes: L.Evented.prototype || L.Mixin.Events,

    options: {
        closeButton: true,
        position: 'left',
        autoPan: true,
        tabText: 'Filters', // Default tab text
        minWidth: 250,      // NEW: Minimum width constraint
        maxWidth: 600       // NEW: Maximum width constraint
    },

    initialize: function (placeholder, options) {
        L.setOptions(this, options);

        // Find content container
        var content = this._contentContainer = L.DomUtil.get(placeholder);

        // Remove the content container from its original parent        
        if(content.parentNode != undefined){
          content.parentNode.removeChild(content);
        }
        var l = 'leaflet-';

        // Create sidebar container
        var container = this._container =
            L.DomUtil.create('div', l + 'sidebar ' + this.options.position);

        // Style and attach content container
        L.DomUtil.addClass(content, l + 'control');
        container.appendChild(content);

        // Create close button and attach it if configured
        if (this.options.closeButton) {
            var close = this._closeButton =
                L.DomUtil.create('a', 'close', container);
            close.innerHTML = '&times;';
        }

        // NEW: Create tab (collapsed state handle)
        var tab = this._tab = L.DomUtil.create('div', 'sidebar-tab', container);
        
        // Icons: Hamburger with Right Arrow (Collapsed) and Left Arrow (Expanded)
        var iconCollapsed = `
        <svg class="sidebar-tab-icon icon-collapsed" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
            <polyline points="14 15 17 12 14 9"></polyline>
        </svg>`;
        
        var iconExpanded = `
        <svg class="sidebar-tab-icon icon-expanded" viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
            <polyline points="10 15 7 12 10 9"></polyline>
        </svg>`;

        tab.innerHTML = iconCollapsed + iconExpanded + '<span class="sidebar-tab-text">' + this.options.tabText + '</span>';
        tab.title = "Toggle Sidebar";

        // NEW: Create resize handle
        this._resizeHandle = L.DomUtil.create('div', 'sidebar-resize-handle', container);
    },

    addTo: function (map) {
        var container = this._container;
        var content = this._contentContainer;

        // Attach event to close button
        if (this.options.closeButton) {
            var close = this._closeButton;

            L.DomEvent.on(close, 'click', this.hide, this);
        }

        // Attach event to tab
        L.DomEvent.on(this._tab, 'click', this.toggle, this);

        // Attach resize events
        L.DomEvent.on(this._resizeHandle, 'mousedown', this._onResizeStart, this);
        L.DomEvent.on(this._resizeHandle, 'touchstart', this._onResizeStart, this);

        L.DomEvent
            .on(container, 'transitionend',
                this._handleTransitionEvent, this)
            .on(container, 'webkitTransitionEnd',
                this._handleTransitionEvent, this);

        // Attach sidebar container to controls container
        var controlContainer = map._controlContainer;
        controlContainer.insertBefore(container, controlContainer.firstChild);

        this._map = map;

        // Make sure we don't drag the map when we interact with the content
        var stop = L.DomEvent.stopPropagation;
        var fakeStop = L.DomEvent._fakeStop || stop;
        L.DomEvent
            .on(content, 'contextmenu', stop)
            .on(content, 'click', fakeStop)
            .on(content, 'mousedown', stop)
            .on(content, 'touchstart', stop)
            .on(content, 'dblclick', fakeStop)
            .on(content, 'mousewheel', stop)
            .on(content, 'wheel', stop)
            .on(content, 'scroll', stop)
            .on(content, 'MozMousePixelScroll', stop);
        
        // Also prevent map interaction on the tab
        L.DomEvent.disableClickPropagation(this._tab);
        L.DomEvent.disableScrollPropagation(this._tab);

        return this;
    },

    removeFrom: function (map) {
        //if the control is visible, hide it before removing it.
        this.hide();

        var container = this._container;
        var content = this._contentContainer;

        // Remove sidebar container from controls container
        var controlContainer = map._controlContainer;
        controlContainer.removeChild(container);

        //disassociate the map object
        this._map = null;

        // Unregister events to prevent memory leak
        var stop = L.DomEvent.stopPropagation;
        var fakeStop = L.DomEvent._fakeStop || stop;
        L.DomEvent
            .off(content, 'contextmenu', stop)
            .off(content, 'click', fakeStop)
            .off(content, 'mousedown', stop)
            .off(content, 'touchstart', stop)
            .off(content, 'dblclick', fakeStop)
            .off(content, 'mousewheel', stop)
            .off(content, 'wheel', stop)
            .off(content, 'scroll', stop)
            .off(content, 'MozMousePixelScroll', stop);

        L.DomEvent
            .off(container, 'transitionend',
                this._handleTransitionEvent, this)
            .off(container, 'webkitTransitionEnd',
                this._handleTransitionEvent, this);

        if (this._closeButton && this._close) {
            var close = this._closeButton;

            L.DomEvent.off(close, 'click', this.hide, this);
        }

        if (this._tab) {
            L.DomEvent.off(this._tab, 'click', this.toggle, this);
        }

        if (this._resizeHandle) {
            L.DomEvent.off(this._resizeHandle, 'mousedown', this._onResizeStart, this);
            L.DomEvent.off(this._resizeHandle, 'touchstart', this._onResizeStart, this);
        }

        return this;
    },

    isVisible: function () {
        return L.DomUtil.hasClass(this._container, 'visible');
    },

    show: function () {
        if (!this.isVisible()) {
            L.DomUtil.addClass(this._container, 'visible');
            if (this.options.autoPan) {
                this._map.panBy([-this.getOffset() / 2, 0], {
                    duration: 0.5
                });
            }
            this.fire('show');
        }
    },

    hide: function (e) {
        if (this.isVisible()) {
            L.DomUtil.removeClass(this._container, 'visible');
            if (this.options.autoPan) {
                this._map.panBy([this.getOffset() / 2, 0], {
                    duration: 0.5
                });
            }
            this.fire('hide');
        }
        if(e) {
            L.DomEvent.stopPropagation(e);
        }
    },

    toggle: function () {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    },

    getContainer: function () {
        return this._contentContainer;
    },

    getCloseButton: function () {
        return this._closeButton;
    },

    setContent: function (content) {
        var container = this.getContainer();

        if (typeof content === 'string') {
            container.innerHTML = content;
        } else {
            // clean current content
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }

            container.appendChild(content);
        }

        return this;
    },

    getOffset: function () {
        if (this.options.position === 'right') {
            return -this._container.offsetWidth;
        } else {
            return this._container.offsetWidth;
        }
    },

    _handleTransitionEvent: function (e) {
        if (e.propertyName == 'left' || e.propertyName == 'right' || e.propertyName == 'transform')
            this.fire(this.isVisible() ? 'shown' : 'hidden');
    },

    _onResizeStart: function (e) {
        if (!this.isVisible()) return;
        L.DomEvent.stop(e);
        this._isResizing = true;
        this._startX = (e.touches ? e.touches[0].clientX : e.clientX);
        this._startY = (e.touches ? e.touches[0].clientY : e.clientY);
        this._startWidth = this._container.offsetWidth;
        this._startHeight = this._container.offsetHeight;

        L.DomEvent.on(document, 'mousemove', this._onResize, this);
        L.DomEvent.on(document, 'mouseup', this._onResizeEnd, this);
        L.DomEvent.on(document, 'touchmove', this._onResize, this);
        L.DomEvent.on(document, 'touchend', this._onResizeEnd, this);
        
        L.DomUtil.addClass(document.body, 'sidebar-resizing');
        this._map.dragging.disable();
    },

    _onResize: function (e) {
        if (!this._isResizing) return;
        
        var clientX = (e.touches ? e.touches[0].clientX : e.clientX);
        var clientY = (e.touches ? e.touches[0].clientY : e.clientY);

        if (this.options.position === 'bottom') {
            var dy = this._startY - clientY; // Dragging up increases height
            var newHeight = this._startHeight + dy;
            
            // Constraints for height
            var minH = 100;
            var maxH = window.innerHeight - 50;
            
            if (newHeight < minH) newHeight = minH;
            if (newHeight > maxH) newHeight = maxH;
            
            this._container.style.height = newHeight + 'px';
        } else {
            var dx = clientX - this._startX;
            var newWidth = this._startWidth + (this.options.position === 'right' ? -dx : dx);

            // Constraints
            var minW = this.options.minWidth;
            var maxW = this.options.maxWidth;

            // Ensure max width doesn't exceed window width (minus safety margin)
            var windowLimit = window.innerWidth - 50;
            if (maxW > windowLimit) maxW = windowLimit;

            if (newWidth < minW) newWidth = minW;
            if (newWidth > maxW) newWidth = maxW;

            this._container.style.width = newWidth + 'px';
        }
        this.fire('resize');
    },

    _onResizeEnd: function (e) {
        if (!this._isResizing) return;
        
        this._isResizing = false;
        L.DomEvent.off(document, 'mousemove', this._onResize, this);
        L.DomEvent.off(document, 'mouseup', this._onResizeEnd, this);
        L.DomEvent.off(document, 'touchmove', this._onResize, this);
        L.DomEvent.off(document, 'touchend', this._onResizeEnd, this);
        
        L.DomUtil.removeClass(document.body, 'sidebar-resizing');
        this._map.dragging.enable();
        this.fire('resizeend');
    }
});

L.control.sidebar = function (placeholder, options) {
    return new L.Control.Sidebar(placeholder, options);
};
