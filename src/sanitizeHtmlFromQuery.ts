export function sanitizeHtmlFromQuery( query : string, html : string ) : string {
    let $ = require('jquery');
    let $pseudo = $(`<div>${html}</div>`);
    let $items = $( $pseudo.find(query).get().reverse() );
    $items.contents().unwrap();
    return $pseudo.html();
}