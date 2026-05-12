
const MONACO_BASE = '/assets/monaco/';
const MONACO_VS = `${MONACO_BASE}vs`;

type MonacoNamespace = typeof import('monaco-editor');

declare global {
  interface Window {
    require?: AmdRequire;
    MonacoEnvironment?: {
      getWorkerUrl?: (workerId: string, label: string) => string;
      baseUrl?: string;
    };
    monaco?: MonacoNamespace;
  }
}

interface AmdRequire {
  (modules: string[], cb: () => void): void;
  config?: (cfg: { paths: Record<string, string> }) => void;
}

let monacoModulePromise: Promise<MonacoNamespace> | null = null;


export function loadMonaco(): Promise<MonacoNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Monaco requires a browser environment.'));
  }
  if (window.monaco) return Promise.resolve(window.monaco);
  if (monacoModulePromise) return monacoModulePromise;

  monacoModulePromise = (async () => {

    window.MonacoEnvironment = { baseUrl: MONACO_BASE };

    if (!window.require) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `${MONACO_VS}/loader.js`;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () =>
          reject(new Error('Failed to load Monaco AMD loader.'));
        document.head.appendChild(script);
      });
    }

    const amdRequire = window.require;
    if (!amdRequire) throw new Error('Monaco AMD loader not available.');

    amdRequire.config?.({ paths: { vs: MONACO_VS } });

    return new Promise<MonacoNamespace>((resolve) => {
      amdRequire(['vs/editor/editor.main'], () => {
        resolve(window.monaco as MonacoNamespace);
      });
    });
  })();

  return monacoModulePromise;
}
