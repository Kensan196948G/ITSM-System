/**
 * DOM Utility Functions (XSS Safe)
 * XSS対策済みのDOM操作関数
 */

/**
 * Create element with properties and children
 * @param {string} tag - HTML tag name
 * @param {object} props - Element properties
 * @param {Array<Node>} children - Child elements
 * @returns {HTMLElement}
 */
export function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);

  // Set properties (XSS safe)
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'textContent') {
      el.textContent = value; // XSS safe
    } else if (key === 'className') {
      el.className = value;
    } else if (key === 'style') {
      if (typeof value === 'string') {
        el.style.cssText = value;
      } else {
        Object.assign(el.style, value);
      }
    } else {
      el.setAttribute(key, value);
    }
  });

  // Append children
  children.forEach((child) => {
    if (child instanceof Node) {
      el.appendChild(child);
    } else if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    }
  });

  return el;
}

/**
 * Clear all children of an element
 * @param {HTMLElement} el - Element to clear
 */
export function clearElement(el) {
  if (el && el.nodeType === Node.ELEMENT_NODE) {
    el.innerHTML = ''; // Safe for clearing
  }
}

/**
 * Set text content safely (XSS safe)
 * @param {HTMLElement} el - Element
 * @param {string} text - Text content
 */
export function setText(el, text) {
  if (el && el.nodeType === Node.ELEMENT_NODE) {
    el.textContent = text; // XSS safe
  }
}

/**
 * Create badge element
 * @param {string} text - Badge text
 * @param {string} variant - Badge variant (success, warning, danger, info)
 * @returns {HTMLElement}
 */
export function createBadge(text, variant = 'info') {
  const variantStyles = {
    success: 'background: #dcfce7; color: #166534; border: 1px solid #86efac;',
    warning: 'background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;',
    danger: 'background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;',
    info: 'background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;',
    default: 'background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;'
  };

  const badge = createEl('span', {
    textContent: text,
    style: `
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      ${variantStyles[variant] || variantStyles.default}
    `
  });

  return badge;
}

/**
 * Create explanation section (NIST CSF等で使用)
 * @param {string} meaning - 意味
 * @param {string} necessity - 必要性
 * @returns {HTMLElement}
 */
export function createExplanationSection(meaning, necessity) {
  const section = createEl('div', {
    style: 'margin-top: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;'
  });

  const meaningTitle = createEl('h4', {
    textContent: '意味',
    style: 'margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1e293b;'
  });

  const meaningText = createEl('p', {
    textContent: meaning,
    style: 'margin: 0 0 16px 0; font-size: 13px; color: #475569; line-height: 1.6;'
  });

  const necessityTitle = createEl('h4', {
    textContent: '必要性',
    style: 'margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #1e293b;'
  });

  const necessityText = createEl('p', {
    textContent: necessity,
    style: 'margin: 0; font-size: 13px; color: #475569; line-height: 1.6;'
  });

  section.appendChild(meaningTitle);
  section.appendChild(meaningText);
  section.appendChild(necessityTitle);
  section.appendChild(necessityText);

  return section;
}

/**
 * Create loading spinner
 * @param {string} message - Loading message
 * @returns {HTMLElement}
 */
export function createLoadingSpinner(message = '読み込み中...') {
  const container = createEl('div', {
    style: 'text-align: center; padding: 48px;'
  });

  const spinner = createEl('div', {
    style: `
      display: inline-block;
      width: 40px;
      height: 40px;
      border: 4px solid rgba(59, 130, 246, 0.3);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spin 1s linear infinite;
    `
  });

  const text = createEl('p', {
    textContent: message,
    style: 'margin-top: 16px; color: #64748b; font-size: 14px;'
  });

  container.appendChild(spinner);
  container.appendChild(text);

  return container;
}

/**
 * Create error message
 * @param {string} message - Error message
 * @returns {HTMLElement}
 */
export function createErrorMessage(message) {
  return createEl('div', {
    textContent: message,
    style: `
      padding: 16px;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      border-radius: 8px;
      color: #991b1b;
      font-size: 14px;
    `
  });
}

// Backward compatibility: グローバル変数として公開（非推奨）
if (typeof window !== 'undefined') {
  window.createEl = createEl;
  window.clearElement = clearElement;
  window.setText = setText;
  window.createBadge = createBadge;
  window.createExplanationSection = createExplanationSection;
  console.warn('DOM Utilities: グローバル変数は非推奨です。import を使用してください');
}
