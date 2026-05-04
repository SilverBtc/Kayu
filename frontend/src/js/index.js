import { VideoCapture } from './components/video-capture.js';
import { BarcodeReader } from './helpers/BarcodeReader.js';

const API_BASE_URL = 'https://translations-attorney-parliamentary-improvements.trycloudflare.com/api';
const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'code_128', 'code_39'];
const SCAN_INTERVAL_MS = 700;

(async function init() {
  const videoCaptureEl = document.getElementById('videoCapture');
  const statusEl = document.getElementById('status');
  const errorEl = document.getElementById('error');
  const barcodeValueEl = document.getElementById('barcodeValue');
  const productCardEl = document.getElementById('productCard');
  const productImageEl = document.getElementById('productImage');
  const productDetailsEl = document.getElementById('productDetails');

  let barcodeReader = null;
  let scanTimeoutId = null;
  let lastDetectedCode = '';
  let pageIsClosing = false;

  const authLink = document.getElementById('authLink');
  const token = localStorage.getItem('token');
  
  if (token && authLink) {
    authLink.textContent = 'Log out';
    authLink.href = '#';
    authLink.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      window.location.reload();
    });
  }

  VideoCapture.defineCustomElement();

  const { barcodeReaderError } = await BarcodeReader.setup();
  if (barcodeReaderError) {
    showError('Your browser does not support barcode detection.');
    setStatus('Scanner unavailable.');
    return;
  }

  const supportedFormats = await BarcodeReader.getSupportedFormats();
  const selectedFormats = BARCODE_FORMATS.filter(format => supportedFormats.includes(format));
  const activeFormats = selectedFormats.length > 0 ? selectedFormats : supportedFormats;

  if (activeFormats.length === 0) {
    showError('No barcode format is supported on this browser.');
    setStatus('Scanner unavailable.');
    return;
  }

  barcodeReader = await BarcodeReader.create(activeFormats);
  clearError();

  videoCaptureEl.addEventListener('video-capture:video-play', () => {
    applyZoomX2(videoCaptureEl);
    // setStatus('Camera active. Place a barcode in the center.');
    startScanLoop();
  });

  videoCaptureEl.addEventListener('video-capture:error', evt => {
    const errorName = evt?.detail?.error?.name || '';

    if (errorName === 'NotAllowedError') {
      showError('Camera access denied. Allow camera access, then reload the page.');
    } else if (errorName === 'NotFoundError') {
      showError('No camera detected.');
    } else {
      showError('Unable to initialize the camera.');
    }

    setStatus('Camera unavailable.');
    stopScanLoop();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopScanLoop();
      videoCaptureEl.stopVideoStream?.();
      return;
    }

    if (document.visibilityState === 'visible') {
      videoCaptureEl.startVideoStream?.();
      startScanLoop();
    }
  });

  window.addEventListener('beforeunload', () => {
    pageIsClosing = true;
    stopScanLoop();
    videoCaptureEl.stopVideoStream?.();
  });

  function applyZoomX2(captureEl) {
    const capabilities = captureEl.getTrackCapabilities?.();
    if (!capabilities?.zoom) {
      setStatus('Camera active. Hardware zoom unavailable, scanning in normal mode.');
      return;
    }

    const minZoom = Number(capabilities.zoom.min ?? 1);
    const maxZoom = Number(capabilities.zoom.max ?? 1);
    const targetZoom = 200 // clamp(2, minZoom, maxZoom);
    console.log(`Applying zoom: ${targetZoom} (min: ${minZoom}, max: ${maxZoom})`);
    captureEl.zoom = targetZoom;

    const zoomLabel = targetZoom === 2 ? 'x2' : `x${targetZoom.toFixed(1)}`;
    setStatus(`Camera active. Zoom ${zoomLabel}. Place a barcode in the center.`);
  }

  function startScanLoop() {
    if (pageIsClosing || !barcodeReader) {
      return;
    }

    stopScanLoop();
    scanLoop();
  }

  function stopScanLoop() {
    if (scanTimeoutId != null) {
      clearTimeout(scanTimeoutId);
      scanTimeoutId = null;
    }
  }

  async function scanLoop() {
    if (pageIsClosing || !barcodeReader) {
      return;
    }

    try {
      const videoEl = videoCaptureEl.shadowRoot?.querySelector('video');
      if (!videoEl) {
        throw new Error('Video stream not ready');
      }

      const barcode = await barcodeReader.detect(videoEl);
      const barcodeValue = (barcode?.rawValue || '').trim();

      if (barcodeValue.length > 0 && barcodeValue !== lastDetectedCode) {
        lastDetectedCode = barcodeValue;
        barcodeValueEl.textContent = barcodeValue;
        await fetchAndRenderProduct(barcodeValue);
      }
    } catch {
      // No barcode in this frame, continue scanning.
    } finally {
      scanTimeoutId = window.setTimeout(scanLoop, SCAN_INTERVAL_MS);
    }
  }

  // Form listener
  document.getElementById('form').addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const barcodeValue = document.getElementById('barcode').value;
    console.log(barcodeValue);
    await fetchAndRenderProduct(barcodeValue);
  });

  async function fetchAndRenderProduct(barcodeValue) {
    clearError();
    clearProduct();
    setStatus(`Code detected: ${barcodeValue}. Loading product info...`);

    try {
      const response = await fetch(`${API_BASE_URL}/products/openfoodfacts/${encodeURIComponent(barcodeValue)}`);
      if (!response.ok) {
        throw new Error('API request failed');
      }

      const payload = await response.json();
      const product = payload?.data;

      if (payload?.status !== 'ok' || !product) {
        throw new Error('Invalid API response');
      }

      renderProduct(product);
      setStatus(`Product info loaded for ${barcodeValue}.`);
      
      // Save scan to history if authenticated
      if (token) {
        try {
          const productName = product.product_name_fr || product.product_name || null;
          await fetch(`${API_BASE_URL}/scans`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ barcode: barcodeValue, product_name: productName })
          });
        } catch (e) {
          console.error('Error while saving scan history', e);
        }
      }

    } catch {
      showError(`No product info found for code ${barcodeValue}.`);
      setStatus('Scan active. Show another barcode.');
    }
  }

  function renderProduct(product) {
    const rows = [
      ['Name', product.product_name_fr || product.product_name || '-'],
      ['Brand', product.brands || '-'],
      ['Quantity', product.quantity || '-'],
      ['NutriScore', normalizeGrade(product.nutriscore_grade)],
      ['NOVA', normalizeValue(product.nova_group)],
      ['EcoScore', normalizeGrade(product.ecoscore_grade)],
      ['Ingredients EN', product.ingredients_text_en || product.ingredients_text || '-']
    ];

    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;

      const dd = document.createElement('dd');
      dd.textContent = value;

      productDetailsEl.append(dt, dd);
    });

    if (typeof product.image_front_url === 'string' && product.image_front_url.trim().length > 0) {
      productImageEl.src = product.image_front_url;
      productImageEl.removeAttribute('hidden');
    }

    productCardEl.removeAttribute('hidden');
  }

  function clearProduct() {
    productDetailsEl.replaceChildren();
    productImageEl.removeAttribute('src');
    productImageEl.setAttribute('hidden', '');
    productCardEl.setAttribute('hidden', '');
  }

  function normalizeValue(value) {
    if (value == null || value === '') {
      return '-';
    }

    return String(value);
  }

  function normalizeGrade(value) {
    if (value == null || value === '') {
      return '-';
    }

    return typeof value === 'string' ? value.toUpperCase() : String(value);
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.removeAttribute('hidden');
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.setAttribute('hidden', '');
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();