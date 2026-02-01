let selectedMethod = 'prometheus';
const inputScript = document.getElementById('input-script');
const outputScript = document.getElementById('output-script');
const inputCount = document.getElementById('input-count');
const outputCount = document.getElementById('output-count');
const obfuscateBtn = document.getElementById('obfuscate-btn');
const uploadInputBtn = document.getElementById('upload-input-btn');
const uploadInputFile = document.getElementById('upload-input-file');
const downloadOutputBtn = document.getElementById('download-output-btn');

const clearBtn = document.getElementById('clear-btn');
const statusMessage = document.getElementById('status-message');

document.querySelectorAll('.obf-option').forEach(option => {
  option.addEventListener('click', () => {
    document.querySelectorAll('.obf-option').forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');
    selectedMethod = option.dataset.method;
    showStatus(`Selected: ${option.querySelector('.obf-option-title').textContent}`, 'info');
  });
});

inputScript.addEventListener('input', () => {
  const count = inputScript.value.length;
  inputCount.textContent = `${count.toLocaleString()} characters`;
});

outputScript.addEventListener('input', () => {
  const count = outputScript.value.length;
  outputCount.textContent = `${count.toLocaleString()} characters`;
});

let isObfuscating = false;

async function obfuscateOnServer({ method, script, preset = 'Medium' }) {
  const filename = `input-${Date.now()}.lua`;
  const res = await fetch('/api/obfuscate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, preset, filename, script })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || data.success !== true || typeof data.script !== 'string') {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(msg || 'Obfuscation failed');
  }
  return data.script;
}

obfuscateBtn.addEventListener('click', async () => {
  const input = inputScript.value.trim();
  
  if (!input) {
    showStatus('⚠️ Please enter a script to obfuscate', 'error');
    return;
  }

  if (isObfuscating) {
    showStatus('⏳ An obfuscation is already in progress...', 'info');
    return;
  }

  isObfuscating = true;
  obfuscateBtn.disabled = true;
  obfuscateBtn.textContent = 'Obfuscating...';
  showStatus('📤 Uploading script and starting obfuscation...', 'info');

  try {
    const obfuscatedScript = await obfuscateOnServer({ method: selectedMethod, script: input, preset: 'Medium' });
    outputScript.value = obfuscatedScript;
    const count = obfuscatedScript.length;
    outputCount.textContent = `${count.toLocaleString()} characters`;
    showStatus('✅ Script obfuscated successfully!', 'success');
  } catch (error) {
    console.error('Obfuscation error:', error);
    showStatus(`❌ Error: ${error.message}`, 'error');
    outputScript.value = '';
  } finally {
    isObfuscating = false;
    obfuscateBtn.disabled = false;
    obfuscateBtn.textContent = 'Obfuscate Script';
  }
});

const copyOutputIconBtn = document.getElementById('copy-output-icon-btn');
const openOutputBtn = document.getElementById('open-output-btn');

copyOutputIconBtn.addEventListener('click', () => {
  const output = outputScript.value;
  if (!output) { showStatus('⚠️ No output to copy', 'error'); return; }
  navigator.clipboard.writeText(output).then(() => {
    showStatus('✅ Copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Copy failed:', err);
    showStatus('❌ Failed to copy', 'error');
  });
});

openOutputBtn.addEventListener('click', () => {
  const output = outputScript.value.trim();
  if (!output) { showStatus('⚠️ No output to open', 'error'); return; }
  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(()=> URL.revokeObjectURL(url), 60000);
});

clearBtn.addEventListener('click', () => {
  if (inputScript.value || outputScript.value) {
    inputScript.value = '';
    outputScript.value = '';
    inputCount.textContent = '0 characters';
    outputCount.textContent = '0 characters';
    showStatus('🗑️ Cleared all content', 'info');
  }
});

// Upload input (from file)
uploadInputBtn.addEventListener('click', () => {
  uploadInputFile.click();
});

uploadInputFile.addEventListener('change', () => {
  const file = uploadInputFile.files && uploadInputFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    inputScript.value = String(reader.result || '');
    const count = inputScript.value.length;
    inputCount.textContent = `${count.toLocaleString()} characters`;
    showStatus(`📥 Loaded: ${file.name}`, 'success');
    sendHeight();
  };
  reader.onerror = () => showStatus('❌ Failed to read file', 'error');
  reader.readAsText(file);
  uploadInputFile.value = '';
});

// Download output (to file)
downloadOutputBtn.addEventListener('click', () => {
  const output = outputScript.value.trim();
  if (!output) {
    showStatus('⚠️ No output to download', 'error');
    return;
  }
  const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'obfuscated.lua';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showStatus('⬇️ Download started', 'success');
});

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message show ${type}`;
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 4000);
}

function sendHeight() {
  const height = Math.max(600, document.body.scrollHeight);
  window.parent.postMessage({ type: 'obfuscatorHeight', height }, '*');
}

window.addEventListener('load', sendHeight);
window.addEventListener('resize', sendHeight);
new ResizeObserver(sendHeight).observe(document.body);
