'use strict';
const path = require('node:path');
const readline = require('node:readline');
const {openDatabase,passwordHash} = require('./database.cjs');
function secret(prompt) {
  if(!process.stdin.isTTY) throw new Error('Ejecuta la configuración desde una terminal interactiva.');
  process.stdout.write(prompt);
  readline.emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function done(){process.stdin.off('keypress',key);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}
    function key(text,event){
      if(event.ctrl && event.name==='c'){done();reject(new Error('Configuración cancelada.'));}
      else if(event.name==='return'){done();resolve(value);}
      else if(event.name==='backspace')value=value.slice(0,-1);
      else if(text && !event.ctrl && !event.meta)value+=text;
    }
    process.stdin.on('keypress',key);
  });
}
(async()=>{
  const password=await secret('Nueva contraseña (mínimo 12 caracteres; no se mostrará): ');
  if(password.length<12 || password.length>200)throw new Error('Usa entre 12 y 200 caracteres.');
  if(password!==await secret('Repite la contraseña: '))throw new Error('Las contraseñas no coinciden.');
  const db=openDatabase(path.resolve(process.env.DATA_DIR || path.join(__dirname,'../data')));
  db.prepare("INSERT INTO settings VALUES('admin_password',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(passwordHash(password));
  db.exec('DELETE FROM sessions'); db.close(); console.log('Contraseña configurada. Las sesiones anteriores se cerraron.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
