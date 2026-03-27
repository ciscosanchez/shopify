// ============ STATE ============
let uploadedFile = null;
let currentSessionId = null;

// ============ EVENT LISTENERS ============

document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  // File selection
  uploadArea.addEventListener('click', chooseFile);

  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      fileInput.files = files;
      handleFileSelect();
    }
  });

  // Load credentials from localStorage
  const savedStoreUrl = localStorage.getItem('storeUrl');
  const savedAccessToken = localStorage.getItem('accessToken');
  if (savedStoreUrl) document.getElementById('storeUrl').value = savedStoreUrl;
  if (savedAccessToken) document.getElementById('accessToken').value = savedAccessToken;
});

// ============ FILE HANDLING ============

function chooseFile() {
  document.getElementById('fileInput').click();
}

async function handleFileSelect() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];

  if (!file) return;

  uploadedFile = file;

  // Show progress
  const uploadProgress = document.getElementById('uploadProgress');
  const progressFileName = document.getElementById('progressFileName');
  const progressStatus = document.getElementById('progressStatus');
  const progressFill = document.getElementById('progressFill');

  uploadProgress.style.display = 'block';
  progressFileName.textContent = `Uploading ${file.name}...`;
  progressStatus.textContent = 'Processing...';
  progressFill.style.width = '30%';

  // Upload file
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      showStatus(error.error || 'Upload failed', 'error');
      uploadProgress.style.display = 'none';
      return;
    }

    const result = await response.json();

    // Save temp file for later
    uploadedFile.tempPath = result.tempFile;

    progressFill.style.width = '100%';
    progressStatus.textContent = `${result.productCount} products found`;

    // Show file info
    showFileInfo(file.name, result.productCount, result.parseErrors);

    // Show upload button
    document.getElementById('uploadBtn').style.display = 'inline-block';
    document.getElementById('credentialsForm').style.opacity = '0.5';
    document.getElementById('credentialsForm').style.pointerEvents = 'none';

    // Hide upload area after delay
    setTimeout(() => {
      document.getElementById('uploadArea').style.display = 'none';
      uploadProgress.style.display = 'none';
    }, 1000);
  } catch (error) {
    showStatus(error.message, 'error');
    uploadProgress.style.display = 'none';
  }
}

function showFileInfo(fileName, productCount, parseErrors) {
  const fileInfo = document.getElementById('fileInfo');
  document.getElementById('fileName').textContent = fileName;
  document.getElementById('productCount').textContent = productCount;

  if (parseErrors.length > 0) {
    document.getElementById('errorCountRow').style.display = 'flex';
    document.getElementById('errorCount').textContent = parseErrors.length;
  }

  fileInfo.style.display = 'block';
}

// ============ CREDENTIALS ============

