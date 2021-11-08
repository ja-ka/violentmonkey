// ==UserScript==
// @name        Download documents from postbox - ing.de
// @namespace   https://github.com/ja-ka/violentmonkey
// @match       https://banking.ing.de/app/postbox
// @grant       GM_download
// @require     https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @require     https://cdn.jsdelivr.net/combine/npm/@violentmonkey/dom@1,npm/@violentmonkey/ui@0.5
// @version     1.0
// @author      Jascha Kanngießer
// @description Places a button "Alle herunterladen" next to "Alle archivieren" and downloads all documents visible on the page.
// @icon        https://www.ing.de/frontendassets/ing-cms-ui/v67.1.0/assets/favicons/favicon-32x32.png
// @run-at      document-end
// @downloadURL https://github.com/ja-ka/violentmonkey/ing-postbox-download-all.js
// @supportURL  https://github.com/ja-ka/violentmonkey
// @homepageURL https://github.com/ja-ka/violentmonkey
// ==/UserScript==

const NAME = "Alle herunterladen";

const download = async (url, name) => new Promise((res, rej) => {
  GM_download({ url, name, onprogress: (progress) => {
    if (progress.status === 200) {
      res();
    }
  }, onerror: rej, onabort: rej, ontimeout: rej });
});

let abort = false;
let loading = false;

(function () {
    $(document).ready(function () {
      $('.content-header__button-wrapper--lg').after(VM.createElement("button", {
        className: "content-header__button gap-left-1",
        style: {
          borderRadius: "6px",
          fontSize: "14px",
          fontSize: ".875rem",
          lineHeight: "20px",
          padding: "7px 14px 6px",
        },
        onClick: async function() {
          if (loading) {
            abort = true;
            return;
          }
          
          loading = true;
          
          try {
            let downloaded = 0;
            const rows = $('div.ibbr-table-row');
            
            const setProgress = () => {
              downloaded += 1;
              this.innerHTML = `${downloaded} / ${rows.length} verarbeitet (erneut klicken um abzubrechen)`;
            };

            const downloads = 
              rows
                .map(function () {
                  const name = $(this).find('> span.ibbr-table-cell > span')
                    .map(function () {
                      return $(this).text().trim().replace(/[^A-Za-z0-9]/g, '_').replace('/\n/g', '');
                    })
                    .get()
                    .join('_') + ".pdf";

                  const url = "https://banking.ing.de/app" + $(this).find('a:contains(Download)').first().attr('href').substring(1);
                  return { url, name };
                })
                .get();
            
            for (const d of downloads) {
              if (abort) {
                break;  
              }
              
              await download(d.url, d.name);
              setProgress();
            }
          } catch (err) {
            console.log(err.stack);
            alert("Es ist ein Fehler aufgetreten.");
          }
          
          abort = false;
          loading = false;
          this.innerHTML = NAME;
        }
      }, NAME));
    })
  })();
  