export interface FileTypeBadge {
  readonly color: string;
  readonly label: string;
  readonly textColor?: string;
}

const PAGE_OUTLINE =
  '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z"/>' +
  '<polyline points="14 3 14 9 20 9"/>';

export function fileIconBody(badge: FileTypeBadge): string {
  const len = badge.label.length;
  const fontSize = len <= 2 ? 7.5 : len === 3 ? 5.5 : 4.5;
  const baselineY = len <= 2 ? 18.7 : 18.4;
  const textColor = badge.textColor ?? '#ffffff';
  return (
    PAGE_OUTLINE +
    `<rect x="4" y="13" width="13" height="7" rx="1" fill="${badge.color}" stroke="none"/>` +
    `<text x="10.5" y="${baselineY}" font-size="${fontSize}" font-weight="800" ` +
    `text-anchor="middle" fill="${textColor}" stroke="none" ` +
    `font-family="ui-sans-serif, system-ui, sans-serif">${badge.label}</text>`
  );
}
