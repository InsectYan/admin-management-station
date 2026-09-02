export function routeAfterDispatch(result = {}) {
  const novelId = result.novel_id;
  if (novelId == null) return null;
  const planSession = result.plan_session_id ? String(result.plan_session_id) : '';
  if (result.tab === 7 || result.feature_key === 'chapter') {
    const query = { tab: '7', ai: '1' };
    if (result.chapter_id) query.chapter = String(result.chapter_id);
    if (planSession) query.plan_session = planSession;
    return {
      name: 'novel-detail',
      params: { id: String(novelId) },
      query,
    };
  }
  const query = {
    id: String(novelId),
    step: String(result.step || 1),
    ai: '1',
  };
  if (planSession) query.plan_session = planSession;
  return {
    name: 'novel-create',
    query,
  };
}
