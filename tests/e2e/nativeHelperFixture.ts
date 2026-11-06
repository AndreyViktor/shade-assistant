// Synthetic JSONL subprocess: exercises the real provider/parser/IPC without TCC or audio.
export const nativeHelperFixture = `
const readline = require('node:readline');
let config;
let paused = false;
let timer;
let round = 0;
const sequences = new Map();
const started = Date.now();
function emit(source, fields) {
  const seq = (sequences.get(source) || 0) + 1;
  sequences.set(source, seq);
  const timestampMs = Date.now() - started;
  process.stdout.write(JSON.stringify({version:1, sessionId:config.sessionId, source, locale:config.locale, seq, timestampMs, ...fields}) + '\\n');
}
function speak() {
  if (paused) return;
  round += 1;
  for (const source of config.sources) {
    const time = Date.now() - started;
    emit(source, {type:'final', segmentId:'s' + round, startMs:time, endMs:time, text:source === 'mic' ? 'Fala sintética do microfone.' : 'Fala sintética do sistema.'});
  }
}
readline.createInterface({input:process.stdin}).on('line', line => {
  const command = JSON.parse(line);
  if (command.type === 'start') {
    config = command;
    for (const source of config.sources) {
      emit(source, {type:'ready', supportsPartial:false});
      emit(source, {type:'status', state:'listening'});
    }
    timer = setInterval(speak, 1000);
  }
  if (command.type === 'pause' || command.type === 'resume') {
    paused = command.type === 'pause';
    for (const source of config.sources) emit(source, {type:'status', state:paused ? 'paused' : 'listening'});
  }
  if (command.type === 'stop') {
    clearInterval(timer);
    for (const source of config.sources) emit(source, {type:'stopped', reason:'completed'});
    process.exit(0);
  }
});
`;
