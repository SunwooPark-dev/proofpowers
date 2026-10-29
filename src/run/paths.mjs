import * as path from 'node:path';

// Windows relative() returns an absolute path across drives; never print that path.
export function relativeDisplayPath(root,file,paths=path){
 const relative=paths.relative(root,file);
 return (paths.isAbsolute(relative)||!relative?paths.basename(file):relative).replaceAll('\\','/');
}
