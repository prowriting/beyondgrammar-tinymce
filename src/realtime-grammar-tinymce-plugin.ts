import * as $ from "jquery";
import {TinyMCESettingsWindowFactory} from "./ui/TinyMCESettingsWindowFactory";
import {DictionaryEntry, IGrammarChecker, IGrammarCheckerConstructor} from "./interfaces/IGrammarChecker";

import Editor = TinyMCE.Editor;
import Button = TinyMCE.Button;
import Event = TinyMCE.Event;
import PasteEvent = TinyMCE.PasteEvent;
import GetContentEvent = TinyMCE.GetContentEvent;

import {sanitizeHtmlFromQuery} from "./sanitizeHtmlFromQuery";

require('style!css!./styles/tinymce-plugin-styles.css');

tinymce.PluginManager.add('realtime', function(editor : Editor) {

    let rawSettings = editor.settings.realtime || { service : {}, grammar : {} };
    let serviceSettings = tinymce.util.Tools.extend({
        sourcePath : '//prowriting.azureedge.net/realtimegrammar/1.0.95/dist/bundle.js',
        serviceUrl : '//rtg.prowritingaid.com',
        i18n       : {en : "./libs/i18n-en.js"}
    }, rawSettings.service );

    let plugin : RealtimeGrammarPlugin;


    editor.addButton('realtime', {
        icon: 'realtime-grammar-toolbar-icon-16 loading',
        onpostrender : (e : Event<Button>)=>{
            loadPlugin(editor, ()=>{
                let GrammarChecker : IGrammarCheckerConstructor = window['Pwa'].GrammarChecker;
                let element = editor.getBody();
                let checker = new GrammarChecker(element, serviceSettings, rawSettings.grammar);

                plugin = new RealtimeGrammarPlugin( editor, e.target, checker );
            });
        }
    });

    let loadPlugin = ( editor : Editor, complete : ()=>void )=>{
        editor.on('init', ()=>{
            let scriptLoader = new tinymce.dom.ScriptLoader();
            //load grammar script
            scriptLoader.add( serviceSettings.sourcePath );

            //load provided i18n files
            for(let code in serviceSettings.i18n){
                scriptLoader.add( serviceSettings.i18n[code], ((code)=>
                        ()=>tinymce.util.I18n.add( code, window[`GrammarChecker_lang_${code}`].default)
                )(code) );
            }

            editor.setProgressState(true);
            scriptLoader.loadQueue(()=>{
                editor.setProgressState(false);
                complete()
            });
        });
    };

    class RealtimeGrammarPlugin {
        private uiFactory : TinyMCESettingsWindowFactory;

        constructor(private editor : Editor, private toolbarButton : Button, private grammarChecker : IGrammarChecker){

            grammarChecker.init()
                .then(()=>this.startPlugin())
                .catch((error)=>{
                    // some errors on init
                    console.log('RealtimeGrammarChecker', error);
                });
        }

        startPlugin() {
            this.uiFactory = new TinyMCESettingsWindowFactory();

            this.configureAndBindToolbarButton();
            this.bindPastePatching();
            this.bindGettingContent();

            window['Pwa'].sanitizeHtmlFromQuery = sanitizeHtmlFromQuery;

            if( this.grammarChecker.getSettings().checkerIsEnabled ) {
                this.grammarChecker.activate();
            }
        }

        configureAndBindToolbarButton() {
            this.toolbarButton.icon('realtime-grammar-toolbar-icon-16');
            this.toolbarButton.on('click', ()=>this.openSettingsWindow());
        }

        bindPastePatching() {
            this.editor.on('PastePreProcess', (e : PasteEvent)=>{
                e.content = sanitizeHtmlFromQuery('span.pwa', e.content);
            });
        }

        bindGettingContent() {
            this.editor.on('GetContent', (e:GetContentEvent)=>{
                if( e.format == 'html' ) {
                    e.content = sanitizeHtmlFromQuery('span.pwa-mark', e.content);
                }
            });
        }

        openSettingsWindow() {
            let descriptorObj = this.uiFactory.createSettingsWindow( 500, 300, this.grammarChecker );
            let settingsWindow = editor.windowManager.open( descriptorObj );
            
            let $win = $(settingsWindow.$el[0]);
            
            let dictionaryController = new DictionaryController(editor,settingsWindow,  this.grammarChecker, $win, false);
            let replaceController = new DictionaryController(editor, settingsWindow, this.grammarChecker, $win, true);
            
            settingsWindow.on('submit', (e)=>{
                this.grammarChecker.setSettings( e.data );
                
                dictionaryController.destroy();
                replaceController.destroy();
            });
        }
    }
    
    class DictionaryController {
        private PREFIX : string;
        private $itemContainer : JQuery;
        private $listBox : JQuery;
        
        private $entryInput : JQuery;
        private $replaceWithInput : JQuery;
        private $addButton : JQuery;
        private $deleteButton : JQuery;
        
        private lastLoadedEntries : DictionaryEntry[] = [];
        
        constructor(private editor : Editor, private settingsWindow, private grammarChecker : IGrammarChecker, private $window, private isReplace : boolean){
            this.PREFIX = isReplace ? "replace" : "dictionary";
            this.initUI();
            this.reloadDictionary(true);
        }
        
        private initUI(){
            this.$itemContainer = this.$window.find(`#${this.PREFIX}-contents-container>.mce-container-body`);
            this.$addButton = this.$window.find(`#${this.PREFIX}-add-button`);
            this.$deleteButton = this.$window.find(`#${this.PREFIX}-delete-button`);
            
            this.$entryInput = this.$window.find(`#${this.PREFIX}-entry-textbox`);
            this.$replaceWithInput = this.$window.find(`#${this.PREFIX}-replace-textbox`);
            
            this.$listBox = $("<select>")
                .css({ width : "100%", overflow : "auto", border : "1px solid #ccc7c7", boxSizing : "border-box" })
                .attr({ multiple : false, size : 10 })
                .appendTo( this.$itemContainer );
            
            this.$addButton.on("click", ()=>this.addToDictionary() );
            this.$deleteButton.on("click", ()=>this.deleteFromDictionary() );
        }
        
        private addToDictionary(){
            let word = this.$entryInput.val();
            
            if( !word ){
                this.editor.windowManager.alert( `Please type ${this.isReplace ? "replace" : "entity"} for adding to dictionary` );
                return;
            }
            
            if( !this.isReplace &&  this.lastLoadedEntries.filter((e)=>e.Word.toLowerCase() == word.toLowerCase()).length > 0 ){
                this.editor.windowManager.alert( "Entity already exists in the dictionary" );
                return;
            }
            
            let replaceWith = this.isReplace ? this.$replaceWithInput.val() : undefined;
            
            if( this.isReplace && !replaceWith ){
                this.editor.windowManager.alert( "Please type replace for adding to dictionary" );
                return;
            }
            
            if( this.isReplace && this.lastLoadedEntries.filter((e)=>e.Word.toLowerCase() == word.toLowerCase() && e.Replacement.toLowerCase() == replaceWith.toLowerCase()).length > 0 ){
                this.editor.windowManager.alert(`Replacement "${word}=>${replaceWith}" already exists in the dictionary`);
                return;
            }
            
            if( this.isReplace && word == replaceWith ) {
                this.editor.windowManager.alert("What sense to replace one word with the same?");
                return;
            }
            
            this.$entryInput.val("");
            this.$replaceWithInput.val("");
            
            this.activateUI(false);
            
            this.grammarChecker
                .addToDictionary(word, replaceWith)
                .then(()=>this.reloadDictionary())
                .then(()=>this.activateUI())
                .catch(()=>{
                    this.editor.windowManager.alert("Sorry! Error");
                    this.activateUI();
                })
        }
        
        private deleteFromDictionary(){
            let id  = this.$listBox.val();

            if( !id ) {
                this.editor.windowManager.alert( "Please select item for delete" );
                return;
            }
            
            if( this.lastLoadedEntries.filter((e)=>e.Id == id).length == 0 ){
                this.editor.windowManager.alert("Unknown Id for delete"); //[pavel] - im not sure this is good message
                return;
            }
            
            this.activateUI(false);
            
            this.grammarChecker
                .removeFromDictionary(id)
                .then(()=>this.reloadDictionary())
                .then(()=>this.activateUI())
                .catch(()=>{
                    this.editor.windowManager.alert("Sorry! Error");
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
                        .text( `${item.Word}${ item.Replacement? ` => ${item.Replacement}` : "" }` )
                }));
                
                this.lastLoadedEntries = items;
                
                if(changeUI) this.activateUI();
                
                return items;
            });
        }
        
        private activateUI(active : boolean = true){
            //this.$addButton.
            if( active ) {
                //TODO
            } else {
                //TODO
            }
        }
        
        destroy(){
            //TODO destroy
        }
        
        
    }
    
});