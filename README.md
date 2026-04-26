# nihon_class

个人日语单词练习 Web 应用。支持 4 种练习方向:

- **汉字 → 假名**: 看日语汉字,写假名读音
- **假名 → 汉字**: 看假名读音,写汉字
- **日 → 中**: 看日语,写中文意思
- **中 → 日**: 看中文,写日语
- **混合**: 以上四种随机

错题本按方向独立追踪,答错即入,连续答对 2 次自动移出。

## 开发

```bash
npm install
cp .env.example .env            # 填入 APP_PASSWORD 和 AUTH_SECRET
npm run dev
```

访问 `http://localhost:3000`。首次启动会自动从 `seed/words.csv` 导入词库。

## 测试

```bash
npm test
```

## 更换词库

用自己的 CSV 替换 `seed/words.csv`,格式:

```csv
japanese,kana,chinese,group_key
食べる,たべる,吃,た行
```

- `japanese`、`chinese` 必填
- `kana` 可空(纯假名词填写时留空即可,相关方向会自动跳过)
- `group_key` 可选

然后删除数据库重启:

```bash
rm -f data/app.sqlite
npm run dev
```

## 部署到 VPS

```bash
scp -r . user@vps:~/nihon_class
ssh user@vps
cd ~/nihon_class
cp .env.example .env  # 填入真实密码
docker compose up -d --build
```

访问 `http://<vps-ip>:3000`。建议前置 HTTPS 反代。

### 备份

```bash
scp user@vps:~/nihon_class/data/app.sqlite ./backup/app-$(date +%F).sqlite
```
