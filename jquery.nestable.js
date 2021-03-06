/*!
 * Nestable jQuery Plugin - Copyright (c) 2012 David Bushell - http://dbushell.com/
 * Dual-licensed under the BSD or MIT licenses
 */
;(function($, window, document, undefined)
{
    var hasTouch = 'ontouchstart' in window;

    /**
     * Detect CSS pointer-events property
     * events are normally disabled on the dragging element to avoid conflicts
     * https://github.com/ausi/Feature-detection-technique-for-pointer-events/blob/master/modernizr-pointerevents.js
     */
    var hasPointerEvents = (function()
    {
        var el    = document.createElement('div'),
            docEl = document.documentElement;
        if (!('pointerEvents' in el.style)) {
            return false;
        }
        el.style.pointerEvents = 'auto';
        el.style.pointerEvents = 'x';
        docEl.appendChild(el);
        var supports = window.getComputedStyle && window.getComputedStyle(el, '').pointerEvents === 'auto';
        docEl.removeChild(el);
        return !!supports;
    })();

    var eStart  = hasTouch ? 'touchstart'  : 'mousedown',
        eMove   = hasTouch ? 'touchmove'   : 'mousemove',
        eEnd    = hasTouch ? 'touchend'    : 'mouseup';
        eCancel = hasTouch ? 'touchcancel' : 'mouseup';

    var defaults = {
        listNodeName                : 'ol',
        itemNodeName                : 'li',
        rootClass                   : 'dd',
        listClass                   : 'dd-list',
        itemClass                   : 'dd-item',
        dragClass                   : 'dd-dragel',
        handleClass                 : 'dd-handle',
        collapsedClass              : 'dd-collapsed',
        placeClass                  : 'dd-placeholder',
        noDragClass                 : 'dd-nodrag',
        emptyClass                  : 'dd-empty',
        expandBtnHTML               : '<button data-action="expand" type="button"><span class="glyphicon glyphicon-chevron-down" aria-hidden="true"></span></button>',
        collapseBtnHTML             : '<button data-action="collapse" type="button"><span class="glyphicon glyphicon-chevron-up" aria-hidden="true"></span></button>',
        animateToggle               : true,
        animateToggleDuration       : 200,
        group                       : 0,
        maxDepth                    : 5,
        threshold                   : 20,
        editMode                    : false,
        changeHandler               : null,
        changeEvent                 : 'change',
        deletionTracking            : false,
        deletionMessage             : 'Are you sure you want to delete this item?',
        deletionMessageChildren     : 'Are you sure you want to delete this item? This will also delete all children of this item.',
        topLevelItemButton          : false,
        topLevelItemButtonText      : 'Add a new top-level item',
        topLevelItemButtonHTML      : '<button type="button" class="btn btn-info" data-action="add-top-level"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span> topLevelItemButtonText</button><div class="clearfix"></div>',
        topLevelItemButtonLocation  : 'bottom',
        topLevelItemButtonAlignment : 'right',
        iconLib                     : 'glyphicon',
        persisted                   : {
            newItemCount            : 0,
            deletedItems            : []
        }
    };

    var editableItemHTML = '';
        editableItemHTML += '<li class="dd-item dd3-item" data-sort-id="" data-server-id="">';
        editableItemHTML +=     '<div class="dd-handle dd3-handle">';
        editableItemHTML +=         '<span class="glyphicon glyphicon-move" aria-hidden="true"></span>';
        editableItemHTML +=     '</div>';
        editableItemHTML +=     '<div class="dd3-content">';
        editableItemHTML +=         '<div class="form-group">';
        editableItemHTML +=             '<input class="form-control input-sm" type="text" placeholder="Enter title">';
        editableItemHTML +=         '</div>';
        editableItemHTML +=         '<button type="button" class="btn btn-sm btn-info" data-action="add"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span></button>';
        editableItemHTML +=         '<button type="button" class="btn btn-sm btn-danger" data-action="remove"><span class="glyphicon glyphicon-trash" aria-hidden="true"></span></button>';
        editableItemHTML +=         '<div class="clearfix"></div>';
        editableItemHTML +=     '</div>';
        editableItemHTML += '</li>';

    var editableListHTML;
    if (defaults.animateToggle) {
        // Set inline display style on toggleable elements to avoid jQuery's slideToggle jumping/glitching
        editableListHTML = '<ol class="dd-list" style="display:block;">' + editableItemHTML + '';
    } else {
        editableListHTML = '<ol class="dd-list">' + editableItemHTML + '';
    }

    function Plugin(element, options)
    {
        this.w  = $(window);
        this.el = $(element);
        this.options = $.extend({}, defaults, options);
        this.init();
    }

    Plugin.prototype = {

        init: function()
        {
            var list = this;

            list.reset();

            list.el.data('nestable-group', this.options.group);

            list.placeEl = $('<div class="' + list.options.placeClass + '"/>');

            // If you're in edit mode:
            if (list.options.editMode) {
                // Change the name of the event that looks for a change in the
                // list from "change" to "rearrange" so that it won't fire when
                // the contents of an input field change
                list.options.changeEvent = 'rearrange';
                // Add keyup event to all input fields so that when their values
                // change, the list is regenerated
                list.el.find('input').on('keyup', function(e) {
                    list.el.trigger(list.options.changeEvent);
                });
                // Let the list know that it's in edit mode
                list.el.addClass('edit-mode');
                // Count any pre-existing items so that newItemCount starts at the correct value
                this.options.persisted.newItemCount = $('.' + list.options.itemClass).length;
            }

            // If an icon type other than Glyphicon is needed, update the relevant HTML
            if (list.options.iconLib === 'font-awesome') {
                editableListHTML = editableListHTML.replace('glyphicon glyphicon-move', 'fa fa-arrows');
                editableItemHTML = editableItemHTML.replace('glyphicon glyphicon-move', 'fa fa-arrows');
                list.options.expandBtnHTML = list.options.expandBtnHTML.replace('glyphicon glyphicon-chevron-down', 'fa fa-chevron-down');
                list.options.collapseBtnHTML = list.options.collapseBtnHTML.replace('glyphicon glyphicon-chevron-up', 'fa fa-chevron-up');
                list.options.topLevelItemButtonHTML = list.options.topLevelItemButtonHTML.replace('glyphicon glyphicon-plus', 'fa fa-plus');
            }

            // If you need a button to add a new top-level item
            if (list.options.topLevelItemButton) {
                if ($('[data-action="add-top-level"]').length === 0) {
                    // Update the button's text
                    list.options.topLevelItemButtonHTML = list.options.topLevelItemButtonHTML.replace('topLevelItemButtonText', list.options.topLevelItemButtonText);
                    // Add the button
                    if (list.options.topLevelItemButtonLocation === 'bottom') {
                        list.el.append($(list.options.topLevelItemButtonHTML));
                    } else {
                        list.el.prepend($(list.options.topLevelItemButtonHTML));
                    }
                    list.el.find('[data-action="add-top-level"]').addClass(list.options.topLevelItemButtonLocation);
                    if (list.options.topLevelItemButtonAlignment === 'right') {
                        list.el.find('[data-action="add-top-level"]').addClass('pull-right');
                    }
                }
            }

            $.each(this.el.find(list.options.itemNodeName), function(k, el) {
                list.setParent($(el));
            });

            list.el.on('click', 'button', function(e) {
                if (list.dragEl || (!hasTouch && e.button !== 0)) {
                    return;
                }
                var target = $(e.currentTarget),
                    action = target.data('action'),
                    item   = target.parent(list.options.itemNodeName);
                if (action === 'add') {
                    list.addItem(target);
                }
                if (action === 'remove') {
                    list.removeItem(target);
                }
                if (action === 'collapse') {
                    list.collapseItem(item);
                }
                if (action === 'expand') {
                    list.expandItem(item);
                }
                if (action === 'add-top-level') {
                    list.addItem(target, true);
                }
            });

            var onStartEvent = function(e)
            {
                var handle = $(e.target);
                if (!handle.hasClass(list.options.handleClass)) {
                    if (handle.closest('.' + list.options.noDragClass).length) {
                        return;
                    }
                    handle = handle.closest('.' + list.options.handleClass);
                }
                if (!handle.length || list.dragEl || (!hasTouch && e.button !== 0) || (hasTouch && e.touches.length !== 1)) {
                    return;
                }
                e.preventDefault();
                list.dragStart(hasTouch ? e.touches[0] : e);
            };

            var onMoveEvent = function(e)
            {
                if (list.dragEl) {
                    e.preventDefault();
                    list.dragMove(hasTouch ? e.touches[0] : e);
                }
            };

            var onEndEvent = function(e)
            {
                if (list.dragEl) {
                    e.preventDefault();
                    list.dragStop(hasTouch ? e.touches[0] : e);
                }
            };

            if (hasTouch) {
                list.el[0].addEventListener(eStart, onStartEvent, false);
                window.addEventListener(eMove, onMoveEvent, false);
                window.addEventListener(eEnd, onEndEvent, false);
                window.addEventListener(eCancel, onEndEvent, false);
            } else {
                list.el.on(eStart, onStartEvent);
                list.w.on(eMove, onMoveEvent);
                list.w.on(eEnd, onEndEvent);
            }

            var destroyNestable = function()
            {

                $(list.options.expandBtnHTML).remove();
                $(list.options.collapseBtnHTML).remove();

                if (hasTouch) {
                    list.el[0].removeEventListener(eStart, onStartEvent, false);
                    window.removeEventListener(eMove, onMoveEvent, false);
                    window.removeEventListener(eEnd, onEndEvent, false);
                    window.removeEventListener(eCancel, onEndEvent, false);
                } else {
                    list.el.off(eStart, onStartEvent);
                    list.w.off(eMove, onMoveEvent);
                    list.w.off(eEnd, onEndEvent);
                }

                list.el.off('click');
                list.el.unbind('destroy-nestable');

                list.el.data("nestable", null);

                if (list.options.editMode) {
                    // If you're in edit mode, remove the keyup listeners that
                    // monitor text changes
                    list.el.find('input').off('keyup');
                }

                // If the list has a change handler attached, remove it
                if (list.options.changeHandler) {
                    list.el.off(list.options.changeEvent, list.options.changeHandler);
                }
            };

            list.el.bind('destroy-nestable', destroyNestable);

        },

        destroy: function ()
        {
            this.el.trigger('destroy-nestable');
        },

        serialize: function()
        {
            var data,
                depth = 0,
                list  = this;
                step  = function(level, depth)
                {
                    var array = [ ],
                        items = level.children(list.options.itemNodeName);
                    items.each(function()
                    {
                        var li   = $(this),
                            item = $.extend({}, li.data()),
                            sub  = li.children(list.options.listNodeName);
                            // If you're in edit mode:
                            if (list.options.editMode) {
                                // Add the item's title into the serialised array
                                item = $.extend(item, {'title': li.find('input').val()});
                            }
                        if (sub.length) {
                            item.children = step(sub, depth + 1);
                        }
                        array.push(item);
                    });
                    return array;
                };
            data = step(list.el.find(list.options.listNodeName).first(), depth);
            // If you're tracking deleted items:
            if (list.options.deletionTracking && list.options.persisted.deletedItems.length > 0) {
                data.push(list.options.persisted.deletedItems);
            }
            return data;
        },

        serialise: function()
        {
            return this.serialize();
        },

        reset: function()
        {
            this.mouse = {
                offsetX   : 0,
                offsetY   : 0,
                startX    : 0,
                startY    : 0,
                lastX     : 0,
                lastY     : 0,
                nowX      : 0,
                nowY      : 0,
                distX     : 0,
                distY     : 0,
                dirAx     : 0,
                dirX      : 0,
                dirY      : 0,
                lastDirX  : 0,
                lastDirY  : 0,
                distAxX   : 0,
                distAxY   : 0
            };
            this.moving     = false;
            this.dragEl     = null;
            this.dragRootEl = null;
            this.dragDepth  = 0;
            this.hasNewRoot = false;
            this.pointEl    = null;
        },

        addItem: function(e, topLevel)
        {
            var list = this,
                item = e.parent().parent(this.options.itemNodeName);

            // If a top-level item has been asked for, add a new list item as the last child of the outermost list
            // Or, add new list if the item you clicked has no lists already
            // Otherwise add a new item at the top of the first list you find
            var newItem;
            if(topLevel) {
                // Top-level item to be added
                if (list.options.topLevelItemButtonLocation === 'bottom') {
                    list.el.find(this.options.listNodeName).first().append(editableItemHTML);
                    newItem = list.el.find(this.options.itemNodeName).last();
                } else {
                    list.el.find(this.options.listNodeName).first().prepend(editableItemHTML);
                    newItem = list.el.find(this.options.itemNodeName).first();
                }
            } else if (item.find(this.options.listNodeName).length === 0) {
                // New list
                // However, this must respect the maxDepth option
                if (item.parents(this.options.listNodeName).length < this.options.maxDepth) {
                    // If you're not at the maxDepth, you add a new list
                    item.append(editableListHTML);
                    newItem = item.find(this.options.listNodeName).first().find(this.options.itemNodeName).first();
                } else {
                    // But if you are, you add a new item right below the item you clicked
                    $(editableItemHTML).insertAfter(item);
                    newItem = item.parent().find(this.options.itemNodeName).eq(item.index() + 1);
                }
            } else {
                // New item
                item.find(this.options.listNodeName).first().prepend(editableItemHTML);
                newItem = item.find(this.options.listNodeName).first().find(this.options.itemNodeName).first();
            }
            list.setLocalID(newItem);

            // Add highlight to newest item
            newItem.addClass('highlight new');
            setTimeout(function() {
                newItem.removeClass('highlight');
            }, 1000);
            setTimeout(function() {
                newItem.removeClass('new');
            }, 2000);

            // Give focus to the input field in the new item, if on a large enough screen
            if (window.innerWidth > 768) {
                newItem.find('input').focus();
            }

            // List has changed, update listeners
            list.regenerate();
        },

        setLocalID: function(newItem)
        {
            // Increment count of new items as use this count as the new item's local ID
            this.options.persisted.newItemCount++;
            newItem.attr('data-sort-id', this.options.persisted.newItemCount);

            // If you want to easily see the ID of the new item:
            //newItem.find('input').val(this.options.persisted.newItemCount);

            // If you want to give a "fake" server ID to new items, for testing:
            //newItem.attr('data-server-id', this.options.persisted.newItemCount);

        },

        removeItem: function(e)
        {
            var list = this,
                item = e.closest(list.options.itemNodeName);

            if (item.find(list.options.listNodeName).length > 0) {
                // Item has children
                if (confirm(list.options.deletionMessageChildren)) {
                    if (list.options.deletionTracking) {
                        // Track the deletion of the item you clicked
                        list.trackDeletion(item);
                        // And then track deletion of its children
                        list.trackDeletion(item.find('[data-server-id]'));
                    }
                    item.remove();
                }
            } else {
                // Item has no children
                if (confirm(list.options.deletionMessage)) {
                    if (list.options.deletionTracking) {
                        list.trackDeletion(item.data('server-id'));
                    }
                    item.remove();
                }
            }

            // Since you're only removing items, you might be left with empty
            // item containers - remove these
            list.el.find(list.options.listNodeName).each(function() {
                if ($(this).children().length === 0) {
                    $(this).remove();
                }
            });

            // Remove the collapse button any items that no longer have children
            list.el.find(list.options.listNodeName).each(function() {
                var collapsibles = $(this).find('.collapsible');
                if (collapsibles.length) {
                    collapsibles.each(function() {
                        if ($(this).find(list.options.itemNodeName).length === 0) {
                            $(this).find('[data-action="expand"]').remove();
                            $(this).find('[data-action="collapse"]').remove();
                            $(this).removeClass('collapsible');
                        }
                    });
                }
            });

            // If you've removed all items, recreate a new one automatically,
            // so you can't be left with no controls
            if (list.el.find(list.options.itemNodeName).length === 0) {
                item = list.el.append(editableListHTML);
                // Give an ID to your new item
                list.setLocalID(item.find(list.options.listNodeName).first().find(list.options.itemNodeName).first());
            }

            // List has changed, update listeners
            list.regenerate();
        },

        trackDeletion: function(e) {
            var list = this;
            if (typeof(e) === 'number') {
                // Single item or parent item
                list.options.persisted.deletedItems.push(e);
            } else if (typeof(e) === 'object') {
                // Child items
                e.each(function() {
                    var objectID = $(this).data('server-id');
                    if (typeof(objectID) !== 'string') {
                        list.options.persisted.deletedItems.push(objectID);
                    }
                });
            }
        },

        regenerate: function()
        {
            // You've added or removed an item, so remove all listeners etc....
            this.destroy();
            // ...and then re-create the list
            this.el.nestable(this.options);
            // Restore visibility on any hidden expand buttons (hidden by setParent())
            $('.collapsible.dd-collapsed').children('[data-action="expand"]').show();
            // If the list needs a change handler, re-attach it
            if (this.options.changeHandler) {
                this.el.on(this.options.changeEvent, this.options.changeHandler);
                // Trigger it
                this.el.trigger(this.options.changeEvent);
            }
        },

        expandItem: function(li)
        {
            var list = this;
            if (list.options.animateToggle) {
                // Disable any buttons that could cause a toggle, while the toggle is running
                $('[data-action="collapse"]').attr('disabled','disabled').addClass('disabled');
                $('[data-action="expand"]').attr('disabled','disabled').addClass('disabled');
                li.children(list.options.listNodeName).slideToggle(list.options.animateToggleDuration, function() {
                    $('[data-action="collapse"]').removeAttr('disabled').removeClass('disabled');
                    $('[data-action="expand"]').removeAttr('disabled').removeClass('disabled');
                    expandCompleted(li);
                });
            } else {
                expandCompleted(li);
                li.children(list.options.listNodeName).show();
            }
            // Re-enable Add/Delete buttons in expanded item
            if (list.options.editMode) {
                li.find('[data-action="add"]').first().removeAttr('disabled').removeClass('disabled');
                li.find('[data-action="remove"]').first().removeAttr('disabled').removeClass('disabled');
            }
            function expandCompleted(li) {
                li.removeClass(list.options.collapsedClass);
                li.children('[data-action="expand"]').hide();
                li.children('[data-action="collapse"]').show();
            }
        },

        collapseItem: function(li)
        {
            var list = this,
                lists = li.children(list.options.listNodeName);
            if (lists.length) {
                if (list.options.animateToggle) {
                    // Disable any buttons that could cause a toggle, while the toggle is running
                    $('[data-action="collapse"]').attr('disabled','disabled').addClass('disabled');
                    $('[data-action="expand"]').attr('disabled','disabled').addClass('disabled');
                    li.children(list.options.listNodeName).slideToggle(list.options.animateToggleDuration, function() {
                        $('[data-action="collapse"]').removeAttr('disabled').removeClass('disabled');
                        $('[data-action="expand"]').removeAttr('disabled').removeClass('disabled');
                        collapsedCompleted(li);
                    });
                } else {
                    collapsedCompleted(li);
                    li.children(list.options.listNodeName).hide();
                }
                // Disable Add/Delete buttons in collapsed item
                if (list.options.editMode) {
                    li.find('[data-action="add"]').first().attr('disabled','disabled').addClass('disabled');
                    li.find('[data-action="remove"]').first().attr('disabled','disabled').addClass('disabled');
                }
                function collapsedCompleted(li) {
                    li.addClass(list.options.collapsedClass);
                    li.children('[data-action="collapse"]').hide();
                    li.children('[data-action="expand"]').show();
                }
            }
        },

        expandAll: function()
        {
            var list = this;
            list.el.find(list.options.itemNodeName).each(function() {
                list.expandItem($(this));
            });
        },

        collapseAll: function()
        {
            var list = this;
            list.el.find(list.options.itemNodeName).each(function() {
                list.collapseItem($(this));
            });
        },

        setParent: function(li)
        {
            // Add expand/collapse controls
            if (li.children(this.options.listNodeName).length) {
                if (!li.hasClass('collapsible')) {
                    li.prepend($(this.options.expandBtnHTML));
                    li.prepend($(this.options.collapseBtnHTML));
                    li.addClass('collapsible');
                }
            }
            li.children('[data-action="expand"]').hide();
        },

        unsetParent: function(li)
        {
            li.removeClass(this.options.collapsedClass);
            li.children('[data-action]').remove();
            li.children(this.options.listNodeName).remove();
            li.removeClass('collapsible');
        },

        dragStart: function(e)
        {
            var mouse    = this.mouse,
                target   = $(e.target),
                dragItem = target.closest(this.options.itemNodeName);

            if (dragItem.find(this.options.itemNodeName).length === 0) {
                this.placeEl.css('height', dragItem.height());
            } else {
                this.placeEl.css('height', dragItem.height() - 5);
            }

            mouse.offsetX = e.offsetX !== undefined ? e.offsetX : e.pageX - target.offset().left;
            mouse.offsetY = e.offsetY !== undefined ? e.offsetY : e.pageY - target.offset().top;
            mouse.startX = mouse.lastX = e.pageX;
            mouse.startY = mouse.lastY = e.pageY;

            this.dragRootEl = this.el;

            this.dragEl = $(document.createElement(this.options.listNodeName)).addClass(this.options.listClass + ' ' + this.options.dragClass);
            this.dragEl.css('width', dragItem.width());

            // fix for zepto.js
            //dragItem.after(this.placeEl).detach().appendTo(this.dragEl);
            dragItem.after(this.placeEl);
            dragItem[0].parentNode.removeChild(dragItem[0]);
            dragItem.appendTo(this.dragEl);

            $(document.body).append(this.dragEl);
            this.dragEl.css({
                'left' : e.pageX - mouse.offsetX,
                'top'  : e.pageY - mouse.offsetY
            });
            // total depth of dragging item
            var i, depth,
                items = this.dragEl.find(this.options.itemNodeName);
            for (i = 0; i < items.length; i++) {
                depth = $(items[i]).parents(this.options.listNodeName).length;
                if (depth > this.dragDepth) {
                    this.dragDepth = depth;
                }
            }
        },

        dragStop: function(e)
        {
            // fix for zepto.js
            //this.placeEl.replaceWith(this.dragEl.children(this.options.itemNodeName + ':first').detach());
            var el = this.dragEl.children(this.options.itemNodeName).first();
            el[0].parentNode.removeChild(el[0]);
            this.placeEl.replaceWith(el);

            this.dragEl.remove();
            this.el.trigger(this.options.changeEvent);
            if (this.hasNewRoot) {
                this.dragRootEl.trigger(this.options.changeEvent);
            }
            this.reset();
        },

        dragMove: function(e)
        {
            var list, parent, prev, next, depth,
                opt   = this.options,
                mouse = this.mouse;

            this.dragEl.css({
                'left' : e.pageX - mouse.offsetX,
                'top'  : e.pageY - mouse.offsetY
            });

            // mouse position last events
            mouse.lastX = mouse.nowX;
            mouse.lastY = mouse.nowY;
            // mouse position this events
            mouse.nowX  = e.pageX;
            mouse.nowY  = e.pageY;
            // distance mouse moved between events
            mouse.distX = mouse.nowX - mouse.lastX;
            mouse.distY = mouse.nowY - mouse.lastY;
            // direction mouse was moving
            mouse.lastDirX = mouse.dirX;
            mouse.lastDirY = mouse.dirY;
            // direction mouse is now moving (on both axis)
            mouse.dirX = mouse.distX === 0 ? 0 : mouse.distX > 0 ? 1 : -1;
            mouse.dirY = mouse.distY === 0 ? 0 : mouse.distY > 0 ? 1 : -1;
            // axis mouse is now moving on
            var newAx   = Math.abs(mouse.distX) > Math.abs(mouse.distY) ? 1 : 0;

            // do nothing on first move
            if (!mouse.moving) {
                mouse.dirAx  = newAx;
                mouse.moving = true;
                return;
            }

            // calc distance moved on this axis (and direction)
            if (mouse.dirAx !== newAx) {
                mouse.distAxX = 0;
                mouse.distAxY = 0;
            } else {
                mouse.distAxX += Math.abs(mouse.distX);
                if (mouse.dirX !== 0 && mouse.dirX !== mouse.lastDirX) {
                    mouse.distAxX = 0;
                }
                mouse.distAxY += Math.abs(mouse.distY);
                if (mouse.dirY !== 0 && mouse.dirY !== mouse.lastDirY) {
                    mouse.distAxY = 0;
                }
            }
            mouse.dirAx = newAx;

            /**
             * move horizontal
             */
            if (mouse.dirAx && mouse.distAxX >= opt.threshold) {
                // reset move distance on x-axis for new phase
                mouse.distAxX = 0;
                prev = this.placeEl.prev(opt.itemNodeName);
                // increase horizontal level if previous sibling exists and is not collapsed
                if (mouse.distX > 0 && prev.length && !prev.hasClass(opt.collapsedClass)) {
                    // cannot increase level when item above is collapsed
                    list = prev.find(opt.listNodeName).last();
                    // check if depth limit has reached
                    depth = this.placeEl.parents(opt.listNodeName).length;
                    if (depth + this.dragDepth <= opt.maxDepth) {
                        // create new sub-level if one doesn't exist
                        if (!list.length) {
                            list = $('<' + opt.listNodeName + '/>').addClass(opt.listClass);
                            list.append(this.placeEl);
                            prev.append(list);
                            this.setParent(prev);
                        } else {
                            // else append to next level up
                            list = prev.children(opt.listNodeName).last();
                            list.append(this.placeEl);
                        }
                    }
                }
                // decrease horizontal level
                if (mouse.distX < 0) {
                    // we can't decrease a level if an item preceeds the current one
                    next = this.placeEl.next(opt.itemNodeName);
                    if (!next.length) {
                        parent = this.placeEl.parent();
                        this.placeEl.closest(opt.itemNodeName).after(this.placeEl);
                        if (!parent.children().length) {
                            this.unsetParent(parent.parent());
                        }
                    }
                }
            }

            var isEmpty = false;

            // find list item under cursor
            if (!hasPointerEvents) {
                this.dragEl[0].style.visibility = 'hidden';
            }
            this.pointEl = $(document.elementFromPoint(e.pageX - document.body.scrollLeft, e.pageY - (window.pageYOffset || document.documentElement.scrollTop)));
            if (!hasPointerEvents) {
                this.dragEl[0].style.visibility = 'visible';
            }
            if (this.pointEl.hasClass(opt.handleClass)) {
                this.pointEl = this.pointEl.parent(opt.itemNodeName);
            }
            if (this.pointEl.hasClass(opt.emptyClass)) {
                isEmpty = true;
            }
            else if (!this.pointEl.length || !this.pointEl.hasClass(opt.itemClass)) {
                return;
            }

            // find parent list of item under cursor
            var pointElRoot = this.pointEl.closest('.' + opt.rootClass),
                isNewRoot   = this.dragRootEl.data('nestable-id') !== pointElRoot.data('nestable-id');

            /**
             * move vertical
             */
            if (!mouse.dirAx || isNewRoot || isEmpty) {
                // check if groups match if dragging over new root
                if (isNewRoot && opt.group !== pointElRoot.data('nestable-group')) {
                    return;
                }
                // check depth limit
                depth = this.dragDepth - 1 + this.pointEl.parents(opt.listNodeName).length;
                if (depth > opt.maxDepth) {
                    return;
                }
                var before = e.pageY < (this.pointEl.offset().top + this.pointEl.height() / 2);
                    parent = this.placeEl.parent();
                // if empty create new list to replace empty placeholder
                if (isEmpty) {
                    list = $(document.createElement(opt.listNodeName)).addClass(opt.listClass);
                    list.append(this.placeEl);
                    this.pointEl.replaceWith(list);
                }
                else if (before) {
                    this.pointEl.before(this.placeEl);
                }
                else {
                    this.pointEl.after(this.placeEl);
                }
                if (!parent.children().length) {
                    this.unsetParent(parent.parent());
                }
                if (!this.dragRootEl.find(opt.itemNodeName).length) {
                    this.dragRootEl.append('<div class="' + opt.emptyClass + '"/>');
                }
                // parent root list has changed
                if (isNewRoot) {
                    this.dragRootEl = pointElRoot;
                    this.hasNewRoot = this.el[0] !== this.dragRootEl[0];
                }
            }
        }

    };

    $.fn.nestable = function(params)
    {
        var lists  = this,
            retval = this;

        lists.each(function()
        {
            var plugin = $(this).data("nestable");

            if (!plugin) {
                $(this).data("nestable", new Plugin(this, params));
                $(this).data("nestable-id", new Date().getTime());
            } else {
                if (typeof params === 'string' && typeof plugin[params] === 'function') {
                    retval = plugin[params]();
                }
            }
        });

        return retval || lists;
    };

})(window.jQuery || window.Zepto, window, document);
