const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

// 从环境变量中获取目录和端口
const QUOTA_PATH = process.env.QUOTA_PATH;
const PORT = process.env.PORT || 3000;

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// 查询余额接口
app.get('/balance', (req, res) => {
    const userName = req.query.userName;

    if (!userName) {
        res.status(400).send({ error: 'Missing userName parameter' });
        return;
    }

    const filePath = path.join(QUOTA_PATH, userName);

    // 读取用户余额
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.status(404).send({ error: 'User not found' });
            } else {
                res.status(500).send({ error: 'File read error', details: err.message });
            }
        } else {
            res.send({ balance: data.trim() });
        }
    });
});

// 更新余额接口
app.post('/balance', (req, res) => {
    const userName = req.body.userName;
    const newQuota = req.body.newQuota;

    if (!userName || !newQuota || isNaN(Number(newQuota))) {
        res.status(400).send({ error: 'Missing or invalid parameters' });
        return;
    }

    const filePath = path.join(QUOTA_PATH, userName);
    
    // 写入新余额
    fs.writeFile(filePath, newQuota, (err) => {
        if (err) {
            res.status(500).send({ error: 'File write error', details: err.message });
        } else {
            res.send({ message: 'Balance updated successfully' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

