import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { execFileSync,spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
test('guard rejects literal and escaped pictographs and decorative arrows in files and commits',()=>{
 const dir=mkdtempSync(join(tmpdir(),'philhealth-icon-check-'));
 try{
 execFileSync('git',['init','-q',dir]);execFileSync('git',['-C',dir,'config','user.email','test@example.invalid']);execFileSync('git',['-C',dir,'config','user.name','Test']);
 const script=readFileSync(resolve('scripts/check-no-emoji.mjs'),'utf8');
 // Rebase checker root to this isolated fixture repository, without changing the real project.
 const fixture=script.replace("resolve(dirname(fileURLToPath(import.meta.url)),'..')",JSON.stringify(dir));const check=join(dir,'check.mjs');writeFileSync(check,fixture);
 writeFileSync(join(dir,'plain.txt'),'Icons with visible text');execFileSync('git',['-C',dir,'add','.']);execFileSync('git',['-C',dir,'commit','-qm','Plain commit']);assert.equal(spawnSync(process.execPath,[check]).status,0);
 writeFileSync(join(dir,'bad.txt'),String.fromCodePoint(0x26a0)+String.fromCodePoint(0x2192)+'\\'+'u{1f600}');let result=spawnSync(process.execPath,[check],{encoding:'utf8'});assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).occurrences,3);
 rmSync(join(dir,'bad.txt'));execFileSync('git',['-C',dir,'commit','--allow-empty','-qm',String.fromCodePoint(0x1f600)]);result=spawnSync(process.execPath,[check],{encoding:'utf8'});assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).commitMessageOccurrences,1);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
