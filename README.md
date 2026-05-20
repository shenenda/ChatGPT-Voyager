# ChatGPT Voyager

一个给 ChatGPT 网页端增加“对话锚点”“划选引用追问”和“发送后保持当前位置”的本地浏览器扩展。

本扩展不调用 OpenAI API，不上传聊天内容，所有逻辑都只在当前浏览器页面里运行。

## 功能

- 在 ChatGPT 对话页面右侧生成小圆点，一个圆点对应一次用户提问。
- 鼠标悬停在圆点上显示该提问的简短预览。
- 点击圆点可跳回对应提问的位置。
- 在 ChatGPT 页面中划选文字后，会出现 `引用此内容进行对话` 按钮。
- 只有点击该按钮后，扩展才会把选中内容整理成引用格式并填入输入框。
- 引用内容不会自动发送，发送前仍由你自己确认。
- 无论是普通输入、锚点追问，还是引用追问，只要你发送消息，页面都会保持在发送前的当前位置，避免 ChatGPT 自动滚到最底部。
- 如果你手动滚动页面，或按下方向键、PageUp、PageDown、Home、End，扩展会立即解除滚动保持。

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

### 发送后保持当前位置

在任意位置发送消息时，扩展会记录发送前的滚动位置，并在 ChatGPT 尝试自动跳到底部时把页面拉回原位。

滚动保持最多持续约 2 分钟；如果你手动滚动、触摸滚动，或按下方向键、PageUp、PageDown、Home、End，会立即解除。

## 兼容性说明

当前版本优先使用 ChatGPT 网页端常见的稳定结构：

- 用户消息：`data-message-author-role="user"`
- 输入框：`#prompt-textarea`、`textarea`、`contenteditable` 文本框
- 发送按钮：包含 `send`、`submit`、`发送` 或 `data-testid` 中包含 `send` 的按钮

ChatGPT 网页端会不定期更新页面结构。如果后续右侧锚点、引用按钮或发送后保持位置失效，通常需要同步调整 `content.js` 里的页面选择器和输入框写入逻辑。

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

### 发送后仍然跳到底部

可以先确认扩展已经刷新并重新加载 ChatGPT 页面。如果仍然发生，通常是 ChatGPT 改了发送按钮或输入框结构，需要更新 `handlePotentialSendClick`、`handlePotentialSendKeydown` 或 `handlePotentialSubmit` 相关逻辑。

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
