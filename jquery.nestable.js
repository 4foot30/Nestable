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

    var editableItemHTML = '';
        editableItemHTML += '<li class="dd-item dd3-item" data-sort-id="" data-server-id="">';
        editableItemHTML +=     '<div class="dd-handle dd3-handle">';
        editableItemHTML +=         '<span class="glyphicon glyphicon-move" aria-hidden="true"></span>';
        editableItemHTML +=     '</div>';
        editableItemHTML +=     '<div class="dd3-content">';
        editableItemHTML +=         '<div class="form-group">';
        editableItemHTML +=             '<input class="form-control input-sm" type="text" placeholder="Enter title">';
        editableItemHTML +=         '</div>';
        // Note spaces, to retain whitespace gaps for inline-block buttons
        editableItemHTML +=         ' <button type="text" class="btn btn-sm btn-info" data-action="add"><span class="glyphicon glyphicon-plus" aria-hidden="true"></span></button>';
        editableItemHTML +=         ' <button type="text" class="btn btn-sm btn-danger" data-action="remove"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></button>';
        editableItemHTML +=     '</div>';
        editableItemHTML += '</li>';

    var editableListHTML = '<ol class="dd-list">' + editableItemHTML + '';

    var defaults = {
            listNodeName            : 'ol',
            itemNodeName            : 'li',
            rootClass               : 'dd',
            listClass               : 'dd-list',
            itemClass               : 'dd-item',
            dragClass               : 'dd-dragel',
            handleClass             : 'dd-handle',
            collapsedClass          : 'dd-collapsed',
            placeClass              : 'dd-placeholder',
            noDragClass             : 'dd-nodrag',
            emptyClass              : 'dd-empty',
            expandBtnHTML           : '<button data-action="expand" type="button">Expand</button>',
            collapseBtnHTML         : '<button data-action="collapse" type="button">Collapse</button>',
            group                   : 0,
            maxDepth                : 5,
            threshold               : 20,
            editMode                : false,
            changeHandler           : null,
            changeEvent             : 'change',
            newItemCount            : 1,
            deletionTracking        : false,
            deletionMessage         : 'Are you sure you want to delete this item?',
            deletionMessageChildren : 'Are you sure you want to delete this item? This will also delete all children of this item.'
        };

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
                    // If youre in edit mode, remove the keyup listeners that
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

        addItem: function(e)
        {
            var list = this,
                item = e.parent().parent(this.options.itemNodeName);

            // Add new list if this item has no lists already
            // Otherwise add a new item at the top of the first list you find
            if (item.find(this.options.listNodeName).length === 0) {
                // New list
                // However, this must respect the maxDepth option
                if (item.parents(this.options.listNodeName).length < this.options.maxDepth) {
                    // If you're not at the maxDepth, you add a new list
                    item.append(editableListHTML);
                    list.setLocalID(item.find(this.options.listNodeName).first().find(this.options.itemNodeName).first());
                } else {
                    // But if you are, you add a new item right below the item you clicked
                    $(editableItemHTML).insertAfter(item);
                    list.setLocalID(item.parent().find(this.options.itemNodeName).eq(item.index() + 1));
                }
            } else {
                // New item
                item.find(this.options.listNodeName).first().prepend(editableItemHTML);
                list.setLocalID(item.find(this.options.listNodeName).first().find(this.options.itemNodeName).first());
            }

            // List has changed, update listeners
            this.regenerate();
        },

        setLocalID: function(newItem)
        {
            // Increment count of new items as use this count as the new item's local ID
            this.options.newItemCount++;
            newItem.attr('data-sort-id', this.options.newItemCount);

            // If you want to easily see the ID of the new item:
            //newItem.find('input').val(this.options.newItemCount);
            //
            // If you want to give a server ID to new items, for testing:
            newItem.attr('data-server-id', this.options.newItemCount);

        },

        removeItem: function(e)
        {
            var list = this,
                item = e.closest(this.options.itemNodeName);

            if (item.find(this.options.listNodeName).length > 0) {
                if (confirm (this.options.deletionMessageChildren)) {
                    item.remove();
                }
            } else {
                if (confirm (this.options.deletionMessage)) {
                    item.remove();
                }
            }

            // Since you're only removing items, you might be left with empty
            // item containers - remove these
            list.el.find(this.options.listNodeName).each(function() {
                if ($(this).children().length === 0) {
                    $(this).remove();
                }
            });

            // If you've removed all items, recreate a new one automatically,
            // so you can't be left with no controls
            if (list.el.find(this.options.itemNodeName).length === 0) {
                item = list.el.append(editableListHTML);
                // Give an ID to your new item
                list.setLocalID(item.find(this.options.listNodeName).first().find(this.options.itemNodeName).first());
            }

            // List has changed, update listeners
            this.regenerate();
        },

        regenerate: function()
        {
            // You've added or removed an item, so remove all listeners etc....
            this.destroy();
            // ...and then re-create the list
            this.el.nestable(this.options);
            // If the list needs a change handler, re-attach it
            if (this.options.changeHandler) {
                this.el.on(this.options.changeEvent, this.options.changeHandler);
                // Trigger it
                this.el.trigger(this.options.changeEvent);
            }
        },

        expandItem: function(li)
        {
            li.removeClass(this.options.collapsedClass);
            li.children('[data-action="expand"]').hide();
            li.children('[data-action="collapse"]').show();
            li.children(this.options.listNodeName).show();
        },

        collapseItem: function(li)
        {
            var lists = li.children(this.options.listNodeName);
            if (lists.length) {
                li.addClass(this.options.collapsedClass);
                li.children('[data-action="collapse"]').hide();
                li.children('[data-action="expand"]').show();
                li.children(this.options.listNodeName).hide();
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
            // Add expand/collapse controls, unless you're in Edit mode
            if (!this.options.editMode) {
                if (li.children(this.options.listNodeName).length) {
                    li.prepend($(this.options.expandBtnHTML));
                    li.prepend($(this.options.collapseBtnHTML));
                }
                li.children('[data-action="expand"]').hide();
            }
        },

        unsetParent: function(li)
        {
            li.removeClass(this.options.collapsedClass);
            li.children('[data-action]').remove();
            li.children(this.options.listNodeName).remove();
        },

        dragStart: function(e)
        {
            var mouse    = this.mouse,
                target   = $(e.target),
                dragItem = target.closest(this.options.itemNodeName);

            this.placeEl.css('height', dragItem.height());

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
