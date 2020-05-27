import * as $ from "jquery";
import {TinyMCESettingsWindowFactory} from "./ui/TinyMCESettingsWindowFactory";
import {DictionaryEntry, IGrammarChecker, IGrammarCheckerConstructor} from "./interfaces/IGrammarChecker";

import Editor = TinyMCE.Editor;
import Button = TinyMCE.Button;
import ButtonSettings = TinyMCE.Button;
import Event = TinyMCE.Event;
import PasteEvent = TinyMCE.PasteEvent;
import GetContentEvent = TinyMCE.GetContentEvent;

import {sanitizeHtmlFromQuery} from "./sanitizeHtmlFromQuery";
import {tinymceTranslate as t} from "./tinymceTranslate";
import SetContentEvent = TinyMCE.SetContentEvent;

export const isTinyMCE5 : boolean = tinymce.majorVersion == '5';

require('style!css!./styles/tinymce-plugin-styles.css');

tinymce.PluginManager.add('BeyondGrammar', function(editor : Editor) {

    let rawSettings = editor.settings.bgOptions || { service : {}, grammar : {} };
    let serviceSettings = tinymce.util.Tools.extend({
        sourcePath : '//cdn.prowritingaid.com/beyondgrammar/2.0.2893/dist/hayt/bundle.js',
        serviceUrl : '//rtg.prowritingaid.com',
        i18n       : {en : "./libs/i18n-en.js"}
    }, rawSettings.service );

    let plugin : BeyondGrammarPlugin;
    let alreadyLoaded = false;
    
    if( isTinyMCE5 ) {
        addTinyMCE5ToggleButton()
    } else {
        addToolbarButton();
    }

    editor.on('init', (e) => {
        if( editor['schema'] && editor['schema'].addCustomElements ){
            editor['schema'].addCustomElements('~pwa');
        }

        if( alreadyLoaded ) {
            //protecting from word press twice init. https://tommcfarlin.com/wordpress-hooks-firing-twice/
            return;
        }
        alreadyLoaded = true;
        
        let scriptLoader = new tinymce.dom.ScriptLoader();
        //load grammar script
        scriptLoader.add( serviceSettings.sourcePath );

        //load provided i18n files
        for(let code in serviceSettings.i18n){
            scriptLoader.add( serviceSettings.i18n[code], ((code)=>
                    ()=>tinymce.util.I18n.add( code, window[`GrammarChecker_lang_${code}`].default)
            )(code) );
        }

        //editor.setProgressState(true);
        scriptLoader.loadQueue(()=>{
            //editor.setProgressState(false);
            let GrammarChecker : IGrammarCheckerConstructor = window['BeyondGrammar'].GrammarChecker;
            let element = editor.getBody();
            let checker = new GrammarChecker(element, serviceSettings, rawSettings.grammar);
            plugin = new BeyondGrammarPlugin( editor, checker );
        });
    });

    class BeyondGrammarPlugin {
        private uiFactory : TinyMCESettingsWindowFactory;

        constructor(private editor : Editor, public grammarChecker : IGrammarChecker){

            grammarChecker.init()
                .then(()=>this.startPlugin())
                .catch((error)=>{
                    // some errors on init
                    console.log('BeyondGrammarChecker', error);
                });
        }

        private startPlugin() {
            this.uiFactory = new TinyMCESettingsWindowFactory();

            this.bindPastePatching();
            this.bindContentChangeBehavior();

            window['BeyondGrammar'].sanitizeHtmlFromQuery = sanitizeHtmlFromQuery;

            if( this.grammarChecker.getSettings().checkerIsEnabled ) {
                this.grammarChecker.activate();
                button.setActive(true);
            } else {
                button.setActive(false);
            }
        }

        private bindPastePatching() {
            this.editor.on('PastePreProcess', (e : PasteEvent)=>{
                e.content = sanitizeHtmlFromQuery('span.pwa', e.content);
            });
        }

        private bindContentChangeBehavior() {
            this.editor.on('GetContent', (e:GetContentEvent)=>{
                if( e.format == 'html' ) {
                    e.content = sanitizeHtmlFromQuery('span.pwa-mark', e.content);
                }
            });
            
            this.editor.on("SetContent", (e:SetContentEvent)=>{
                if(e.format == 'html') {
                    this.grammarChecker.checkAll();
                }
            });
        }

        openSettingsWindow(activeTab : number = 0) {
            let descriptorObj = this.uiFactory.createSettingsWindow( 500, 300, this.grammarChecker, activeTab);
            let settingsWindow = editor.windowManager.open( descriptorObj );            
            let $win = $(settingsWindow.$el[0]);            
            let dictionaryController = new DictionaryController(editor,settingsWindow,  this.grammarChecker, $win, false);
            
            settingsWindow.on('submit', (e)=>{
                this.grammarChecker.setSettings( e.data );                
                dictionaryController.destroy();
            });
        }
    }
    
    class DictionaryController {
        private PREFIX : string;        
        private $listBox : JQuery;        
        private mce_entryInput : any;
        private mce_replaceWithInput : any;
        private mce_addButton : any;
        private mce_deleteButton : JQuery;
        
        private lastLoadedEntries : DictionaryEntry[] = [];
        
        constructor(private editor : Editor, private settingsWindow, private grammarChecker : IGrammarChecker, private $window, private isReplace : boolean){
            this.PREFIX = isReplace ? "replace" : "dictionary";
            this.initUI();
            this.reloadDictionary(true).catch(()=>{
                this.activateUI();
            })
        }
        
        private initUI(){
            let byId = (id)=>this.settingsWindow.find(`#${id}`)[0];
            
            this.mce_addButton    = byId(`${this.PREFIX}-add-button`);
            this.mce_deleteButton = byId(`${this.PREFIX}-delete-button`);
            this.mce_entryInput = byId(`${this.PREFIX}-entry-textbox`);
            this.mce_replaceWithInput = byId(`${this.PREFIX}-replace-textbox`);

            let $itemsContainer = $(this.settingsWindow.$el[0]).find(`#${this.PREFIX}-contents-container>.mce-container-body`);
            this.$listBox = $("<select>")
                .css({ 
                    width : "385px", overflow : "auto", border : "1px solid #ccc7c7", boxSizing : "border-box",
                    height : "185px", "padding" : 0, lineHeight : "initial"
                })
                .attr({ size : 8 })
                .appendTo( $itemsContainer );
            
            this.mce_addButton.on("click", ()=>this.addToDictionary() );
            this.mce_deleteButton.on("click", ()=>this.deleteFromDictionary() );
        }
        
        private addToDictionary(){
            let word = this.mce_entryInput.value();
            let replaceWith = this.isReplace ? this.mce_replaceWithInput.value() : undefined;
            
            let errorMessage = this.getErrorMessageForAddToDictionary(word, replaceWith);
            if( errorMessage ) {
                this.editor.windowManager.alert(errorMessage);
                return;
            }
            
            this.mce_entryInput.value("");
            this.isReplace && this.mce_replaceWithInput.value("");
            
            this.activateUI(false );
            
            this.grammarChecker
                .addToDictionary(word, replaceWith)
                .then(()=>this.reloadDictionary())
                .then(()=>this.activateUI())
                .catch(()=>{
                    this.editor.windowManager.alert(t("beyond-loading-error"));
                    this.activateUI();
                })
        }
        
        private deleteFromDictionary(){
            let id  = this.$listBox.val();
            
            let errorMessage = this.getErrorMessageForDeleteFromDictionary(id);
            if( errorMessage ) {
                this.editor.windowManager.alert(errorMessage);
                return;
            }
            
            this.activateUI(false);
            
            this.grammarChecker
                .removeFromDictionary(id)
                .then(()=>this.reloadDictionary())
                .then(()=>this.activateUI())
                .catch(()=>{
                    this.editor.windowManager.alert(t("beyond-loading-error"));
                    this.activateUI();
                })
        }
        
        private reloadDictionary(changeUI : boolean = false){
            if( changeUI )this.activateUI(false);
            
            return this.grammarChecker.getDictionaryEntries().then((entries)=>{
                let items = entries.filter(e=>this.isReplace ? !!e.Replacement : !e.Replacement);
                
                this.$listBox.empty().append( items.map((item)=>{
                    return $("<option>")
                        .attr("value", item.Id )
                        .css({padding : "3px"})
                        .text( `${item.Word}${ item.Replacement? ` => ${item.Replacement}` : "" }` )
                }));
                
                this.lastLoadedEntries = items;
                
                if(changeUI) this.activateUI();
                
                return items;
            });
        }
        
        private activateUI(active : boolean = true){
            let state = (mce)=>{
                mce.active(active);
                mce.disabled(!active);
            };
            
            state(this.mce_addButton);
            state(this.mce_deleteButton);
        }

        /**
         * Returns error message if there is error and null if not
         * @param {string} word
         * @param {string} replaceWith
         * @returns {string}
         */
        private getErrorMessageForAddToDictionary( word : string, replaceWith : string) : string {
            if( this.isReplace ) {
                if( !word || !replaceWith ){
                    return t("beyond-empty-terms-for-add-to-dictionary-replacements");
                }

                if( this.lastLoadedEntries.filter((e)=>e.Word.toLowerCase() == word.toLowerCase() && e.Replacement.toLowerCase() == replaceWith.toLowerCase()).length > 0 ){
                    return t("beyond-input-replacement-already-exists", word, replaceWith);
                }

                if( word == replaceWith ) {
                    return t("beyond-added-same-values-for-replace");
                }

            } else {
                if( !word ){
                    return t("beyond-empty-terms-for-add-to-dictionary-word");
                }

                if( this.lastLoadedEntries.filter((e)=>e.Word.toLowerCase() == word.toLowerCase()).length > 0 ){
                    return t("beyond-word-already-exists-in-dictionary", word);
                }
            }

            return null;
        }
        
        private getErrorMessageForDeleteFromDictionary( id : string) : string{
            if( !id ) {
                return t("beyond-item-to-deleted-is-not-selected");
            }
            
            return null;
        }
        
        destroy(){
            this.mce_addButton.off("click");
            this.mce_deleteButton.off("click");
        }
    }


    function addToolbarButton() {
        editor.addButton('BeyondGrammar', {
            icon: 'beyond-grammar-toolbar-icon-16',
            onpostrender : (e : Event<Button>)=>{ },
            onclick : () => plugin.openSettingsWindow()
        });
    }

    //region TinyMCE5 
    let button;
    let enabled = {
        get : () => {
            if( plugin && plugin.grammarChecker ) {
                return plugin.grammarChecker.getSettings().checkerIsEnabled;
            }
            return false;
        },
        set : (v) => {
            if( plugin && plugin.grammarChecker ) {
                let setting = plugin.grammarChecker.getSettings();
                setting.checkerIsEnabled = v;
                plugin.grammarChecker.setSettings( setting );
            }
        }
    };

    function addTinyMCE5ToggleButton() {
        registerIcon();

        editor.ui.registry.addToggleButton('BeyondGrammar', {
            icon: 'beyond-grammar-toolbar-icon-16',
            active : false,
            tooltip : "Beyond Grammar Plugin",
            onSetup : (api)=>{
                button = api;
                //This event need for keep button toggled when changed selection, this button's state 
                editor.on("NodeChange", ()=>{
                    button.setActive( enabled.get() );
                });
            },
            onAction : (api)=>{
                enabled.set( !api.isActive() );
            }
        });
    }

    function registerIcon() {
        let icon = require('!url-loader!./icons/realtime-logo-black-16.png');
        let svgString = `
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                xmlns:xlink="http://www.w3.org/1999/xlink"
                width="16" height="16"
                >
                <image x="0px" y="0px" width="16px" height="16px" xlink:href="${icon}" />
            </svg>`;

        editor.ui.registry.addIcon('beyond-grammar-toolbar-icon-16', svgString);
    }
    //endregion

    return {
        getGrammarChecker : function () {
            return plugin.grammarChecker;
        }
    }
});
