/**
 * Pure HTML Template Loader & Data Binding Engine
 * Implements Option 2: Client-side dynamic fetch of isolated .html template files
 * with 1-way and 2-way data binding and action dispatchers.
 */

// Cache of loaded templates
const templateCache: Map<string, string> = new Map();

/**
 * Fetch HTML template from /templates/<name>.html with caching
 */
export async function loadHtmlTemplate(templateName: string, bypassCache = false): Promise<string> {
  if (!bypassCache && templateCache.has(templateName)) {
    return templateCache.get(templateName)!;
  }

  try {
    const response = await fetch(`/templates/${templateName}.html`);
    if (!response.ok) {
      throw new Error(`Failed to load template ${templateName}: HTTP ${response.status}`);
    }
    const html = await response.text();
    templateCache.set(templateName, html);
    return html;
  } catch (error) {
    console.error(`Error loading HTML template ${templateName}:`, error);
    throw error;
  }
}

/**
 * Clear template cache
 */
export function clearTemplateCache() {
  templateCache.clear();
}

/**
 * Resolve nested object property (e.g. "track.title" -> obj.track.title)
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, part) => (acc !== undefined && acc !== null ? acc[part] : undefined), obj);
}

/**
 * Set nested object property (e.g. "config.gain_scale" -> obj.config.gain_scale = val)
 */
function setNestedValue(obj: any, path: string, value: any): void {
  if (!obj || !path) return;
  const parts = path.split('.');
  const last = parts.pop()!;
  const target = parts.reduce((acc, part) => {
    if (!acc[part]) acc[part] = {};
    return acc[part];
  }, obj);
  target[last] = value;
}

export interface DataBindingOptions {
  data: Record<string, any>;
  actions?: Record<string, (e: Event, element: HTMLElement) => void>;
  onDataChange?: (path: string, newValue: any) => void;
}

/**
 * Render raw HTML and bind data & events to DOM elements
 */
export function bindTemplate(
  container: HTMLElement,
  htmlMarkup: string,
  options: DataBindingOptions
): { update: (newData: Record<string, any>) => void; destroy: () => void } {
  // 1. Inject pure HTML into container
  container.innerHTML = htmlMarkup;

  let currentData = { ...options.data };
  const eventCleanups: Array<() => void> = [];

  // 2. Perform initial binding
  function syncBindings(data: Record<string, any>) {
    currentData = { ...data };

    // Find all elements with data-bind
    const boundElements = container.querySelectorAll<HTMLElement>('[data-bind]');
    boundElements.forEach((el) => {
      const propPath = el.getAttribute('data-bind');
      if (!propPath) return;

      const val = getNestedValue(currentData, propPath);
      if (val === undefined) return;

      if (el instanceof HTMLInputElement) {
        if (el.type === 'checkbox') {
          el.checked = Boolean(val);
        } else if (el.type === 'range' || el.type === 'number' || el.type === 'text' || el.type === 'password') {
          if (el.value !== String(val)) {
            el.value = String(val);
          }
        }
      } else if (el instanceof HTMLSelectElement) {
        el.value = String(val);
      } else if (el instanceof HTMLTextAreaElement) {
        el.value = String(val);
      } else {
        // Standard text content
        el.textContent = String(val);
      }
    });

    // Special bindings: data-bind-style, data-bind-class
    const styleElements = container.querySelectorAll<HTMLElement>('[data-bind-style]');
    styleElements.forEach((el) => {
      const stylePath = el.getAttribute('data-bind-style');
      if (!stylePath) return;
      const styleVal = getNestedValue(currentData, stylePath);
      if (typeof styleVal === 'object' && styleVal !== null) {
        Object.assign(el.style, styleVal);
      }
    });
  }

  // 3. Attach actions & event listeners
  if (options.actions) {
    const actionElements = container.querySelectorAll<HTMLElement>('[data-action]');
    actionElements.forEach((el) => {
      const actionName = el.getAttribute('data-action');
      if (!actionName || !options.actions![actionName]) return;

      const handler = (e: Event) => {
        options.actions![actionName](e, el);
      };

      // Determine appropriate event
      let eventType = 'click';
      if (el instanceof HTMLInputElement && (el.type === 'range' || el.type === 'number' || el.type === 'text')) {
        eventType = 'input';
      } else if (el instanceof HTMLSelectElement) {
        eventType = 'change';
      }

      el.addEventListener(eventType, handler);
      eventCleanups.push(() => el.removeEventListener(eventType, handler));
    });
  }

  // 4. Two-way data binding for input elements
  const inputElements = container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-bind]');
  inputElements.forEach((inputEl) => {
    const propPath = inputEl.getAttribute('data-bind');
    if (!propPath) return;

    const changeHandler = (e: Event) => {
      let newVal: any;
      if (inputEl instanceof HTMLInputElement) {
        if (inputEl.type === 'checkbox') {
          newVal = inputEl.checked;
        } else if (inputEl.type === 'number' || inputEl.type === 'range') {
          newVal = parseFloat(inputEl.value);
        } else {
          newVal = inputEl.value;
        }
      } else {
        newVal = inputEl.value;
      }

      setNestedValue(currentData, propPath, newVal);
      if (options.onDataChange) {
        options.onDataChange(propPath, newVal);
      }
    };

    inputEl.addEventListener('input', changeHandler);
    inputEl.addEventListener('change', changeHandler);
    eventCleanups.push(() => {
      inputEl.removeEventListener('input', changeHandler);
      inputEl.removeEventListener('change', changeHandler);
    });
  });

  // Run initial sync
  syncBindings(currentData);

  return {
    update: (newData: Record<string, any>) => syncBindings(newData),
    destroy: () => {
      eventCleanups.forEach((cleanup) => cleanup());
      container.innerHTML = '';
    },
  };
}
