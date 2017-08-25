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
            let $find = (query)=>$(settingsWindow.$.find(query, settingsWindow.$el[0])[0]);
            
            let $dictionaryContainer = $find("#dictionary-contents-container>.mce-container-body");// $(settingsWindow.$.find("#dictionary-contents-container>.mce-container-body", settingsWindow.$el[0])[0]);
            let $replaceContainer = $find("#replace-contents-container>.mce-container-body");
            let $addDictionaryBtn = $find("#dictionary-add-button");
            
            
            settingsWindow.on('submit', (e)=>{
                this.grammarChecker.setSettings( e.data );
            });
            
            let $dictionaryListbox;
            let $replaceListbox;
            
            let reInitUI = ()=>{
                $win.off("click", "#dictionary-add-button");
                
                $win.on("click", "#dictionary-add-button", ()=>{
                    //TODO lock interface
                    
                });
                
                //$addDictionaryBtn.off();
                //$addDictionaryBtn.on('click', ()=>{
                    
                //});
            };
            
            let reloadDictionary = ()=>this.grammarChecker
                .getDictionaryEntries()
                .then(( entries =>{
                    $replaceListbox = createListBox( entries.filter(e=>!!e.Replacement) );
                    $dictionaryListbox = createListBox( entries.filter(e=>!e.Replacement) );
                    
                    $dictionaryContainer.empty().append( $dictionaryListbox );
                    $replaceContainer.empty().append( $replaceListbox );
                    
                    reInitUI();
                }));
            
            let createListBox = (items : DictionaryEntry[])=>$("<select>")
                .css({ width : "100%", overflow : "auto", border : "1px solid #ccc7c7", boxSizing : "border-box" })
                .attr({ multiple : false, size : 10 })
                .append(items.map(i=>{
                   return $("<option>").attr("id", i.Id ).text( `${i.Word} ${ i.Replacement? `( Replace with "${i.Replacement}")` : "" }` ) 
                }));
                
            
            reloadDictionary();
        }
    }
    
    
});