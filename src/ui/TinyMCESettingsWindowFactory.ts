import {IGrammarChecker} from "../interfaces/IGrammarChecker";
import {ILanguage} from "../interfaces/ILanguage";
import {tinymceTranslate as t} from "../tinymceTranslate";

export class TinyMCESettingsWindowFactory{
    is5 : boolean;
    constructor(){
        this.is5 = tinymce.majorVersion == '5';
    }
    
    createSettingsWindow(
        width : number, height : number, checker : IGrammarChecker, activeTab : number = 0
    ) : any {
        
        let window = {
            title: t('beyond-settings-window-header', checker.getApplicationName(), checker.getApplicationVersion()),
            items : null
        };
        
        if( this.is5 ) {
            window = {...window,
                initialData:checker.getSettings(),
                body : {
                    type : "tabpanel",
                    tabs : [
                        this.createLanguageTab(checker),
                        this.createOptionsTab(),
                        // this.createDictionaryTab(false),
                        this.createAboutTab(checker)
                    ]
                },
                buttons:[
                    { type : "submit", text : "Ok" },
                    { type: "cancel", text: "Cancel"}
                ]
            };
        } else {
            window = {...window, width, height,
                layout : 'fit',
                items : []
            };
            
            let form = {
                type : "form", data : checker.getSettings(), items : [],
                margin : "0 0 0 0", padding : "0 0 0 0"
            };
            let tabPanel = {
                type : "tabpanel",
                activeTab,
                layout : 'fit',
                items: []
            };

            tabPanel.items.push( this.createLanguageTab(checker) );
            tabPanel.items.push( this.createOptionsTab() );
            tabPanel.items.push( this.createDictionaryTab(false) );
            // TODO replacements is not implemented yet on the server
            //tabPanel.items.push( this.createDictionaryTab(true) );
            tabPanel.items.push( this.createAboutTab(checker) );

            form.items.push(tabPanel);

            window.items.push( form );
        }
        
        

        

        

        return window;
    }

    createLanguageTab(checker : IGrammarChecker) {
        return {
            title: t('beyond-language-tab-label'),
            type : "form",
            items : [
                {type : "checkbox" , name: "checkSpelling",    [this.labelFieldName]: t('beyond-check-spelling-label') },
                {type : "checkbox" , name: "checkGrammar",     [this.labelFieldName] : t('beyond-check-grammar-label')  },
                {type : "checkbox" , name: "checkStyle",       [this.labelFieldName] : t('beyond-check-style-label')    },

                {
                    type : this.is5 ? 'selectbox' : "listbox",  name : 'languageIsoCode', label : t('beyond-select-language-label'),
                    [this.is5 ? "items" : "values"] : checker
                        .getAvailableLanguages()
                        .map((l:ILanguage)=>({type : 'menuitem',  text : l.displayName, value : l.isoCode }))
                }
            ]
        }
    }

    createOptionsTab() {
        return {
            type : 'form', title: t('beyond-options-tab-label'),
            items: [
                {type : "checkbox",  name: "checkerIsEnabled", [this.labelFieldName] : t("beyond-checker-is-enabled" ) },
                {
                    type : 'checkbox', name : "showThesaurusByDoubleClick",
                    [this.labelFieldName] :  t('beyond-double-click-shows-thesaurus')
                },
            ]
        }
    }

    createDictionaryTab( replace : boolean ) {
        let idPrefix = replace ? "replace" : "dictionary";
        let editorBlock = {
            type : "container",
            layout : "flow",
            items : <any>[]
        };

        //Editor block, entity/replace with / add inputs

        editorBlock.items.push({
            type : "container", layout : "stack", items : [
                {type : "label", text : t(`beyond-${ replace ? "replace" : "word" }-input-label`) },
                {type : "textbox" , name:`${idPrefix}-entry-textbox`, style: (replace ? "width : 177px; margin-right : 10px" : "width : 375px")}
            ]});
        
        if( replace ) {
            editorBlock.items.push({
                type : "container", layout:"stack", items : [
                    {type : "label", text : t('beyond-replace-with-input-label') },
                    {type : "textbox", name : `${idPrefix}-replace-textbox` ,style : "width : 176px" }
                ]})
        }
        
        editorBlock.items.push({
            type : "container",layout : "stack",
            items : [
                { type :"label", text:"Invisible", style:"color:transparent; user-select : none;" },
                { type: "button", text : t(`beyond-add-${replace?"replacement":"word"}-button-label`),  name : `${idPrefix}-add-button`, style : "width : 56px; margin-left : 10px; text-align: center;"}
            ]
        });
        
        //Contents
        let contentsBlock = {
            type : "container", layout : "flow",
            items : [
                { type : "container", layout : "stack", items:[
                    {type : "label", text : t(`beyond-${replace? "replacements" : "dictionary"}-contents-list-label`) },
                    {type : "container", id : `${replace?"replace":"dictionary"}-contents-container`, style:`width:385px`}
                ]},
                
                { type : "container", layout : "stack", items:[
                    { type : "label", text:"Invisible", style:"color:transparent; user-select : none;"},
                    { type : "button", name : `${idPrefix}-delete-button`, text : t(`beyond-${replace? "replacements" : "dictionary"}-delete-button-label`), style : "margin-left : 10px" }
                ]}
            ]
        };

        return {
            title: t(`beyond-${replace?"replacements":"dictionary"}-tab-label`),
            type: 'container',
            minHeight : 300,
            style : "padding : 10px 20px",
            items: [
                editorBlock,
                contentsBlock
            ]
        };
    }
    
    createAboutTab( checker : IGrammarChecker ) {
        if( this.is5 ) {
            return {
                type  : 'panel',
                title : t('beyond-about-tab-label'),
                layout : 'flow',
                items: [
                    {type  : 'htmlpanel',
                        title : t('beyond-about-tab-label'),
                        layout : 'flow',
                        html : `
                            <img src="${checker.getBrandImageUrl()}" alt="Beyond Grammar Logo" style="float: left;margin-right: 20px;"/>
                            
                            <span style="float: left;">${checker.getApplicationName()}</span>
                            <br>
                            <span style="float: left;">${checker.getApplicationVersion()}</span>
                            
                            <div style="clear: both;padding-top: 20px;">Copyright &copy; ${(new Date()).getFullYear()} <a target="_blank" style="color:blue;" href="${checker.getCopyrightUrl()}">${checker.getCopyrightUrl()}</a></div>
                            
                        ` 
                    }
                ]
            }
        } else {
            return {
                type  : 'panel',
                title : t('beyond-about-tab-label'),
                layout : 'flow',
                items: [
                    { type : 'container', layout:'stack', items:[
                            { type : 'container', layout:'flow', items:[
                                    { type : "container", style :"width : 128px; height : 128px; margin: 15px;",
                                        html : `<img src="`+checker.getBrandImageUrl()+`" alt="Beyond Grammar Logo"/>` },
                                    { type : 'container', layout:'stack', style:"padding : 10px", items:[
                                            { type : 'label', style : "margin-top : 10px", text :  checker.getApplicationName() },
                                            { type : 'label', style : "margin-top : 10px", text : `v${checker.getApplicationVersion()}` },
                                        ]}

                                ]},
                            { type : 'container',
                                html: `Copyright &copy; ${(new Date()).getFullYear()} <a target="_blank" style="color:blue;" href="${checker.getCopyrightUrl()}">${checker.getCopyrightUrl()}</a>`,
                                style:"margin-left: 10px; float : left; clear: both;"
                            }
                        ]}
                ]
            }
        
        }
    }

    get labelFieldName(){
        return this.is5 ? "label" : "text"
    }
}