# ChatGPT Voyager

一个给 ChatGPT 网页端增加“对话锚点”和“划选引用追问”的本地浏览器扩展。它会在页面右侧生成对话锚点，方便你快速回到历史提问；也可以把页面中划选的文字整理成引用内容，手动放入 ChatGPT 输入框继续追问。

本扩展不调用 OpenAI API，不上传聊天内容，所有逻辑都只在当前浏览器页面里运行。

## 功能

- 在 ChatGPT 对话页面右侧生成小圆点，一个圆点对应一次用户提问。
- 鼠标悬停在圆点上显示该提问的简短预览。
- 点击圆点可跳回对应提问的位置。
- 在 ChatGPT 页面中划选文字后，会出现 `引用此内容进行对话` 按钮。
- 只有点击该按钮后，扩展才会把选中内容整理成引用格式并填入输入框。
- 引用内容不会自动发送，发送前仍由你自己确认。
- 通过锚点或引用追问进入上下文提问时，扩展会短暂保持当前滚动位置，避免页面立即跳到底部。

## 安装

### 下载项目

可以直接下载 ZIP，也可以使用 Git：

```bash
git clone https://github.com/<your-name>/chatgpt-voyager-extension.git
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
4. 选择本项目文件夹，也就是包含 `manifest.json` 的那个目录。
5. 打开或刷新 [ChatGPT](https://chatgpt.com/)。

安装成功后，只要当前对话中有用户提问，页面右侧就会出现锚点小圆点。

## 使用方法

### 回到某一次提问

在 ChatGPT 对话页面右侧找到小圆点：

- 悬停小圆点可以查看对应提问的预览。
- 点击小圆点可以跳回那一次提问的位置。

### 引用页面内容继续追问

1. 在 ChatGPT 的回答或页面内容中，用鼠标划选一段文字。
2. 页面会在选区附近显示 `引用此内容进行对话` 按钮。
3. 点击按钮后，扩展会把选中内容填入 ChatGPT 输入框，格式类似：

```text
> 选中的内容

请基于上面引用内容回答：
```

4. 你可以继续补充自己的问题，然后手动点击 ChatGPT 的发送按钮。

注意：单纯划选文字不会立刻改动输入框，必须点击 `引用此内容进行对话` 才会填入。

### 保持上下文位置

当你点击右侧锚点回到历史位置，或者点击引用按钮发起追问时，扩展会在你发送下一条问题后短暂保持当前滚动位置。

如果你手动滚动页面，或按下方向键、PageUp、PageDown、Home、End，扩展会立即解除滚动保持。

## 常见问题

### 没看到右侧小圆点

可以按下面顺序检查：

1. 确认扩展已经启用。
2. 刷新 ChatGPT 页面。
3. 确认当前页面里已经有你的提问内容。
4. 确认当前网址是 `https://chatgpt.com` 或 `https://chat.openai.com`。

### 划选文字后没有出现引用按钮

可能原因：

- 选中的文字太短。
- 你是在输入框内部划选文字，扩展会忽略这种情况，避免影响正常编辑。
- ChatGPT 页面结构发生变化，需要更新 `content.js` 里的选择器或编辑器写入逻辑。

### 点击引用按钮后没有填入输入框

可以先刷新 ChatGPT 页面再试一次。如果仍然无效，通常是 ChatGPT 网页端更新了输入框结构，需要调整 `findPromptEditor` 或 `setEditorText` 相关逻辑。

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

## 发布到 GitHub

如果你要把这个项目发布到自己的 GitHub 仓库，可以在项目目录中执行：

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/<your-name>/chatgpt-voyager-extension.git
git push -u origin main
```

把命令里的 `<your-name>` 换成你的 GitHub 用户名。如果仓库已经存在，只需要确认 `origin` 指向正确仓库后再推送。

## 说明

ChatGPT 网页端会不定期更新页面结构。如果后续右侧锚点或引用按钮失效，通常需要同步调整 `content.js` 里的页面选择器和输入框写入逻辑。
