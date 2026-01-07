/* eslint-env browser */

/**
 * i18next Initialization
 * Internationalization support for ITSM-Sec Nexus
 */

// Import i18next from CDN (loaded via script tag in index.html)
// This file provides initialization and helper functions

const I18N_STORAGE_KEY = 'itsm_language';
const DEFAULT_LANGUAGE = 'ja';
const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN'];

// Language names for display
const LANGUAGE_NAMES = {
  ja: '日本語',
  en: 'English',
  'zh-CN': '简体中文'
};

/**
 * Initialize i18next with locale resources
 */
async function initI18n() {
  // Load translation resources
  const resources = {};

  // Load all language files
  for (const lang of SUPPORTED_LANGUAGES) {
    try {
      const response = await fetch(`./frontend/locales/${lang}.json`);
      if (response.ok) {
        const translations = await response.json();
        resources[lang] = {
          translation: translations
        };
      } else {
        console.warn(`Failed to load ${lang} translations`);
      }
    } catch (error) {
      console.error(`Error loading ${lang} translations:`, error);
    }
  }

  // Get saved language or detect from browser
  const savedLanguage = localStorage.getItem(I18N_STORAGE_KEY);
  const browserLanguage = navigator.language || navigator.userLanguage;
  let initialLanguage = savedLanguage || DEFAULT_LANGUAGE;

  // Auto-detect browser language
  if (!savedLanguage) {
    if (browserLanguage.startsWith('ja')) {
      initialLanguage = 'ja';
    } else if (browserLanguage.startsWith('zh')) {
      initialLanguage = 'zh-CN';
    } else if (browserLanguage.startsWith('en')) {
      initialLanguage = 'en';
    }
  }

  // Initialize i18next
  await i18next.init({
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    debug: false,
    resources,
    interpolation: {
      escapeValue: false // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  });

  console.log(`i18next initialized with language: ${initialLanguage}`);
  return i18next;
}

/**
 * Change current language
 * @param {string} lang - Language code (ja, en, zh-CN)
 */
function changeLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn(`Unsupported language: ${lang}`);
    return;
  }

  i18next.changeLanguage(lang, (err) => {
    if (err) {
      console.error('Error changing language:', err);
      return;
    }

    // Save to localStorage
    localStorage.setItem(I18N_STORAGE_KEY, lang);

    // Update page content
    updatePageContent();

    // Trigger custom event for other components to update
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));

    console.log(`Language changed to: ${lang}`);
  });
}

/**
 * Get current language
 * @returns {string} Current language code
 */
function getCurrentLanguage() {
  return i18next.language || DEFAULT_LANGUAGE;
}

/**
 * Translate key with optional parameters
 * @param {string} key - Translation key (e.g., 'common.welcome')
 * @param {object} params - Optional interpolation parameters
 * @returns {string} Translated string
 */
function t(key, params = {}) {
  return i18next.t(key, params);
}

/**
 * Update all page content with current translations
 */
function updatePageContent() {
  // Update elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    const translation = t(key);

    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      // Update placeholder for input fields
      if (element.hasAttribute('placeholder')) {
        element.placeholder = translation;
      } else {
        element.value = translation;
      }
    } else {
      // Update text content for other elements
      element.textContent = translation;
    }
  });

  // Update elements with data-i18n-html attribute (for HTML content)
  document.querySelectorAll('[data-i18n-html]').forEach((element) => {
    const key = element.getAttribute('data-i18n-html');
    const translation = t(key);
    element.innerHTML = translation;
  });

  // Update document title
  const titleKey = document.documentElement.getAttribute('data-i18n-title');
  if (titleKey) {
    document.title = t(titleKey);
  }
}

/**
 * Create language switcher UI element
 * @returns {HTMLElement} Language switcher element
 */
function createLanguageSwitcher() {
  const container = document.createElement('div');
  container.className = 'language-switcher';
  container.style.cssText = `
    display: inline-flex;
    gap: 8px;
    align-items: center;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
  `;

  const label = document.createElement('span');
  label.textContent = '🌐';
  label.style.fontSize = '16px';

  const select = document.createElement('select');
  select.className = 'language-select';
  select.style.cssText = `
    padding: 4px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-size: 13px;
    outline: none;
  `;

  // Add language options
  SUPPORTED_LANGUAGES.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = LANGUAGE_NAMES[lang];
    if (lang === getCurrentLanguage()) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  // Handle language change
  select.addEventListener('change', (e) => {
    changeLanguage(e.target.value);
  });

  container.appendChild(label);
  container.appendChild(select);

  return container;
}

/**
 * Format date according to current locale
 * @param {Date|string|number} date - Date to format
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatDate(date, options = {}) {
  const dateObj = date instanceof Date ? date : new Date(date);
  const lang = getCurrentLanguage();

  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };

  try {
    return new Intl.DateTimeFormat(lang, defaultOptions).format(dateObj);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format number according to current locale
 * @param {number} number - Number to format
 * @param {object} options - Intl.NumberFormat options
 * @returns {string} Formatted number string
 */
function formatNumber(number, options = {}) {
  const lang = getCurrentLanguage();

  try {
    return new Intl.NumberFormat(lang, options).format(number);
  } catch (error) {
    console.error('Error formatting number:', error);
    return number.toString();
  }
}

/**
 * Get language direction (ltr or rtl)
 * @returns {string} 'ltr' or 'rtl'
 */
function getLanguageDirection() {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  const currentLang = getCurrentLanguage();
  return rtlLanguages.includes(currentLang) ? 'rtl' : 'ltr';
}

// Export functions to global scope
if (typeof window !== 'undefined') {
  window.i18nInit = initI18n;
  window.changeLanguage = changeLanguage;
  window.getCurrentLanguage = getCurrentLanguage;
  window.t = t;
  window.updatePageContent = updatePageContent;
  window.createLanguageSwitcher = createLanguageSwitcher;
  window.formatDate = formatDate;
  window.formatNumber = formatNumber;
  window.getLanguageDirection = getLanguageDirection;
  window.SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES;
  window.LANGUAGE_NAMES = LANGUAGE_NAMES;
}
