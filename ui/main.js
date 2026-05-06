/** @type {typeof window.__TAURI__} */
const TAURI = window.__TAURI__;

// DOM 元素
const domainSelect = document.getElementById('domain');
const apiKeyInput = document.getElementById('apiKey');
const togglePasswordBtn = document.getElementById('togglePassword');
const exportBtn = document.getElementById('exportBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const progressArea = document.getElementById('progress');
const progressText = document.getElementById('progressText');
const resultArea = document.getElementById('result');
const resultText = document.getElementById('resultText');
const resultPath = document.getElementById('resultPath');
const errorArea = document.getElementById('error');
const errorText = document.getElementById('errorText');

// 密码显示/隐藏
togglePasswordBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
});

// 监听进度事件
TAURI.event.listen('export-progress', (event) => {
  const { stage, message } = event.payload;

  if (stage === 'done') return;

  progressArea.style.display = 'block';
  resultArea.style.display = 'none';
  errorArea.style.display = 'none';
  progressText.textContent = message;
});

// 导出按钮
exportBtn.addEventListener('click', async () => {
  const domain = domainSelect.value;
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showError('请输入 API Key');
    return;
  }

  // 禁用按钮，显示加载状态
  setLoading(true);
  hideAllStatus();

  try {
    const result = await TAURI.core.invoke('export_highlights', {
      domain,
      apiKey,
    });

    progressArea.style.display = 'none';
    resultArea.style.display = 'block';
    resultText.textContent =
      '\u2705 ' + result.total_articles + ' \u7BC7\u6587\u7AE0\uFF0C' +
      result.total_highlights + ' \u6761\u9AD8\u4EAE\u5DF2\u5BFC\u51FA';
    resultPath.textContent = '\u4FDD\u5B58\u4F4D\u7F6E\uFF1A' + result.file_path;
  } catch (err) {
    showError(typeof err === 'string' ? err : err.message || '导出失败');
  } finally {
    setLoading(false);
  }
});

function setLoading(loading) {
  exportBtn.disabled = loading;
  btnText.textContent = loading ? '导出中...' : '导出高亮';
  btnSpinner.style.display = loading ? 'inline-block' : 'none';
}

function hideAllStatus() {
  progressArea.style.display = 'none';
  resultArea.style.display = 'none';
  errorArea.style.display = 'none';
}

function showError(msg) {
  progressArea.style.display = 'none';
  resultArea.style.display = 'none';
  errorArea.style.display = 'block';
  errorText.textContent = msg;
}
