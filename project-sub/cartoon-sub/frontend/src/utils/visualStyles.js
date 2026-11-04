export function groupVisualStyles(styles = []) {
  const groups = [];
  const index = new Map();
  for (const item of styles) {
    const group = item.group || '其他';
    if (!index.has(group)) {
      const row = { label: group, options: [] };
      index.set(group, row);
      groups.push(row);
    }
    index.get(group).options.push(item);
  }
  return groups;
}

export function styleDisplayLabel(styles, value) {
  return styles.find(item => item.value === value)?.label || value || '—';
}
