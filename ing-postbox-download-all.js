// ==UserScript==
// @name        Download documents from postbox - ing.de
// @namespace   https://github.com/ja-ka/violentmonkey
// @match       https://banking.ing.de/app/postbox/postbox*
// @match       https://banking.ing.de/app/postbox/postbox_archiv*
// @grant       GM_getValue
// @grant       GM_setValue
// @require     https://cdn.jsdelivr.net/npm/jquery@3/dist/jquery.min.js
// @require     https://cdn.jsdelivr.net/combine/npm/@violentmonkey/dom@1,npm/@violentmonkey/ui@0.5
// @version     1.8
// @author      Jascha Kanngießer
// @description Places a button "Alle herunterladen" next to "Alle archivieren" and downloads all documents visible on the page.
// @icon        https://www.ing.de/favicon-32x32.png
// @run-at      document-end
// @downloadURL https://raw.githubusercontent.com/ja-ka/violentmonkey/master/ing-postbox-download-all.js
// @supportURL  https://github.com/ja-ka/violentmonkey
// @homepageURL https://github.com/ja-ka/violentmonkey
// ==/UserScript==

(function () {
  $(document).ready(function () {
    const NAME = "Alle herunterladen";    

    const download = async (url, name) => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      await new Promise((r) => setTimeout(r, 200));
    };

    let abort = false;
    let loading = false;
    const FILENAME_TEMPLATE_KEY = "FILENAME_TEMPLATE";
    const USE_ORIGINAL_FILENAME_KEY = "USE_ORIGINAL_FILENAME";
    let filenameTemplate = GM_getValue(FILENAME_TEMPLATE_KEY, "DD.MM.YYYY_ART_BETREFF");
    let useOriginalFilename = GM_getValue(USE_ORIGINAL_FILENAME_KEY, false);
    
    const addButton = (name, onClick) => {
      $('.account-filters').after(VM.createElement("button", {
        className: "content-header__button gap-left-1",
        style: {
          borderRadius: "6px",
          fontSize: "14px",
          fontSize: ".875rem",
          lineHeight: "20px",
          padding: "7px 14px 6px",
          margin: "0px",
          marginBottom: "25px",
          marginRight: "10px"
        },
        onClick
      }, name));  
    }
    
    const addCheckbox = (label, checked, onChange) => {
      const container = VM.createElement("div", {
        style: {
          marginBottom: "15px",
          marginRight: "10px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px"
        }
      });
      
      const checkbox = VM.createElement("input", {
        type: "checkbox",
        checked: checked,
        style: {
          cursor: "pointer"
        },
        onChange: (e) => onChange(e.target.checked)
      });
      
      const labelElement = VM.createElement("label", {
        style: {
          cursor: "pointer",
          fontSize: "14px",
          userSelect: "none"
        },
        onClick: () => {
          checkbox.checked = !checkbox.checked;
          onChange(checkbox.checked);
        }
      }, label);
      
      container.appendChild(checkbox);
      container.appendChild(labelElement);
      $('.account-filters').after(container);
    }
    
    addCheckbox("Original-Dateinamen verwenden", useOriginalFilename, (checked) => {
      useOriginalFilename = checked;
      GM_setValue(USE_ORIGINAL_FILENAME_KEY, checked);
    });
    
    addButton("Dateinamen ändern", async function(event) {
      event.preventDefault()
      const newFilenameTemplate = prompt("Bitte gib ein Dateiname-Template ein:", filenameTemplate);
      
      if (newFilenameTemplate === null) {
        return;
      }
      
      if (!['DD', 'MM', 'YYYY', 'ART', 'BETREFF'].every((curr) => {
        return newFilenameTemplate.includes(curr);
      })) {
        alert('Bitte gib ein Template nach folgendem Muster ein: DD.MM.YYYY_ART_BETREFF');
        return;
      }
      
      GM_setValue(FILENAME_TEMPLATE_KEY, newFilenameTemplate);
      filenameTemplate = newFilenameTemplate;
    });     
    
    addButton(NAME, async function(event) {
      event.preventDefault()
      if (loading) {
        abort = true;
        return;
      }

      loading = true;

      try {
        let downloaded = 0;
        const rows = $('.ibbr-table-body div.ibbr-table-row');

        const setProgress = () => {
          downloaded += 1;
          this.innerHTML = `${downloaded} / ${rows.length} verarbeitet (erneut klicken um abzubrechen)`;
        };

        const downloads = 
          rows
            .map(function() {
              const nameSegments = $(this).find('> span.ibbr-table-cell:not(:last)')
                .map(function() {
                  return $(this).text().trim().replace(/[^A-Za-z0-9ÄÖÜäöüß]/g, '_').replace('/\n/g', '');
                })
                .get();

              const url = "https://banking.ing.de/app/postbox" + $(this).find('a:contains(Download)').first().attr('href').substring(1);
              
              let name;
              if (useOriginalFilename) {
                // Extract original filename from URL
                const urlParts = url.split('/');
                const originalFilename = decodeURIComponent(urlParts[urlParts.length - 1]);
                name = originalFilename;
              } else {
                name = `${filenameTemplate
                  .replace('DD', nameSegments[2].split('_')[0])
                  .replace('MM', nameSegments[2].split('_')[1])
                  .replace('YYYY', nameSegments[2].split('_')[2])
                  .replace('ART', nameSegments[0])
                  .replace('BETREFF', nameSegments[1])}.pdf`;
              }

              return { url, name };
            })
            .get();

        for (const d of downloads) {
          if (abort) {
            break;  
          }

          setProgress();
          await download(d.url, d.name);
        }
      } catch (err) {
        alert("Es ist ein Fehler aufgetreten.", err);
      }

      abort = false;
      loading = false;
      this.innerHTML = NAME;
    });    
  })
})();
