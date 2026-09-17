'use strict';

module.exports = app => {
  const { router, controller, middleware } = app;
  const adminAuth = middleware.adminAuth();

  router.get('/api/health', controller.health.index);
  router.post('/api/auth/register', controller.auth.register);
  router.post('/api/auth/login', controller.auth.login);
  router.post('/api/auth/login/mfa', controller.auth.loginMfa);
  router.post('/api/auth/logout', controller.auth.logout);
  router.get('/api/auth/me', controller.auth.me);
  router.put('/api/auth/github-token', controller.auth.saveGithubToken);
  router.delete('/api/auth/github-token', controller.auth.clearGithubToken);
  router.get('/api/auth/github-token', controller.auth.githubCredential);
  router.get('/api/internal/github-credential', controller.auth.internalGithubCredential);
  router.post('/api/auth/password', controller.auth.changePassword);
  router.post('/api/auth/mfa/setup', controller.auth.mfaSetup);
  router.post('/api/auth/mfa/confirm', controller.auth.mfaConfirm);
  router.post('/api/auth/mfa/disable', controller.auth.mfaDisable);
  router.get('/api/users', adminAuth, controller.user.index);
  router.patch('/api/users/:id', adminAuth, controller.user.update);
  router.post('/api/users/:id/reset-password', adminAuth, controller.user.resetPassword);
  router.post('/api/users/:id/mfa/disable', adminAuth, controller.user.disableMfa);
  router.get('/api/audit-logs', adminAuth, controller.audit.index);
  router.get('/api/menus', controller.menu.index);
  router.get('/api/menus/root', controller.menu.root);
  router.get('/api/llm/profiles', controller.llm.profiles);
  router.get('/api/media/profiles', controller.media.profiles);
  router.post('/api/menus', adminAuth, controller.menu.create);
  router.put('/api/menus/:id', adminAuth, controller.menu.update);
  router.delete('/api/menus/:id', adminAuth, controller.menu.destroy);
};
