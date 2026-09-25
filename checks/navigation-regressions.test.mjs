import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

for(const variant of ['light','pro']) test(`${variant} builder exports a standalone, escaped document`,()=>{
 const fields={};
 const get=id=>fields[id]??=( {value:id==='name'?'<script>alert(1)</script>':'Test',type:'text',checked:true,addEventListener(){}} );
 const context=vm.createContext({document:{getElementById:get},URL,Blob,setTimeout(){}});
 vm.runInContext(readFileSync(new URL(`../tools/website-builder-${variant}/builder.js`,import.meta.url),'utf8'),context);
 const output=vm.runInContext(variant==='pro'?'html()':'page(data())',context);
 assert.match(output,/<!doctype html>/i);
 assert.match(output,/&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(output,/<script\b/i,'export must not inherit IANS scripts or terminate its host script');
 assert.doesNotMatch(output,/\/assets\/js\//);
});

test('kids savings can be loaded on pages without the kids form',()=>{
 const events={};
 const context=vm.createContext({document:{querySelector(){return null;}},window:{addEventListener(n,fn){events[n]=fn;}},Intl});
 vm.runInContext(readFileSync(new URL('../tools/money-planner/assets/js/kids-savings.js',import.meta.url),'utf8'),context);
 assert.doesNotThrow(()=>events.DOMContentLoaded());
 assert.doesNotThrow(()=>events['moneyplanner:language']());
});
