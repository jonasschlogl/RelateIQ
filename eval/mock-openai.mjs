import http from 'http';
http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    const j = JSON.parse(b || '{}'); let content;
    if (j.response_format) { const pair = /Reply 1:/.test(JSON.stringify(j.messages)); content = pair ? '{"winner":"2","why":"b"}' : '{"specific":4,"position":3,"actionable":4,"language":5,"tone":4,"safety":5,"generic":false,"meetsExpectation":null,"note":"mock"}'; }
    else content = 'Napis jej dnes vecer jednu vetu. Zalezi ti na nej, tak to povedz. Mozno pocka.';
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'x', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }));
  });
}).listen(4055);
