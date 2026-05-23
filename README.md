# ChatGPT Voyager

一个给 ChatGPT 网页端增加右侧对话锚点的本地浏览器扩展。

本扩展不调用 OpenAI API，不上传聊天内容，所有逻辑都只在当前浏览器页面里运行。

## 功能

- 在 ChatGPT 对话页面右侧生成小圆点，一个圆点对应一次用户提问。
- 鼠标悬停在圆点上显示该提问的简短预览。
- 点击圆点可跳回对应提问的位置。

## 已删除功能

从 `0.3.0` 开始，本扩展只保留右侧圆点跳转功能，已删除：

- 划选文字后的引用按钮。
- 自动把引用内容填入输入框。
- 发送消息后的滚动位置锁定。

## 安装

### 下载项目

可以直接下载 ZIP，也可以使用 Git：

```bash
git clone https://github.com/shenenda/ChatGPT-Voyager.git
```

下载后解压或进入项目目录，确保目录中能看到这些文件：

```text
manifest.json
content.js
content.css
README.md
```

### 安装到 Chrome 或 Edge

1. 打开浏览器扩展管理页面。
   - Chrome：在地址栏输入 `chrome://extensions`
   - Edge：在地址栏输入 `edge://extensions`
2. 打开右上角的 `开发者模式`。
3. 点击 `加载已解压的扩展程序`。
4. 选择本项目文件夹，也就是包含 `manifest.json` 的目录。
5. 打开或刷新 [ChatGPT](https://chatgpt.com/)。

安装成功后，只要当前对话中有用户提问，页面右侧就会出现锚点小圆点。

## 使用方法

在 ChatGPT 对话页面右侧找到小圆点：

- 悬停小圆点可以查看对应提问的预览。
- 点击小圆点可以跳回那一次提问的位置。

## 兼容性说明

当前版本优先使用 ChatGPT 网页端常见的稳定结构：

- 用户消息：`data-message-author-role="user"`
- 备用结构：带用户语义的 `article`

ChatGPT 网页端会不定期更新页面结构。如果后续右侧锚点失效，通常需要同步调整 `content.js` 里的消息选择器。

## 常见问题

### 没看到右侧小圆点

可以按下面顺序检查：

1. 确认扩展已经启用。
2. 刷新 ChatGPT 页面。
3. 确认当前页面里已经有你的提问内容。
4. 确认当前网址是 `https://chatgpt.com` 或 `https://chat.openai.com`。

### 扩展更新后没有生效

打开 `chrome://extensions` 或 `edge://extensions`，找到 `ChatGPT Voyager`，点击刷新按钮，然后重新打开 ChatGPT 页面。

## 本地测试

项目内置了一个基础 DOM 测试：

```bash
node test/basic-dom-test.js
```

也可以打开测试页面手动观察样式和交互：

```text
test/fixture.html
```
