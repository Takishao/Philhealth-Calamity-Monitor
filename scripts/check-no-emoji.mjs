import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// Digits, currency, ordinary punctuation and mathematical formula symbols are not emoji.
// Include common decorative symbol and arrow blocks beyond pictographic emoji.
const ranges=[[0x200d,0x200d],[0x20e3,0x20e3],[0x2190,0x21ff],[0x2300,0x23ff],[0x2460,0x27ff],[0x2b00,0x2bff],[0xfe0e,0xfe0f],[0x1f1e6,0x1f1ff],[0x00d7,0x00d7]];
const rangePattern=ranges.map(([a,b])=>String.fromCodePoint(a)+'-'+String.fromCodePoint(b)).join('');
const forbidden=new RegExp('[\\p{Extended_Pictographic}\\p{Emoji_Presentation}'+rangePattern+']','gu');
const files=execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
let checked=0,occurrences=0;const violations=[];
for(const file of new Set(files)){
 let bytes;try{bytes=readFileSync(resolve(root,file));}catch{continue;}
 if(bytes.includes(0))continue;
 let source;try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{continue;}
 checked++;
 const decoded=source.replace(/\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})/gi,(m,a,b)=>String.fromCodePoint(Number.parseInt(a||b,16)));
 const matches=[...decoded.matchAll(forbidden)];
 if(matches.length){occurrences+=matches.length;violations.push({file,count:matches.length,codepoints:[...new Set(matches.map(m=>'U+'+m[0].codePointAt(0).toString(16).toUpperCase()))]});}
}
const history=execFileSync('git',['log','--format=%B'],{cwd:root,encoding:'utf8'});const commitCount=[...history.matchAll(forbidden)].length;occurrences+=commitCount;
console.log(JSON.stringify({checkedFiles:checked,occurrences,commitMessageOccurrences:commitCount,violations},null,2));
if(occurrences)process.exitCode=1;
