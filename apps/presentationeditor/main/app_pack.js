require([
    'common/main/lib/controller/ScreenReaderFocus',
    'common/main/lib/component/ListView',
    'common/main/lib/view/AdvancedSettingsWindow',
    'common/main/lib/view/AutoCorrectDialog',
    'common/main/lib/view/DocumentAccessDialog',
    'common/main/lib/view/UserNameDialog',
    'common/main/lib/view/SaveAsDlg',
    'common/main/lib/view/CopyWarningDialog',
    'common/main/lib/view/ImageFromUrlDialog',
    'common/main/lib/view/SelectFileDlg',
    'common/main/lib/view/SymbolTableDialog',
    'common/main/lib/view/OpenDialog',
    'common/main/lib/view/ExternalEditor',
    'common/main/lib/view/ExternalDiagramEditor',
    'common/main/lib/view/ExternalOleEditor',
    'common/main/lib/view/LanguageDialog',
    'common/main/lib/view/SearchDialog',
    'common/main/lib/view/InsertTableDialog',
    'common/main/lib/view/RenameDialog',
    'common/main/lib/view/PasswordDialog',
    'common/main/lib/view/PluginDlg',
    'common/main/lib/view/PluginPanel',

    'presentationeditor/main/app/view/ParagraphSettingsAdvanced',
    'presentationeditor/main/app/view/ShapeSettingsAdvanced',
    'presentationeditor/main/app/view/TableSettingsAdvanced',
    'presentationeditor/main/app/view/ImageSettingsAdvanced',
    'presentationeditor/main/app/view/SlideshowSettings',
    'presentationeditor/main/app/view/AnimationDialog',
    'presentationeditor/main/app/view/HeaderFooterDialog',
    'presentationeditor/main/app/view/HyperlinkSettingsDialog',
    'presentationeditor/main/app/view/DateTimeDialog',
], function () {
    Common.NotificationCenter.trigger('script:loaded');
});