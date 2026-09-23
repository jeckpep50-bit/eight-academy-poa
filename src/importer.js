import readXlsxFile from 'read-excel-file/browser';
import JSZip from 'jszip';

function parseDelimited(text) {
  const first = text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0];
  const delimiter = ['\t',';',','].sort((a,b) => first.split(b).length-first.split(a).length)[0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i+1] === '"') { cell+='"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === delimiter || char === '\n' || char === '\r')) {
      row.push(cell); cell='';
      if (char !== delimiter) {
        if (char === '\r' && text[i+1] === '\n') i++;
        if (row.some(value => String(value).trim())) rows.push(row);
        row=[];
      }
    } else cell+=char;
  }
  row.push(cell);
  if (row.some(value => String(value).trim())) rows.push(row);
  return rows;
}

function xmlText(node) {
  return [...node.getElementsByTagName('*')]
    .filter(child => child.localName === 't')
    .map(child => child.textContent).join('');
}

async function docx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('El documento Word no contiene texto legible.');
  const xml = new DOMParser().parseFromString(await xmlFile.async('text'),'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('El archivo Word está dañado.');
  const tables = [...xml.getElementsByTagName('*')].filter(node => node.localName === 'tbl');
  const sheets = tables.map((table,index) => ({
    name:`Tabla ${index+1}`,
    rows:[...table.children].filter(node => node.localName === 'tr').map(row =>
      [...row.children].filter(node => node.localName === 'tc').map(xmlText))
  })).filter(sheet => sheet.rows.length);
  const text = [...xml.getElementsByTagName('*')].filter(node => node.localName === 'p')
    .map(xmlText).filter(Boolean).join('\n');
  return {sheets,text};
}

async function pptx(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const names = Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+[.]xml$/.test(name))
    .sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
  if (!names.length) throw new Error('La presentación no contiene diapositivas legibles.');
  const lines=[];
  for (const name of names) {
    const xml = new DOMParser().parseFromString(await zip.file(name).async('text'),'application/xml');
    const paragraphs=[...xml.getElementsByTagName('*')].filter(node => node.localName === 'p');
    lines.push(...paragraphs.map(xmlText).filter(Boolean));
  }
  return {sheets:[],text:lines.join('\n')};
}

async function pdf(file) {
  const pdfjs = await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({data,isEvalSupported:false});
  const document = await task.promise;
  const pages=[];
  try {
    for (let number=1;number<=Math.min(document.numPages,100);number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      let line='', lastY=null;
      const lines=[];
      for (const item of content.items) {
        if (!item.str) continue;
        const y=item.transform?.[5];
        if (lastY != null && Math.abs(y-lastY)>3) { lines.push(line); line=''; }
        line += (line ? ' ' : '')+item.str;
        lastY=y;
      }
      if (line) lines.push(line);
      pages.push(lines.join('\n'));
    }
  } finally { await task.destroy(); }
  return {sheets:[],text:pages.join('\n')};
}

export async function extractFile(file) {
  if (file.size > 20*1024*1024) throw new Error('El archivo supera 20 MB; divídelo antes de importarlo.');
  const extension=file.name.split('.').pop().toLowerCase();
  if (extension === 'xlsx') {
    const sheets=await readXlsxFile(file);
    return {sheets:sheets.slice(0,30).map(({sheet,data})=>({name:sheet,rows:data})),text:''};
  }
  if (extension === 'csv' || extension === 'tsv') return {sheets:[{name:'Datos',rows:parseDelimited(await file.text())}],text:''};
  if (extension === 'docx') return docx(file);
  if (extension === 'pptx') return pptx(file);
  if (extension === 'pdf') return pdf(file);
  if (extension === 'txt') return {sheets:[],text:await file.text()};
  throw new Error('Formato no admitido. Convierte .xls/.doc/.ppt o archivos de iWork a .xlsx/.docx/.pptx o PDF.');
}