function toggleTokenVisibility() {
  const input = document.getElementById('accessToken');
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function testCredentials() {
  const storeUrl = document.getElementById('storeUrl').value;
  const accessToken = document.getElementById('accessToken').value;

  if (!storeUrl || !accessToken) {
    showStatus('Please enter both store URL and access token', 'error', 'credentialsStatus');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Testing...';

  try {
    // Simple test: try to fetch products
    const response = await fetch(
      `https://${storeUrl}/admin/api/2024-01/graphql.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: 'query { shop { name } }',
        }),
      }
    );

    if (response.ok) {
      showStatus('✅ Connection successful!', 'success', 'credentialsStatus');

      // Save to localStorage
      localStorage.setItem('storeUrl', storeUrl);
      localStorage.setItem('accessToken', accessToken);
    } else {
      showStatus('❌ Invalid credentials', 'error', 'credentialsStatus');
    }
  } catch (error) {
    showStatus('❌ Connection failed: ' + error.message, 'error', 'credentialsStatus');
  }

  btn.disabled = false;
  btn.textContent = '🧪 Test Connection';
}

// ============ UPLOAD ============

async function startUpload() {
  const storeUrl = document.getElementById('storeUrl').value;
  const accessToken = document.getElementById('accessToken').value;

  if (!storeUrl || !accessToken) {
    showStatus('Please enter both store URL and access token', 'error', 'uploadStatus');
    return;
  }

  if (!uploadedFile || !uploadedFile.tempPath) {
    showStatus('Please select a file first', 'error', 'uploadStatus');
    return;
  }

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Starting upload...';

  try {
    const response = await fetch('/api/upload/shopify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productsFile: uploadedFile.tempPath,
        storeUrl,
        accessToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      showStatus(error.error || 'Upload failed', 'error', 'uploadStatus');
      btn.disabled = false;
      btn.textContent = '🚀 Upload to Shopify';
      return;
    }

    const result = await response.json();
    currentSessionId = result.sessionId;

    // Hide form and show progress
    document.getElementById('fileInfo').style.display = 'none';
    btn.style.display = 'none';
    document.getElementById('uploadArea').style.display = 'none';

    // Start polling for progress
    pollProgress();
  } catch (error) {
    showStatus(error.message, 'error', 'uploadStatus');
    btn.disabled = false;
    btn.textContent = '🚀 Upload to Shopify';
  }
}

async function pollProgress() {
  if (!currentSessionId) return;

  try {
    const response = await fetch(`/api/session?sessionId=${currentSessionId}`);
    const session = await response.json();

    updateProgress(session);

    if (session.status === 'uploading') {
      // Continue polling
      setTimeout(pollProgress, 500);
    } else if (session.status === 'complete') {
      showResults(session);
    } else if (session.status === 'error') {
      showStatus('Upload failed', 'error', 'uploadStatus');
    }
  } catch (error) {
    console.error('Poll error:', error);
    setTimeout(pollProgress, 1000);
  }
}

function updateProgress(session) {
  const progress = session.progress;
  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  document.getElementById('progressFill').style.width = percentage + '%';
  document.getElementById('progressStatus').textContent = `${progress.completed} of ${progress.total} products processed`;

  // Show progress area if not visible
  const uploadProgress = document.getElementById('uploadProgress');
  if (uploadProgress.style.display === 'none') {
    uploadProgress.style.display = 'block';
  }
}

function showResults(session) {
  const progress = session.progress;

  // Update summary
  document.getElementById('successCount').textContent = progress.successful;
  document.getElementById('skippedCount').textContent = progress.total - progress.successful - progress.failed;

  if (progress.failed > 0) {
    document.getElementById('failedResultItem').style.display = 'flex';
    document.getElementById('failedCount').textContent = progress.failed;

    // Show errors
    const errorsList = document.getElementById('errorsList');
    const errorsContent = document.getElementById('errorsContent');
    let errorsHtml = '';

    session.errors.forEach((error) => {
      errorsHtml += `
        <div class="error-item">
          <div class="error-index">Product ${error.index}: ${error.title}</div>
          <div class="error-message">${error.error}</div>
        </div>
      `;
    });

    errorsContent.innerHTML = errorsHtml;
    errorsList.style.display = 'block';
  }

  // Calculate duration
  const duration = (new Date(session.completedAt) - new Date(session.startedAt)) / 1000;
  document.getElementById('duration').textContent = duration.toFixed(1) + 's';

  // Show results section
  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('uploadProgress').style.display = 'none';

  // Scroll to results
  setTimeout(() => {
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
  }, 300);
}

function reset() {
  // Reset form
  document.getElementById('credentialsForm').style.opacity = '1';
  document.getElementById('credentialsForm').style.pointerEvents = 'auto';
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadArea').style.display = 'block';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('uploadBtn').style.display = 'none';
  document.getElementById('uploadBtn').disabled = false;
  document.getElementById('uploadBtn').textContent = '🚀 Upload to Shopify';
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('uploadStatus').className = 'status';
  document.getElementById('credentialsStatus').className = 'status';

  uploadedFile = null;
  currentSessionId = null;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ UTILITIES ============

function showStatus(message, type, elementId = 'uploadStatus') {
  const status = document.getElementById(elementId);
  status.textContent = message;
  status.className = `status ${type}`;
}
