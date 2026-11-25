# 小赵勇争第一

一个**纯前端、离线可用**的本地刷题 App：Web / PWA / Android WebView 封装三端共用同一套代码。内置示例题库，支持导入自定义题库，答完立刻看解析，练题记录与错题本跟着题干走。

不需要后端、不需要账号，所有数据留在浏览器本地。

## 快速开始

```bash
git clone https://github.com/zyl762363148/xiaozhao-quiz.git
cd xiaozhao-quiz
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

也可以直接双击 `index.html`。`manifest.webmanifest` + `sw.js` 提供 PWA 支持，可「添加到主屏幕」后离线使用。

### Android 封装

`android/` 是 WebView 壳工程，`android/assets/index.html` 为内置页面；`android-harmony/` 为另一套清单与入口，供 HarmonyOS 适配参考。打包前请**自备签名密钥**放到 `android/signing/`，该目录与 `*.jks` 已在 `.gitignore` 中忽略，切勿提交到仓库。

## 导入自定义题库

在 App 的「题库」页选择本地文件即可，导入流水线为：读取 → 识别 → 清洗 → 预览 → 落地。支持 CSV、Excel（xlsx）与题库 JSON，单次最多 2 万行；预览后可选择「替换现有题库」或「追加合并」。导出题库会带上练题记录，重新导入时按确定性 id 接回，错题本不会清零。

### 题库 JSON 格式

示例见 `data/bank.json`（内置 506 道示例题，含单选 187 / 判断 160 / 多选 159）：

```json
{
  "title": "题库标题",
  "subtitle": "副标题",
  "version": "1.0",
  "updatedAt": "2026-10-30",
  "questions": [
    {
      "id": "j1",
      "no": "1",
      "type": "judge",
      "stem": "题干文本",
      "answer": [true],
      "explanation": "解析与依据"
    }
  ]
}
```

`type` 取 `single`（单选）、`multiple`（多选）、`judge`（判断）；`answer` 为数组，判断题用布尔值。`data/source-bank.json` 是原始素材，`data/bank.js` 为页面直接引用的构建产物。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `index.html` / `app.js` / `styles.css` | Web 主程序 |
| `sw.js` / `manifest.webmanifest` | PWA 离线与安装 |
| `data/` | 题库 JSON 与素材 |
| `android/` / `android-harmony/` | 原生 WebView 壳 |
| `assets/` | 字体、图标与皮肤资源 |

## 参与

欢迎提 issue 与 PR，见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## License

MIT，见 [LICENSE](LICENSE)。

