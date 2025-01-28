/*
 * (c) Copyright Ascensio System SIA 2010-2024
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at 20A-6 Ernesta Birznieka-Upish
 * street, Riga, Latvia, EU, LV-1050.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */
/**
 *  DocumentHolder.js
 *
 *  DocumentHolder controller
 *
 *  Created on 1/15/14
 *
 */

var c_paragraphLinerule = {
    LINERULE_LEAST: 0,
    LINERULE_AUTO: 1,
    LINERULE_EXACT: 2
};

var c_paragraphSpecial = {
    NONE_SPECIAL: 0,
    FIRST_LINE: 1,
    HANGING: 2
};

var c_paragraphTextAlignment = {
    RIGHT: 0,
    LEFT: 1,
    CENTERED: 2,
    JUSTIFIED: 3
};

var c_pageNumPosition = {
    PAGE_NUM_POSITION_TOP: 0x01,
    PAGE_NUM_POSITION_BOTTOM: 0x02,
    PAGE_NUM_POSITION_RIGHT: 0,
    PAGE_NUM_POSITION_LEFT: 1,
    PAGE_NUM_POSITION_CENTER: 2
};

var c_tableWrap = {
    TABLE_WRAP_NONE: 0,
    TABLE_WRAP_PARALLEL: 1
};

var c_tableAlign = {
    TABLE_ALIGN_LEFT: 0,
    TABLE_ALIGN_CENTER: 1,
    TABLE_ALIGN_RIGHT: 2
};

var c_tableBorder = {
    BORDER_VERTICAL_LEFT: 0,
    BORDER_HORIZONTAL_TOP: 1,
    BORDER_VERTICAL_RIGHT: 2,
    BORDER_HORIZONTAL_BOTTOM: 3,
    BORDER_VERTICAL_CENTER: 4,
    BORDER_HORIZONTAL_CENTER: 5,
    BORDER_INNER: 6,
    BORDER_OUTER: 7,
    BORDER_ALL: 8,
    BORDER_NONE: 9,
    BORDER_ALL_TABLE: 10, // table border and all cell borders
    BORDER_NONE_TABLE: 11, // table border and no cell borders
    BORDER_INNER_TABLE: 12, // table border and inner cell borders
    BORDER_OUTER_TABLE: 13 // table border and outer cell borders
};

