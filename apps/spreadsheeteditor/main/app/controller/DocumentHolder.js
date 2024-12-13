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
 *  Created on 3/28/14
 *
 */

var c_paragraphLinerule = {
    LINERULE_AUTO: 1,
    LINERULE_EXACT: 2
};

var c_paragraphTextAlignment = {
    RIGHT: 0,
    LEFT: 1,
    CENTERED: 2,
    JUSTIFIED: 3
};

var c_paragraphSpecial = {
    NONE_SPECIAL: 0,
    FIRST_LINE: 1,
    HANGING: 2
};

define([
    'core',
    'common/main/lib/util/utils',
    'common/main/lib/util/Shortcuts',
    'spreadsheeteditor/main/app/view/DocumentHolder'
], function () {
    'use strict';

    SSE.Controllers.DocumentHolder = Backbone.Controller.extend(_.extend({
        models: [],
        collections: [],
        views: [
            'DocumentHolder'
        ],

        initialize: function() {
            var me = this;

            me.tooltips = {
                hyperlink: {},
                /** coauthoring begin **/
                comment:{},
                /** coauthoring end **/
                coauth: {
                    ttHeight: 20
                },
                row_column: {
                    ttHeight: 20
                },
                slicer: {
                    ttHeight: 20
                },
                filter: {ttHeight: 40},
                func_arg: {},
                input_msg: {},
                foreignSelect: {
                    ttHeight: 20
                },
                eyedropper: {
                    isHidden: true
                },
                placeholder: {}
            };
            me.mouse = {};
            me.popupmenu = false;
            me.rangeSelectionMode = false;
            me.namedrange_locked = false;
            me._currentMathObj = undefined;
            me._currentParaObjDisabled = false;
            me._isDisabled = false;
            me._state = {wsLock: false, wsProps: []};
            me.fastcoauthtips = [];
            me._TtHeight = 20;
            me.lastMathTrackBounds = [];
            me.showMathTrackOnLoad = false;

            /** coauthoring begin **/
            this.wrapEvents = {
                apiHideComment: _.bind(this.onApiHideComment, this),
                onKeyUp: _.bind(this.onKeyUp, this)
            };
            /** coauthoring end **/

            var keymap = {};
            this.hkComments = Common.Utils.isMac ? 'command+alt+a' : 'alt+h';
            keymap[this.hkComments] = function() {
                me.onAddComment();
                return false;
            };
            Common.util.Shortcuts.delegateShortcuts({shortcuts:keymap});

            Common.Utils.InternalSettings.set('sse-equation-toolbar-hide', Common.localStorage.getBool('sse-equation-toolbar-hide'));
        },

        onLaunch: function() {
            var me = this;

            me.documentHolder = this.createView('DocumentHolder');
            me.documentHolder._currentTranslateObj = this;

//            me.documentHolder.on('render:after', _.bind(me.onAfterRender, me));

            me.documentHolder.render();
            me.documentHolder.el.tabIndex = -1;

            $(document).on('mousedown',     _.bind(me.onDocumentRightDown, me));
            $(document).on('mouseup',       _.bind(me.onDocumentRightUp, me));
            $(document).on('keydown',       _.bind(me.onDocumentKeyDown, me));
            $(document).on('mousemove',     _.bind(me.onDocumentMouseMove, me));
            $(window).on('resize',          _.bind(me.onDocumentResize, me));
            var viewport = SSE.getController('Viewport').getView('Viewport');
            viewport.hlayout.on('layout:resizedrag', _.bind(me.onDocumentResize, me));

            Common.NotificationCenter.on({
                'window:show': function(e){
                    me.hideHyperlinkTip();
                    me.permissions && me.permissions.isDesktopApp && me.api && me.api.asc_onShowPopupWindow();
                },
                'modal:show': function(e){
                    me.hideCoAuthTips();
                    me.hideForeignSelectTips();
                },
                'layout:changed': function(e){
                    me.hideHyperlinkTip();
                    me.hideCoAuthTips();
                    me.hideForeignSelectTips();
                    me.onDocumentResize();
                    if (me.api && !me.tooltips.input_msg.isHidden && me.tooltips.input_msg.text) {
                        me.changeInputMessagePosition(me.tooltips.input_msg);
                    }
                },
                'cells:range': function(status){
                    me.onCellsRange(status);
                },
                'protect:wslock': _.bind(me.onChangeProtectSheet, me)
            });
            Common.Gateway.on('processmouse', _.bind(me.onProcessMouse, me));
            Common.NotificationCenter.on('script:loaded', _.bind(me.createPostLoadElements, me));
        },

        onCreateDelayedElements: function(view, type) {},

        createPostLoadElements: function() {
            var me = this;
            me.setEvents();
            me.permissions.isEdit ? me.documentHolder.createDelayedElements() : me.documentHolder.createDelayedElementsViewer();

            if (me.type !== 'edit') {
                return;
            }

            me.initExternalEditors();
            me.showMathTrackOnLoad && me.onShowMathTrack(me.lastMathTrackBounds);
        },

        loadConfig: function(data) {
            this.editorConfig = data.config;
        },

        setMode: function(permissions) {
            this.permissions = permissions;
            /** coauthoring begin **/
            !(this.permissions.canCoAuthoring && this.permissions.canComments)
                ? Common.util.Shortcuts.suspendEvents(this.hkComments)
                : Common.util.Shortcuts.resumeEvents(this.hkComments);
            /** coauthoring end **/
            this.documentHolder.setMode(permissions);
        },

        setApi: function(api) {
            this.api = api;
            return this;
        },

        onAddComment: function(item) {
            if (this._state.wsProps['Objects']) return;
            
            if (this.api && this.permissions.canCoAuthoring && this.permissions.canComments) {

                var controller = SSE.getController('Common.Controllers.Comments'),
                    cellinfo = this.api.asc_getCellInfo();
                if (controller) {
                    var comments = cellinfo.asc_getComments();
                    if (comments && !comments.length && this.permissions.canCoAuthoring) {
                        controller.addDummyComment();
                    }
                }
            }
        },

        onApiCoAuthoringDisconnect: function() {
            this.permissions.isEdit = false;
        },

        hideCoAuthTips: function() {
            if (this.tooltips.coauth.ref) {
                $(this.tooltips.coauth.ref).remove();
                this.tooltips.coauth.ref = undefined;
                this.tooltips.coauth.x_point = undefined;
                this.tooltips.coauth.y_point = undefined;
            }
        },

        hideForeignSelectTips: function() {
            if (this.tooltips.foreignSelect.ref) {
                $(this.tooltips.foreignSelect.ref).remove();
                this.tooltips.foreignSelect.ref = undefined;
                this.tooltips.foreignSelect.userId = undefined;
                this.tooltips.foreignSelect.x_point = undefined;
                this.tooltips.foreignSelect.y_point = undefined;
            }
        },

        hideHyperlinkTip: function() {
            if (!this.tooltips.hyperlink.isHidden && this.tooltips.hyperlink.ref) {
                this.tooltips.hyperlink.ref.hide();
                this.tooltips.hyperlink.ref = undefined;
                this.tooltips.hyperlink.text = '';
                this.tooltips.hyperlink.isHidden = true;
            }
        },

        hideEyedropperTip: function () {
            if (!this.tooltips.eyedropper.isHidden && this.tooltips.eyedropper.color) {
                this.tooltips.eyedropper.color.css({left: '-1000px', top: '-1000px'});
                if (this.tooltips.eyedropper.ref) {
                    this.tooltips.eyedropper.ref.hide();
                    this.tooltips.eyedropper.ref = undefined;
                }
                this.tooltips.eyedropper.isHidden = true;
            }
        },

        hidePlaceholderTip: function() {
            if (!this.tooltips.placeholder.isHidden && this.tooltips.placeholder.ref) {
                this.tooltips.placeholder.ref.hide();
                this.tooltips.placeholder.ref = undefined;
                this.tooltips.placeholder.text = '';
                this.tooltips.placeholder.isHidden = true;
            }
        },

        onApiHideComment: function() {
            this.tooltips.comment.viewCommentId =
                this.tooltips.comment.editCommentId =
                    this.tooltips.comment.moveCommentId = undefined;
        },

        onApiContextMenu: function(event, type) {
            if (Common.UI.HintManager.isHintVisible())
                Common.UI.HintManager.clearHints();
            var me = this;
            _.delay(function(){
                me.showObjectMenu.call(me, event, type);
            },10);
        },

        onAfterRender: function(view){
        },

        onDocumentResize: function(e){
            var me = this;
            if (me.documentHolder) {
                me.tooltips.coauth.XY = [
                    Common.Utils.getOffset(me.documentHolder.cmpEl).left - $(window).scrollLeft(),
                    Common.Utils.getOffset(me.documentHolder.cmpEl).top  - $(window).scrollTop()
                ];
                me.tooltips.coauth.apiHeight = me.documentHolder.cmpEl.height();
                me.tooltips.coauth.apiWidth = me.documentHolder.cmpEl.width();
                var rightMenu = $('#right-menu');
                me.tooltips.coauth.rightMenuWidth = rightMenu.is(':visible') ? rightMenu.width() : 0;
                me.tooltips.coauth.bodyWidth = $(window).width();
                me.tooltips.coauth.bodyHeight = $(window).height();
            }
        },

        onDocumentWheel: function(e) {
            if (this.api && !this.isEditCell) {
                var delta = (_.isUndefined(e.originalEvent)) ?  e.wheelDelta : e.originalEvent.wheelDelta;
                if (_.isUndefined(delta)) {
                    delta = e.deltaY;
                }

                if (e.ctrlKey && !e.altKey) {
                    var factor = this.api.asc_getZoom();
                    if (delta < 0) {
                        factor = Math.ceil(factor * 10)/10;
                        factor -= 0.1;
                        if (!(factor < .1)) {
                            this.api.asc_setZoom(factor);
                            this._handleZoomWheel = true;
                        }
                    } else if (delta > 0) {
                        factor = Math.floor(factor * 10)/10;
                        factor += 0.1;
                        if (factor > 0 && !(factor > 5.)) {
                            this.api.asc_setZoom(factor);
                            this._handleZoomWheel = true;
                        }
                    }

                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        },

        onDocumentKeyDown: function(event){
            if (this.api){
                var key = event.keyCode;
                if (this.hkSpecPaste) {
                    this._needShowSpecPasteMenu = !event.shiftKey && !event.altKey && event.keyCode == Common.UI.Keys.CTRL;
                }
                if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey){
                    if (key === Common.UI.Keys.NUM_PLUS || key === Common.UI.Keys.EQUALITY || (Common.Utils.isGecko && key === Common.UI.Keys.EQUALITY_FF) || (Common.Utils.isOpera && key == 43)){
                        if (!this.api.isCellEdited) {
                            var factor = Math.floor(this.api.asc_getZoom() * 10)/10;
                            factor += .1;
                            if (factor > 0 && !(factor > 5.)) {
                                this.api.asc_setZoom(factor);
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            return false;
                        } else if (this.permissions.isEditMailMerge || this.permissions.isEditDiagram || this.permissions.isEditOle) {
                            event.preventDefault();
                            event.stopPropagation();
                            return false;
                        }
                    } else if (key === Common.UI.Keys.NUM_MINUS || key === Common.UI.Keys.MINUS || (Common.Utils.isGecko && key === Common.UI.Keys.MINUS_FF) || (Common.Utils.isOpera && key == 45)){
                        if (!this.api.isCellEdited) {
                            factor = Math.ceil(this.api.asc_getZoom() * 10)/10;
                            factor -= .1;
                            if (!(factor < .1)) {
                                this.api.asc_setZoom(factor);
                            }

                            event.preventDefault();
                            event.stopPropagation();
                            return false;
                        } else if (this.permissions.isEditMailMerge || this.permissions.isEditDiagram || this.permissions.isEditOle) {
                            event.preventDefault();
                            event.stopPropagation();
                            return false;
                        }
                    } else if (key === Common.UI.Keys.ZERO || key === Common.UI.Keys.NUM_ZERO) {// 0
                        if (!this.api.isCellEdited) {
                            this.api.asc_setZoom(1);
                            event.preventDefault();
                            event.stopPropagation();
                            return false;
                        }
                    }
                } else
                if (key == Common.UI.Keys.F10 && event.shiftKey) {
                    this.showObjectMenu(event);
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                } else if (key == Common.UI.Keys.ESC && !this.tooltips.input_msg.isHidden && this.tooltips.input_msg.text) {
                    this.onInputMessage();
                }
            }
        },

        onDocumentRightDown: function(event) {
            event.button == 0 && (this.mouse.isLeftButtonDown = true);
//            event.button == 2 && (this.mouse.isRightButtonDown = true);
        },

        onDocumentRightUp: function(event) {
            event.button == 0 && (this.mouse.isLeftButtonDown = false);
        },

        onProcessMouse: function(data) {
            (data.type == 'mouseup') && (this.mouse.isLeftButtonDown = false);
        },

        onDragEndMouseUp: function() {
            this.mouse.isLeftButtonDown = false;
        },

        onDocumentMouseMove: function(e) {
            if (e && e.target.localName !== 'canvas') {
                this.hideHyperlinkTip();
            }
        },

        showObjectMenu: function(event, type){
            if (this.api && !this.mouse.isLeftButtonDown && !this.rangeSelectionMode){
                if (type===Asc.c_oAscContextMenuTypes.changeSeries && this.permissions.isEdit && !this._isDisabled) {
                    this.fillSeriesMenuProps(this.api.asc_GetSeriesSettings(), event, type);
                    return;
                }
                (this.permissions.isEdit && !this._isDisabled) ? this.fillMenuProps(this.api.asc_getCellInfo(), true, event) : this.fillViewMenuProps(this.api.asc_getCellInfo(), true, event);
            }
        },

        onApiMouseMove: function(dataarray) {},

        fillMenuProps: function(cellinfo, showMenu, event) {},

        fillViewMenuProps: function(cellinfo, showMenu, event) {},

        showPopupMenu: function(menu, value, event, type){
            if (!_.isUndefined(menu) && menu !== null && event){
                Common.UI.Menu.Manager.hideAll();

                var me                  = this,
                    documentHolderView  = me.documentHolder,
                    showPoint           = [event.pageX*Common.Utils.zoom() - Common.Utils.getOffset(documentHolderView.cmpEl).left, event.pageY*Common.Utils.zoom() - Common.Utils.getOffset(documentHolderView.cmpEl).top],
                    menuContainer       = documentHolderView.cmpEl.find(Common.Utils.String.format('#menu-container-{0}', menu.id));

                if (!menu.rendered) {
                    // Prepare menu container
                    if (menuContainer.length < 1) {
                        menuContainer = $(Common.Utils.String.format('<div id="menu-container-{0}" style="position: absolute; z-index: 10000;"><div class="dropdown-toggle" data-toggle="dropdown"></div></div>', menu.id));
                        documentHolderView.cmpEl.append(menuContainer);
                    }

                    menu.render(menuContainer);
                    menu.cmpEl.attr({tabindex: "-1"});
                }

                if (/*!this.mouse.isRightButtonDown &&*/ event.button !== 2) {
                    var coord  = me.api.asc_getActiveCellCoord(),
                        offset = {left:0,top:0}/*documentHolderView.cmpEl.offset()*/;

                    showPoint[0] = coord.asc_getX() + coord.asc_getWidth() + offset.left;
                    showPoint[1] = (coord.asc_getY() < 0 ? 0 : coord.asc_getY()) + coord.asc_getHeight() + offset.top;
                }

                menuContainer.css({
                    left: showPoint[0],
                    top : showPoint[1]
                });

                if (_.isFunction(menu.options.initMenu)) {
                    menu.options.initMenu(value);
                    menu.alignPosition();
                }
                _.delay(function() {
                    menu.cmpEl.focus();
                }, 10);

                menu.show();
                me.currentMenu = menu;
                (type!==Asc.c_oAscContextMenuTypes.changeSeries) && me.api.onPluginContextMenuShow && me.api.onPluginContextMenuShow(event);
            }
        },

        onHideSpecialPasteOptions: function() {
            if (!this.documentHolder || !this.documentHolder.cmpEl) return;
            var pasteContainer = this.documentHolder.cmpEl.find('#special-paste-container');
            if (pasteContainer.is(':visible')) {
                pasteContainer.hide();
                $(document).off('keyup', this.wrapEvents.onKeyUp);
            }
        },

        disableSpecialPaste: function() {
            var pasteContainer = this.documentHolder.cmpEl.find('#special-paste-container');
            if (pasteContainer.length>0 && pasteContainer.is(':visible')) {
                this.btnSpecialPaste.setDisabled(!!this._isDisabled);
            }
        },

        onKeyUp: function (e) {
            if (e.keyCode == Common.UI.Keys.CTRL && this._needShowSpecPasteMenu && !this._handleZoomWheel && !this.btnSpecialPaste.menu.isVisible() && /area_id/.test(e.target.id)) {
                $('button', this.btnSpecialPaste.cmpEl).click();
                e.preventDefault();
            }
            this._handleZoomWheel = false;
            this._needShowSpecPasteMenu = false;
        },


        onChangeProtectSheet: function(props) {
            if (!props) {
                var wbprotect = this.getApplication().getController('WBProtection');
                props = wbprotect ? wbprotect.getWSProps() : null;
            }
            if (props) {
                this._state.wsProps = props.wsProps;
                this._state.wsLock = props.wsLock;
            }
        },

        onHideMathTrack: function() {
            if (!this.documentHolder || !this.documentHolder.cmpEl) return;

            if (!Common.Controllers.LaunchController.isScriptLoaded()) {
                this.showMathTrackOnLoad = false;
                return;
            }

            var eqContainer = this.documentHolder.cmpEl.find('#equation-container');
            if (eqContainer.is(':visible')) {
                eqContainer.hide();
            }
        },

        disableEquationBar: function() {
            var eqContainer = this.documentHolder.cmpEl.find('#equation-container'),
                disabled = this._isDisabled || this._state.equationLocked;

            if (eqContainer.length>0 && eqContainer.is(':visible')) {
                this.equationBtns.forEach(function(item){
                    item && item.setDisabled(!!disabled);
                });
                this.equationSettingsBtn.setDisabled(!!disabled);
            }
        },

        getUserName: function(id){
            var usersStore = SSE.getCollection('Common.Collections.Users');
            if (usersStore){
                var rec = usersStore.findUser(id);
                if (rec)
                    return AscCommon.UserInfoParser.getParsedName(rec.get('username'));
            }
            return this.guestText;
        },

        isUserVisible: function(id){
            var usersStore = SSE.getCollection('Common.Collections.Users');
            if (usersStore){
                var rec = usersStore.findUser(id);
                if (rec)
                    return !rec.get('hidden');
            }
            return true;
        },

        SetDisabled: function(state, canProtect) {
            this._isDisabled = state;
            this._canProtect = state ? canProtect : true;
            this.disableEquationBar();
            this.disableSpecialPaste();
        },

        clearSelection: function() {
            this.onHideMathTrack();
            this.onHideSpecialPasteOptions();
        },

        onPluginContextMenu: function(data) {
            if (data && data.length>0 && this.documentHolder && this.currentMenu && (this.currentMenu !== this.documentHolder.copyPasteMenu) &&
                                                                (this.currentMenu !== this.documentHolder.fillMenu) && this.currentMenu.isVisible()){
                this.documentHolder.updateCustomItems(this.currentMenu, data);
            }
        },

        guestText               : 'Guest',
        textCtrlClick           : 'Click the link to open it or click and hold the mouse button to select the cell.',
        txtHeight               : 'Height',
        txtWidth                : 'Width',
        tipIsLocked             : 'This element is being edited by another user.',
        textChangeColumnWidth   : 'Column Width {0} symbols ({1} pixels)',
        textChangeRowHeight     : 'Row Height {0} points ({1} pixels)',
        textInsertLeft          : 'Insert Left',
        textInsertTop           : 'Insert Top',
        textSym                 : 'sym',
        notcriticalErrorTitle: 'Warning',
        errorInvalidLink: 'The link reference does not exist. Please correct the link or delete it.',
        txtRemoveAccentChar: 'Remove accent character',
        txtBorderProps: 'Borders property',
        txtHideTop: 'Hide top border',
        txtHideBottom: 'Hide bottom border',
        txtHideLeft: 'Hide left border',
        txtHideRight: 'Hide right border',
        txtHideHor: 'Hide horizontal line',
        txtHideVer: 'Hide vertical line',
        txtHideLT: 'Hide left top line',
        txtHideLB: 'Hide left bottom line',
        txtAddTop: 'Add top border',
        txtAddBottom: 'Add bottom border',
        txtAddLeft: 'Add left border',
        txtAddRight: 'Add right border',
        txtAddHor: 'Add horizontal line',
        txtAddVer: 'Add vertical line',
        txtAddLT: 'Add left top line',
        txtAddLB: 'Add left bottom line',
        txtRemoveBar: 'Remove bar',
        txtOverbar: 'Bar over text',
        txtUnderbar: 'Bar under text',
        txtRemScripts: 'Remove scripts',
        txtRemSubscript: 'Remove subscript',
        txtRemSuperscript: 'Remove superscript',
        txtScriptsAfter: 'Scripts after text',
        txtScriptsBefore: 'Scripts before text',
        txtFractionStacked: 'Change to stacked fraction',
        txtFractionSkewed: 'Change to skewed fraction',
        txtFractionLinear: 'Change to linear fraction',
        txtRemFractionBar: 'Remove fraction bar',
        txtAddFractionBar: 'Add fraction bar',
        txtRemLimit: 'Remove limit',
        txtLimitOver: 'Limit over text',
        txtLimitUnder: 'Limit under text',
        txtHidePlaceholder: 'Hide placeholder',
        txtShowPlaceholder: 'Show placeholder',
        txtMatrixAlign: 'Matrix alignment',
        txtColumnAlign: 'Column alignment',
        txtTop: 'Top',
        txtBottom: 'Bottom',
        txtInsertEqBefore: 'Insert equation before',
        txtInsertEqAfter: 'Insert equation after',
        txtDeleteEq: 'Delete equation',
        txtLimitChange: 'Change limits location',
        txtHideTopLimit: 'Hide top limit',
        txtShowTopLimit: 'Show top limit',
        txtHideBottomLimit: 'Hide bottom limit',
        txtShowBottomLimit: 'Show bottom limit',
        txtInsertArgBefore: 'Insert argument before',
        txtInsertArgAfter: 'Insert argument after',
        txtDeleteArg: 'Delete argument',
        txtHideOpenBracket: 'Hide opening bracket',
        txtShowOpenBracket: 'Show opening bracket',
        txtHideCloseBracket: 'Hide closing bracket',
        txtShowCloseBracket: 'Show closing bracket',
        txtStretchBrackets: 'Stretch brackets',
        txtMatchBrackets: 'Match brackets to argument height',
        txtGroupCharOver: 'Char over text',
        txtGroupCharUnder: 'Char under text',
        txtDeleteGroupChar: 'Delete char',
        txtHideDegree: 'Hide degree',
        txtShowDegree: 'Show degree',
        txtIncreaseArg: 'Increase argument size',
        txtDecreaseArg: 'Decrease argument size',
        txtInsertBreak: 'Insert manual break',
        txtDeleteBreak: 'Delete manual break',
        txtAlignToChar: 'Align to character',
        txtDeleteRadical: 'Delete radical',
        txtDeleteChars: 'Delete enclosing characters',
        txtDeleteCharsAndSeparators: 'Delete enclosing characters and separators',
        insertText: 'Insert',
        alignmentText: 'Alignment',
        leftText: 'Left',
        rightText: 'Right',
        centerText: 'Center',
        insertRowAboveText      : 'Row Above',
        insertRowBelowText      : 'Row Below',
        insertColumnLeftText    : 'Column Left',
        insertColumnRightText   : 'Column Right',
        deleteText              : 'Delete',
        deleteRowText           : 'Delete Row',
        deleteColumnText        : 'Delete Column',
        txtNoChoices: 'There are no choices for filling the cell.<br>Only text values from the column can be selected for replacement.',
        txtExpandSort: 'The data next to the selection will not be sorted. Do you want to expand the selection to include the adjacent data or continue with sorting the currently selected cells only?',
        txtExpand: 'Expand and sort',
        txtSorting: 'Sorting',
        txtSortSelected: 'Sort selected',
        txtPaste: 'Paste',
        txtPasteFormulas: 'Formulas',
        txtPasteFormulaNumFormat: 'Formulas & number formats',
        txtPasteKeepSourceFormat: 'Formulas & formatting',
        txtPasteBorders: 'All except borders',
        txtPasteColWidths: 'Formulas & column widths',
        txtPasteMerge: 'Merge conditional formatting',
        txtPasteTranspose: 'Transpose',
        txtPasteValues: 'Values',
        txtPasteValNumFormat: 'Values & number formats',
        txtPasteValFormat: 'Values & formatting',
        txtPasteFormat: 'Paste only formatting',
        txtPasteLink: 'Paste Link',
        txtPastePicture: 'Picture',
        txtPasteLinkPicture: 'Linked Picture',
        txtPasteSourceFormat: 'Source formatting',
        txtPasteDestFormat: 'Destination formatting',
        txtKeepTextOnly: 'Keep text only',
        txtUseTextImport: 'Use text import wizard',
        txtUndoExpansion: 'Undo table autoexpansion',
        txtRedoExpansion: 'Redo table autoexpansion',
        txtAnd: 'and',
        txtOr: 'or',
        txtEquals           : "Equals",
        txtNotEquals        : "Does not equal",
        txtGreater          : "Greater than",
        txtGreaterEquals    : "Greater than or equal to",
        txtLess             : "Less than",
        txtLessEquals       : "Less than or equal to",
        txtAboveAve         : 'Above average',
        txtBelowAve         : 'Below average',
        txtBegins           : "Begins with",
        txtNotBegins        : "Does not begin with",
        txtEnds             : "Ends with",
        txtNotEnds          : "Does not end with",
        txtContains         : "Contains",
        txtNotContains      : "Does not contain",
        txtFilterTop: 'Top',
        txtFilterBottom: 'Bottom',
        txtItems: 'items',
        txtPercent: 'percent',
        txtEqualsToCellColor: 'Equals to cell color',
        txtEqualsToFontColor: 'Equals to font color',
        txtAll: '(All)',
        txtBlanks: '(Blanks)',
        txtColumn: 'Column',
        txtImportWizard: 'Text Import Wizard',
        textPasteSpecial: 'Paste special',
        textStopExpand: 'Stop automatically expanding tables',
        textAutoCorrectSettings: 'AutoCorrect options',
        txtLockSort: 'Data is found next to your selection, but you do not have sufficient permissions to change those cells.<br>Do you wish to continue with the current selection?',
        txtRemoveWarning: 'Do you want to remove this signature?<br>It can\'t be undone.',
        txtWarnUrl: 'Clicking this link can be harmful to your device and data.<br>Are you sure you want to continue?',
        txtThisRowHint: 'Choose only this row of the specified column',
        txtAllTableHint: 'Returns the entire contents of the table or specified table columns including column headers, data and total rows',
        txtDataTableHint: 'Returns the data cells of the table or specified table columns',
        txtHeadersTableHint: 'Returns the column headers for the table or specified table columns',
        txtTotalsTableHint: 'Returns the total rows for the table or specified table columns',
        txtCopySuccess: 'Link copied to the clipboard',
        warnFilterError: 'You need at least one field in the Values area in order to apply a value filter.',
        txtByField: '%1 of %2'

    }, SSE.Controllers.DocumentHolder || {}));
});