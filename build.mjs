import { cp, mkdir, rm } from 'node:fs/promises';

const files=['index.html','styles.css','engine.js','game.js','manifest.webmanifest','sw.js','icon.svg','icon-maskable.svg','robots.txt','.nojekyll'];
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of files) await cp(file,'dist/'+file);
console.log('Built '+files.length+' application files in dist/.');
