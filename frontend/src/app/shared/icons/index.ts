import { ARROW_LEFT } from './arrow-left.icon';
import { ARROW_RIGHT } from './arrow-right.icon';
import { CHART_LINE } from './chart-line.icon';
import { CHECK } from './check.icon';
import { CHEVRON_LEFT } from './chevron-left.icon';
import { CHEVRON_RIGHT } from './chevron-right.icon';
import { DOWNLOAD } from './download.icon';
import { EYE } from './eye.icon';
import { EYE_OFF } from './eye-off.icon';
import { FILE } from './file.icon';
import { FILE_CSS } from './file-css.icon';
import { FILE_ENV } from './file-env.icon';
import { FILE_GITIGNORE } from './file-gitignore.icon';
import { FILE_GO } from './file-go.icon';
import { FILE_HTML } from './file-html.icon';
import { FILE_IMAGE } from './file-image.icon';
import { FILE_JAVA } from './file-java.icon';
import { FILE_JS } from './file-js.icon';
import { FILE_JSON } from './file-json.icon';
import { FILE_JSX } from './file-jsx.icon';
import { FILE_LOCK } from './file-lock.icon';
import { FILE_MD } from './file-md.icon';
import { FILE_PHP } from './file-php.icon';
import { FILE_PY } from './file-py.icon';
import { FILE_RS } from './file-rs.icon';
import { FILE_SCSS } from './file-scss.icon';
import { FILE_SH } from './file-sh.icon';
import { FILE_SQL } from './file-sql.icon';
import { FILE_TOML } from './file-toml.icon';
import { FILE_TS } from './file-ts.icon';
import { FILE_TSX } from './file-tsx.icon';
import { FILE_XML } from './file-xml.icon';
import { FILE_YAML } from './file-yaml.icon';
import { FOLDER } from './folder.icon';
import { GLOBE } from './globe.icon';
import { IconDef } from './icon-def';
import { INBOX } from './inbox.icon';
import { INFO } from './info.icon';
import { LAYOUT_DASHBOARD } from './layout-dashboard.icon';
import { LOG_IN } from './log-in.icon';
import { LOG_OUT } from './log-out.icon';
import { PENCIL } from './pencil.icon';
import { PLUS } from './plus.icon';
import { SEARCH } from './search.icon';
import { SETTINGS } from './settings.icon';
import { TRASH } from './trash.icon';
import { USER } from './user.icon';
import { X } from './x.icon';

export const ICONS = {
  'arrow-left': ARROW_LEFT,
  'arrow-right': ARROW_RIGHT,
  'chart-line': CHART_LINE,
  check: CHECK,
  'chevron-left': CHEVRON_LEFT,
  'chevron-right': CHEVRON_RIGHT,
  download: DOWNLOAD,
  eye: EYE,
  'eye-off': EYE_OFF,
  file: FILE,
  // File-extension glyphs — colour-coded badge over the same outline.
  'file-css': FILE_CSS,
  'file-env': FILE_ENV,
  'file-gitignore': FILE_GITIGNORE,
  'file-go': FILE_GO,
  'file-html': FILE_HTML,
  'file-image': FILE_IMAGE,
  'file-java': FILE_JAVA,
  'file-js': FILE_JS,
  'file-json': FILE_JSON,
  'file-jsx': FILE_JSX,
  'file-lock': FILE_LOCK,
  'file-md': FILE_MD,
  'file-php': FILE_PHP,
  'file-py': FILE_PY,
  'file-rs': FILE_RS,
  'file-scss': FILE_SCSS,
  'file-sh': FILE_SH,
  'file-sql': FILE_SQL,
  'file-toml': FILE_TOML,
  'file-ts': FILE_TS,
  'file-tsx': FILE_TSX,
  'file-xml': FILE_XML,
  'file-yaml': FILE_YAML,
  folder: FOLDER,
  globe: GLOBE,
  inbox: INBOX,
  info: INFO,
  'layout-dashboard': LAYOUT_DASHBOARD,
  'log-in': LOG_IN,
  'log-out': LOG_OUT,
  pencil: PENCIL,
  plus: PLUS,
  search: SEARCH,
  settings: SETTINGS,
  trash: TRASH,
  user: USER,
  x: X,
} as const satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;
export type { IconDef } from './icon-def';

export function iconForPath(path: string): IconName {
  const slash = path.lastIndexOf('/');
  const base = slash < 0 ? path : path.slice(slash + 1);
  const lower = base.toLowerCase();

  if (lower === '.gitignore' || lower === '.gitattributes') return 'file-gitignore';
  if (lower === '.env' || lower.startsWith('.env.')) return 'file-env';
  if (lower.endsWith('-lock.json') || lower.endsWith('.lock')) return 'file-lock';

  const dot = base.lastIndexOf('.');
  if (dot < 0) return 'file';
  const ext = lower.slice(dot + 1);
  return EXT_ICON[ext] ?? 'file';
}

const EXT_ICON: Record<string, IconName> = {
  js: 'file-js',
  mjs: 'file-js',
  cjs: 'file-js',
  ts: 'file-ts',
  mts: 'file-ts',
  cts: 'file-ts',
  jsx: 'file-jsx',
  tsx: 'file-tsx',
  py: 'file-py',
  pyw: 'file-py',
  html: 'file-html',
  htm: 'file-html',
  css: 'file-css',
  scss: 'file-scss',
  sass: 'file-scss',
  less: 'file-scss',
  json: 'file-json',
  jsonc: 'file-json',
  md: 'file-md',
  markdown: 'file-md',
  mdx: 'file-md',
  yml: 'file-yaml',
  yaml: 'file-yaml',
  sh: 'file-sh',
  bash: 'file-sh',
  zsh: 'file-sh',
  fish: 'file-sh',
  sql: 'file-sql',
  rs: 'file-rs',
  go: 'file-go',
  java: 'file-java',
  kt: 'file-java',
  scala: 'file-java',
  php: 'file-php',
  xml: 'file-xml',
  svg: 'file-xml',
  toml: 'file-toml',
  ini: 'file-toml',
  cfg: 'file-toml',
  conf: 'file-toml',
  png: 'file-image',
  jpg: 'file-image',
  jpeg: 'file-image',
  gif: 'file-image',
  webp: 'file-image',
  ico: 'file-image',
  bmp: 'file-image',
  lock: 'file-lock',
};
