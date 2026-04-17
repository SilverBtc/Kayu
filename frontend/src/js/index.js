import { VideoCapture } from './components/video-capture.js';
import { BarcodeReader } from './helpers/BarcodeReader.js';

const API_BASE_URL = 'http://localhost:3000/api/products/openfoodfacts/';
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

  VideoCapture.defineCustomElement();

  const { barcodeReaderError } = await BarcodeReader.setup();
  if (barcodeReaderError) {
    showError('Votre navigateur ne supporte pas la detection de code-barres.');
    setStatus('Scanner indisponible.');
    return;
  }

  const supportedFormats = await BarcodeReader.getSupportedFormats();
  const selectedFormats = BARCODE_FORMATS.filter(format => supportedFormats.includes(format));
  const activeFormats = selectedFormats.length > 0 ? selectedFormats : supportedFormats;

  if (activeFormats.length === 0) {
    showError('Aucun format de code-barres n est supporte sur ce navigateur.');
    setStatus('Scanner indisponible.');
    return;
  }

  barcodeReader = await BarcodeReader.create(activeFormats);
  clearError();

  videoCaptureEl.addEventListener('video-capture:video-play', () => {
    applyZoomX2(videoCaptureEl);
    // setStatus('Camera active. Placez un code-barres au centre.');
    startScanLoop();
  });

  videoCaptureEl.addEventListener('video-capture:error', evt => {
    const errorName = evt?.detail?.error?.name || '';

    if (errorName === 'NotAllowedError') {
      showError('Acces camera refuse. Autorisez la camera puis rechargez la page.');
    } else if (errorName === 'NotFoundError') {
      showError('Aucune camera detectee.');
    } else {
      showError('Impossible d initialiser la camera.');
    }

    setStatus('Camera indisponible.');
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
      setStatus('Camera active. Zoom materiel indisponible, scan en mode normal.');
      return;
    }

    const minZoom = Number(capabilities.zoom.min ?? 1);
    const maxZoom = Number(capabilities.zoom.max ?? 1);
    const targetZoom = 200 // clamp(2, minZoom, maxZoom);
    console.log(`Applying zoom: ${targetZoom} (min: ${minZoom}, max: ${maxZoom})`);
    captureEl.zoom = targetZoom;

    const zoomLabel = targetZoom === 2 ? 'x2' : `x${targetZoom.toFixed(1)}`;
    setStatus(`Camera active. Zoom ${zoomLabel}. Placez un code-barres au centre.`);
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

  async function fetchAndRenderProduct(barcodeValue) {
    clearError();
    clearProduct();
    setStatus(`Code detecte: ${barcodeValue}. Chargement des infos produit...`);

    try {
      const response = await fetch(`${API_BASE_URL}${encodeURIComponent(barcodeValue)}`);
      if (!response.ok) {
        throw new Error('API request failed');
      }

      const payload = await response.json();
      const product = payload?.data;

      if (payload?.status !== 'ok' || !product) {
        throw new Error('Invalid API response');
      }

      renderProduct(product);
      setStatus(`Infos produit chargees pour ${barcodeValue}.`);
    } catch {
      showError(`Aucune info produit trouvee pour le code ${barcodeValue}.`);
      setStatus('Scan actif. Presentez un autre code-barres.');
    }
  }

  function renderProduct(product) {
    const rows = [
      ['Nom', product.product_name_fr || product.product_name || '-'],
      ['Marque', product.brands || '-'],
      ['Quantite', product.quantity || '-'],
      ['NutriScore', normalizeGrade(product.nutriscore_grade)],
      ['NOVA', normalizeValue(product.nova_group)],
      ['EcoScore', normalizeGrade(product.ecoscore_grade)],
      ['Ingredients FR', product.ingredients_text_fr || '-']
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