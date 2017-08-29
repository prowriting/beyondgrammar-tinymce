import {ILanguage} from "./ILanguage";
import {IGrammarCheckerSettings} from "./IGrammarCheckerSettings";
import {IServiceSettings} from "./IServiceSettings";

export class DictionaryEntry {
    Id : string;
    Word : string;
    Replacement ?: string;
}

export interface IGrammarCheckerConstructor{
    new ( element : HTMLElement, serviceSettings : IServiceSettings, grammarCheckerSettings ?: IGrammarCheckerSettings ): IGrammarChecker;
}

export interface IGrammarChecker {
    init() : Promise<void>;

    activate();
    deactivate();
    isActivated();
    
    checkAll() : void;
    
    clearMarks(): void;
    reloadMarks(): void;

    setSettings(settings: IGrammarCheckerSettings): void;
    getSettings(): IGrammarCheckerSettings;

    getAvailableLanguages(): ILanguage[];
    getApplicationName() : string;
    getApplicationVersion() : string;
    getVersionedApplicationName() : string;
    getCopyrightUrl() : string;
    getBrandImageUrl() : string;

    addToDictionary( word : string, replacement ?: string ) : Promise<DictionaryEntry[]>;
    removeFromDictionary( id : string ) : Promise<any>;
    getDictionaryEntries() : Promise<DictionaryEntry[]>;
}