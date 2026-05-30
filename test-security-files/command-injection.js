
// 命令注入漏洞示例
const { exec } = require('child_process');
const http = require('http');

http.createServer((req, res) => {
  const query = new URL(req.url, 'http://localhost').searchParams;
  const userCommand = query.get('cmd');
  
  // 用户输入直接拼接到命令执行，存在命令注入风险
  console.log('Executing command: ls -la ' + userCommand);
  exec('ls -la ' + userCommand, (error) => {
    if (error) throw error;
    res.end('Listing completed');
  });
}).listen(3002);
