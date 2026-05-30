
// SQL注入漏洞示例
const express = require('express');
const app = express();

app.get('/user', (req, res) => {
  const userId = req.query.id; 
  const query = 'SELECT * FROM users WHERE id = ' + userId; // SQL注入风险
  console.log('Executing unsafe query:', query);
  // 此处会执行用户提供的任意SQL代码
  db.query(query, (err) => {
    if (err) throw err;
    res.send('User data');
  });
});