define([
    'core',
    'documenteditor/main/app/view/DocumentHolder'
], function () {
    'use strict';

    DE.Controllers.DocumentHolder = Backbone.Controller.extend({
        models: [],
        collections: [],
        views: [
            'DocumentHolder'
        ],

        initialize: function() {
            //
            var me = this;

            me._TtHeight        = 20;
            me.usertips = [];
            me.fastcoauthtips = [];
            me._isDisabled = false;
            me._state = {};
            me.mode = {};
            me.mouseMoveData = null;
            me.isTooltipHiding = false;
            me.lastMathTrackBounds = [];
            me.showMathTrackOnLoad = false;

            me.screenTip = {
                strTip: '',
                isHidden: true,
                isVisible: false
            };
            me.eyedropperTip = {
                isHidden: true,
                isVisible: false,
                eyedropperColor: null,
                tipInterval: null,
                isTipVisible: false
            };
            me.userTooltip = true;
            me.wrapEvents = {
                userTipMousover: _.bind(me.userTipMousover, me),
                userTipMousout: _.bind(me.userTipMousout, me),
                onKeyUp: _.bind(me.onKeyUp, me),
                onMouseLeave: _.bind(me.onMouseLeave, me)
            };

            var keymap = {};
            me.hkComments = Common.Utils.isMac ? 'command+alt+a' : 'alt+h';
            keymap[me.hkComments] = function() {
                if (me.api.can_AddQuotedComment()!==false) {
                    me.addComment();
                }
                return false;
            };
            Common.util.Shortcuts.delegateShortcuts({shortcuts:keymap});

            Common.Utils.InternalSettings.set('de-equation-toolbar-hide', Common.localStorage.getBool('de-equation-toolbar-hide'));
        },

        onLaunch: function() {
            this.documentHolder = this.createView('DocumentHolder').render();
            this.documentHolder.el.tabIndex = -1;
            this.onAfterRender();

            var me = this;
            Common.NotificationCenter.on({
                'window:show': function(e){
                    me.hideScreentip();
                    /** coauthoring begin **/
                    me.userTipHide();
                    /** coauthoring end **/
                    me.hideEyedropper();
                    me.mode && me.mode.isDesktopApp && me.api && me.api.asc_onShowPopupWindow();

                },
                'modal:show': function(e){
                    me.hideTips();
                },
                'layout:changed': function(e){
                    me.hideScreentip();
                    /** coauthoring begin **/
                    me.userTipHide();
                    /** coauthoring end **/
                    me.hideTips();
                    me.hideEyedropper();
                    me.onDocumentHolderResize();
                },
            });
            Common.NotificationCenter.on('protect:doclock', _.bind(me.onChangeProtectDocument, me));
            Common.NotificationCenter.on('script:loaded', _.bind(me.createPostLoadElements, me));
        },

        setApi: function(o) {
            this.api = o;
            if (this.api) {
                if (this.mode.isEdit === true) {
                    this.api.asc_registerCallback('asc_onLockDocumentProps',        _.bind(this.onApiLockDocumentProps, this));
                    this.api.asc_registerCallback('asc_onUnLockDocumentProps',      _.bind(this.onApiUnLockDocumentProps, this));
                }
                this.api.asc_registerCallback('asc_onCoAuthoringDisconnect',        _.bind(this.onCoAuthoringDisconnect, this));
                Common.NotificationCenter.on('api:disconnect',                      _.bind(this.onCoAuthoringDisconnect, this));
                this.api.asc_registerCallback('asc_onTextLanguage',                 _.bind(this.onTextLanguage, this));
                this.api.asc_registerCallback('asc_onParaStyleName',                _.bind(this.onApiParagraphStyleChange, this));
                this.documentHolder.setApi(this.api);
            }

            return this;
        },

        setMode: function(m) {
            this.mode = m;
            /** coauthoring begin **/
            !(this.mode.canCoAuthoring && this.mode.canComments)
                ? Common.util.Shortcuts.suspendEvents(this.hkComments)
                : Common.util.Shortcuts.resumeEvents(this.hkComments);
            /** coauthoring end **/
            this.documentHolder.setMode(m);
        },

        createPostLoadElements: function() {
            var me = this;
            me.setEvents();
            me.mode.isEdit ? me.documentHolder.createDelayedElements() : me.documentHolder.createDelayedElementsViewer();

            if (!me.mode.isEdit) return;

            me.initExternalEditors();
            me.showMathTrackOnLoad && me.onShowMathTrack(me.lastMathTrackBounds);
            me.documentHolder && me.documentHolder.setLanguages();
        },

        createDelayedElements: function(view, type) {},

        getView: function (name) {
            return !name ?
                this.documentHolder : Backbone.Controller.prototype.getView.call()
        },

        showPopupMenu: function(menu, value, event, docElement, eOpts){
            var me = this;
            if (!_.isUndefined(menu)  && menu !== null){
                Common.UI.Menu.Manager.hideAll();

                var showPoint = [event.get_X(), event.get_Y()],
                    menuContainer = $(me.documentHolder.el).find(Common.Utils.String.format('#menu-container-{0}', menu.id));

                if (!menu.rendered) {
                    // Prepare menu container
                    if (menuContainer.length < 1) {
                        menuContainer = $(Common.Utils.String.format('<div id="menu-container-{0}" style="position: absolute; z-index: 10000;"><div class="dropdown-toggle" data-toggle="dropdown"></div></div>', menu.id));
                        $(me.documentHolder.el).append(menuContainer);
                    }

                    menu.render(menuContainer);
                    menu.cmpEl.attr({tabindex: "-1"});
                }

                menuContainer.css({
                    left: showPoint[0],
                    top : showPoint[1]
                });

                menu.show();

                if (_.isFunction(menu.options.initMenu)) {
                    menu.options.initMenu(value);
                    menu.alignPosition();
                }
                _.delay(function() {
                    menu.cmpEl.focus();
                }, 10);

                me.documentHolder.currentMenu = menu;
                me.api.onPluginContextMenuShow && me.api.onPluginContextMenuShow(event);
            }
        },

        fillMenuProps: function(selectedElements) {},

        fillViewMenuProps: function(selectedElements) {},

        fillFormsMenuProps: function(selectedElements) {},

        showObjectMenu: function(event, docElement, eOpts){
            var me = this;
            if (me.api){
                var docProtection = me.documentHolder._docProtection,
                    disableEditing = me._isDisabled || docProtection.isReadOnly || docProtection.isFormsOnly || docProtection.isCommentsOnly,
                    obj = me.mode.isEdit && !disableEditing ? me.fillMenuProps(me.api.getSelectedElements()) :
                          me.mode.isPDFForm && me.mode.canFillForms && me.mode.isRestrictedEdit && !disableEditing ? me.fillFormsMenuProps(me.api.getSelectedElements()) :
                            me.fillViewMenuProps(me.api.getSelectedElements());
                if (obj) me.showPopupMenu(obj.menu_to_show, obj.menu_props, event, docElement, eOpts);
            }
        },

        onContextMenu: function(event){
            if (Common.UI.HintManager.isHintVisible())
                Common.UI.HintManager.clearHints();
            if (!event) {
                Common.UI.Menu.Manager.hideAll();
                return;
            }

            var me = this;
            _.delay(function(){
                if (event.get_Type() == 0) {
                    me.showObjectMenu.call(me, event);
                } else {
                    me.showPopupMenu.call(me, me.documentHolder.hdrMenu, {Header: event.is_Header(), PageNum: event.get_PageNum()}, event);
                }
            },10);
        },

        onFocusObject: function(selectedElements) {
            var me = this,
                currentMenu = me.documentHolder.currentMenu;
            if (currentMenu && currentMenu.isVisible() && currentMenu !== me.documentHolder.hdrMenu){
                var docProtection = me.documentHolder._docProtection,
                    disableEditing = me._isDisabled || docProtection.isReadOnly || docProtection.isFormsOnly || docProtection.isCommentsOnly,
                    obj = me.mode.isEdit && !disableEditing ? me.fillMenuProps(selectedElements) :
                          me.mode.isPDFForm && me.mode.canFillForms && me.mode.isRestrictedEdit && !disableEditing ? me.fillFormsMenuProps(selectedElements) :
                          me.fillViewMenuProps(selectedElements);
                if (obj) {
                    if (obj.menu_to_show===currentMenu) {
                        currentMenu.options.initMenu(obj.menu_props);
                        currentMenu.alignPosition();
                    }
                }
            }

            if (this.mode && this.mode.isEdit) {
                var i = -1,
                    in_equation = false,
                    locked = false;
                while (++i < selectedElements.length) {
                    var type = selectedElements[i].get_ObjectType();
                    if (type === Asc.c_oAscTypeSelectElement.Math) {
                        in_equation = true;
                    } else if (type === Asc.c_oAscTypeSelectElement.Paragraph || type === Asc.c_oAscTypeSelectElement.Table || type === Asc.c_oAscTypeSelectElement.Header) {
                        var value = selectedElements[i].get_ObjectValue();
                        value && (locked = locked || value.get_Locked());
                    } else if (type === Asc.c_oAscTypeSelectElement.UnProtectedRegion) { //(unprotected region)
                        var value = selectedElements[i].get_ObjectValue();
                        me.documentHolder._unprotectedRegion = {
                            canEditText: value.get_canEditText(),
                            canEditPara: value.get_canEditPara(),
                            canInsObject: value.get_canInsObject()
                        };
                    }
                }
                if (in_equation) {
                    this._state.equationLocked = locked;
                    this.disableEquationBar();
                }
            }
        },

        handleDocumentWheel: function(event) {
            var me = this;
            if (me.api) {
                var delta = (_.isUndefined(event.originalEvent)) ? event.wheelDelta : event.originalEvent.wheelDelta;
                if (_.isUndefined(delta)) {
                    delta = event.deltaY;
                }

                if (event.ctrlKey && !event.altKey) {
                    if (delta < 0) {
                        me.api.zoomOut();
                        me._handleZoomWheel = true;
                    } else if (delta > 0) {
                        me.api.zoomIn();
                        me._handleZoomWheel = true;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        },

        handleDocumentKeyDown: function(event){
            var me = this;
            if (me.api){
                var key = event.keyCode;
                if (me.hkSpecPaste) {
                    me._needShowSpecPasteMenu = !event.shiftKey && !event.altKey && event.keyCode == Common.UI.Keys.CTRL;
                }
                if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey){
                    if (key === Common.UI.Keys.NUM_PLUS || key === Common.UI.Keys.EQUALITY || (Common.Utils.isGecko && key === Common.UI.Keys.EQUALITY_FF) || (Common.Utils.isOpera && key == 43)){
                        me.api.zoomIn();
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                    else if (key === Common.UI.Keys.NUM_MINUS || key === Common.UI.Keys.MINUS || (Common.Utils.isGecko && key === Common.UI.Keys.MINUS_FF) || (Common.Utils.isOpera && key == 45)){
                        (key !== Common.UI.Keys.NUM_MINUS || !me.mode.isEdit) && me.api.zoomOut();
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else if (key === Common.UI.Keys.ZERO || key === Common.UI.Keys.NUM_ZERO) {// 0
                        me.api.zoom(100);
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    }
                }
                if (me.documentHolder.currentMenu && me.documentHolder.currentMenu.isVisible()) {
                    if (key == Common.UI.Keys.UP ||
                        key == Common.UI.Keys.DOWN) {
                        $('ul.dropdown-menu', me.documentHolder.currentMenu.el).focus();
                    }
                }

                if (key == Common.UI.Keys.ESC) {
                    Common.UI.Menu.Manager.hideAll();
                }
            }
        },

        onDocumentHolderResize: function(e){
            var me = this;
            me._XY = [
                Common.Utils.getOffset(me.documentHolder.cmpEl).left - $(window).scrollLeft(),
                Common.Utils.getOffset(me.documentHolder.cmpEl).top - $(window).scrollTop()
            ];
            me._Height = me.documentHolder.cmpEl.height();
            me._Width = me.documentHolder.cmpEl.width();
            me._BodyWidth = $('body').width();
        },

        onAfterRender: function(ct){
            var me = this;
            var meEl = me.documentHolder.cmpEl;
            if (meEl) {
                meEl.on('contextmenu', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
                meEl.on('click', function(e){
                    if (e.target.localName == 'canvas') {
                        if (me._preventClick)
                            me._preventClick = false;
                        else
                            meEl.focus();
                    }
                });
                meEl.on('mousedown', function(e){
                    if (e.target.localName == 'canvas')
                        Common.UI.Menu.Manager.hideAll();
                });
                meEl.on('touchstart', function(e){
                    if (e.target.localName == 'canvas')
                        Common.UI.Menu.Manager.hideAll();
                });

                //NOTE: set mouse wheel handler

                var addEvent = function( elem, type, fn ) {
                    elem.addEventListener ? elem.addEventListener( type, fn, false ) : elem.attachEvent( "on" + type, fn );
                };

                var eventname=(/Firefox/i.test(navigator.userAgent))? 'DOMMouseScroll' : 'mousewheel';
                addEvent(me.documentHolder.el, eventname, _.bind(me.handleDocumentWheel, me));
            }

            !Common.Utils.isChrome ? $(document).on('mousewheel', _.bind(me.handleDocumentWheel, me)) :
                document.addEventListener('mousewheel', _.bind(me.handleDocumentWheel, me), {passive: false});
            $(document).on('keydown', _.bind(me.handleDocumentKeyDown, me));

            $(window).on('resize', _.bind(me.onDocumentHolderResize, me));
            var viewport = me.getApplication().getController('Viewport').getView('Viewport');
            viewport.hlayout.on('layout:resizedrag', _.bind(me.onDocumentHolderResize, me));
        },

        getUserName: function(id){
            var usersStore = DE.getCollection('Common.Collections.Users');
            if (usersStore){
                var rec = usersStore.findUser(id);
                if (rec)
                    return AscCommon.UserInfoParser.getParsedName(rec.get('username'));
            }
            return this.documentHolder.guestText;
        },

        isUserVisible: function(id){
            var usersStore = DE.getCollection('Common.Collections.Users');
            if (usersStore){
                var rec = usersStore.findUser(id);
                if (rec)
                    return !rec.get('hidden');
            }
            return true;
        },

        userTipMousover: function (evt, el, opt) {
            var me = this;
            if (me.userTooltip===true) {
                me.userTooltip = new Common.UI.Tooltip({
                    owner: evt.currentTarget,
                    title: me.documentHolder.tipIsLocked
                });

                me.userTooltip.show();
            }
        },

        userTipHide: function () {
            var me = this;
            if (typeof me.userTooltip == 'object') {
                me.userTooltip.hide();
                me.userTooltip = undefined;

                for (var i=0; i<me.usertips.length; i++) {
                    me.usertips[i].off('mouseover', me.wrapEvents.userTipMousover);
                    me.usertips[i].off('mouseout', me.wrapEvents.userTipMousout);
                }
            }
        },

        userTipMousout: function (evt, el, opt) {
            var me = this;
            if (typeof me.userTooltip == 'object') {
                if (me.userTooltip.$element && evt.currentTarget === me.userTooltip.$element[0]) {
                    me.userTipHide();
                }
            }
        },

        hideTips: function() {
            var me = this;
            /** coauthoring begin **/
            if (typeof me.userTooltip == 'object') {
                me.userTooltip.hide();
                me.userTooltip = true;
            }
            _.each(me.usertips, function(item) {
                item.remove();
            });
            me.usertips = [];
            me.usertipcount = 0;
            /** coauthoring end **/
        },

        hideEyedropper: function () {
            if (this.eyedropperTip.isVisible) {
                this.eyedropperTip.isVisible = false;
                this.eyedropperTip.eyedropperColor.css({left: '-1000px', top: '-1000px'});
            }
            if (this.eyedropperTip.isTipVisible) {
                this.eyedropperTip.isTipVisible = false;
                this.eyedropperTip.toolTip.hide();
            }
        },

        hideScreentip: function () {
            this.screenTip.toolTip && this.screenTip.toolTip.hide();
            this.screenTip.isVisible = false;
        },

        onKeyUp: function (e) {
            if (e.keyCode == Common.UI.Keys.CTRL && this._needShowSpecPasteMenu && !this._handleZoomWheel && !this.btnSpecialPaste.menu.isVisible() && /area_id/.test(e.target.id)) {
                $('button', this.btnSpecialPaste.cmpEl).click();
                e.preventDefault();
            }
            this._handleZoomWheel = false;
            this._needShowSpecPasteMenu = false;
        },

        onMouseLeave: function () {
            this.hideScreentip();
        },

        onMouseMoveStart: function() {
            var me = this;
            me.screenTip.isHidden = true;
            /** coauthoring begin **/
            if (me.usertips.length>0) {
                if (typeof me.userTooltip == 'object') {
                    me.userTooltip.hide();
                    me.userTooltip = true;
                }
                _.each(me.usertips, function(item) {
                    item.remove();
                });
            }
            me.usertips = [];
            me.usertipcount = 0;
            /** coauthoring end **/
        },

        onMouseMoveEnd: function() {
            var me = this;
            if (me.screenTip.isHidden && me.screenTip.isVisible) {
                me.screenTip.isVisible = false;
                me.isTooltipHiding = true;
                me.screenTip.toolTip && me.screenTip.toolTip.hide(function(){
                    me.isTooltipHiding = false;
                    if (me.mouseMoveData) me.onMouseMove(me.mouseMoveData);
                    me.mouseMoveData = null;
                });
            }
            if (me.eyedropperTip.isHidden) {
                me.hideEyedropper();
            }
        },

        onMouseMove: function(moveData) {},

        onApiLockDocumentProps: function() {
            this._state.lock_doc = true;
        },

        onApiUnLockDocumentProps: function() {
            this._state.lock_doc = false;
        },

        onTextLanguage: function(langid) {
            this.documentHolder._currLang.id = langid;
        },

        onApiParagraphStyleChange: function(name) {
            window.currentStyleName = name;
        },

        onCoAuthoringDisconnect: function() {
            this.mode.isEdit = false;
        },

        SetDisabled: function(state, canProtect, fillFormMode) {
            this._isDisabled = state;
            this.documentHolder.SetDisabled(state, canProtect, fillFormMode);
            this.disableEquationBar();
            this.disableSpecialPaste();
        },

        clearSelection: function() {
            this.onHideMathTrack();
            this.onHideSpecialPasteOptions();
        },

        changePosition: function() {
            var me = this,
                cmpEl = me.documentHolder.cmpEl;
            me._XY = [
                Common.Utils.getOffset(cmpEl).left - $(window).scrollLeft(),
                Common.Utils.getOffset(cmpEl).top  - $(window).scrollTop()
            ];
            me._Height = cmpEl.height();
            me._Width = cmpEl.width();
            me._BodyWidth = $('body').width();
            me.onMouseMoveStart();
        },

        addComment: function(item, e, eOpt){
            if (this.api && this.mode.canCoAuthoring && this.mode.canComments) {
                this.documentHolder.suppressEditComplete = true;

                var controller = DE.getController('Common.Controllers.Comments');
                if (controller) {
                    controller.addDummyComment();
                }
            }
        },

        onHideMathTrack: function() {},

        onHideSpecialPasteOptions: function() {},

        disableEquationBar: function() {},
        
        disableSpecialPaste: function() {},

        onChangeProtectDocument: function(props) {
            if (!props) {
                var docprotect = this.getApplication().getController('DocProtection');
                props = docprotect ? docprotect.getDocProps() : null;
            }
            if (props && this.documentHolder) {
                this.documentHolder._docProtection = props;
                this.disableEquationBar();
                this.disableSpecialPaste();
            }
        },

        editComplete: function() {
            this.documentHolder && this.documentHolder.fireEvent('editcomplete', this.documentHolder);
        }
    });
});