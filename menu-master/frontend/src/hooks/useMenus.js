import { useEffect, useState } from 'react';
import { fetchMenus, fetchRootMenus } from '../services/menuService.js';

export function useMenus() {
  const [menus, setMenus] = useState([]);
  const [rootMenus, setRootMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [tree, roots] = await Promise.all([fetchMenus(), fetchRootMenus()]);
        if (!cancelled) {
          setMenus(tree);
          setRootMenus(roots);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || '加载菜单失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { menus, rootMenus, loading, error };
}
