
// 安全代码示例 - 使用参数化查询
const express = require('express');
const app = express();

// ✅ 使用参数化查询防止SQL注入
app.get('/user', (req, res) => {
  const userId = req.query.id;
  const query = 'SELECT * FROM users WHERE id = ?';
  db.query(query, [userId], (err) => {
    if (err) throw err;
    res.send('User data');
  });
});

// ✅ 对输出进行HTML转义防止XSS
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

app.get('/comment', (req, res) => {
  const comment = escapeHtml(req.query.comment || '');
  res.send('<div>' + comment + '</div>');
});
