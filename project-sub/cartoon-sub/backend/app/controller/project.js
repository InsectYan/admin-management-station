'use strict';

const fs = require('fs');
const path = require('path');
const Controller = require('egg').Controller;
const { listVideoTemplates, videoTemplateDraft } = require('../lib/videoTemplates');
const { list: listRuns } = require('../lib/activeRuns');

function ok(ctx, data) {
  ctx.body = { code: 0, message: 'ok', data };
}
const { fail } = require('../lib/httpError');

class ProjectController extends Controller {
  async index() {
    ok(this.ctx, await this.ctx.service.project.list());
  }

  async show() {
    try {
      ok(this.ctx, await this.ctx.service.project.show(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async templates() {
    ok(this.ctx, listVideoTemplates(this.ctx.query || {}));
  }

  async template() {
    try {
      ok(this.ctx, videoTemplateDraft(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async createFromTemplate() {
    try {
      ok(this.ctx, await this.ctx.service.project.createFromTemplate(this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async create() {
    const body = this.ctx.request.body || {};
    if (!body.name) {
      this.ctx.status = 400;
      this.ctx.body = { code: 400, message: '需要项目名称', data: null };
      return;
    }
    try {
      ok(this.ctx, await this.ctx.service.project.create(body));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async update() {
    try {
      ok(this.ctx, await this.ctx.service.project.update(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async remove() {
    try {
      ok(this.ctx, await this.ctx.service.project.remove(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async novels() {
    try {
      ok(this.ctx, await this.ctx.service.project.listNovels());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async chapters() {
    try {
      ok(this.ctx, await this.ctx.service.project.listChapters(this.ctx.params.novelId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async novel() {
    try {
      ok(this.ctx, await this.ctx.service.project.novelBrief(this.ctx.params.novelId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async novelEnums() {
    try {
      ok(this.ctx, await this.ctx.service.project.novelEnums());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateNovel() {
    try {
      ok(this.ctx, await this.ctx.service.project.updateNovelBrief(this.ctx.params.novelId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async saveScriptRoster() {
    try {
      ok(this.ctx, await this.ctx.service.project.saveScriptRoster(
        this.ctx.params.id,
        this.ctx.params.importId,
        this.ctx.request.body || {},
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async assignImportWorkflow() {
    try {
      ok(this.ctx, await this.ctx.service.project.assignImportWorkflow(
        this.ctx.params.id,
        this.ctx.params.importId,
        this.ctx.request.body || {},
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async applySnapshotFields() {
    try {
      ok(this.ctx, await this.ctx.service.project.applySnapshotFields(
        this.ctx.params.id,
        this.ctx.params.importId,
        this.ctx.request.body || {},
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async novelEnums() {
    try {
      ok(this.ctx, await this.ctx.service.project.novelEnums());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateNovel() {
    try {
      ok(this.ctx, await this.ctx.service.project.updateNovelBrief(this.ctx.params.novelId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async meta() {
    ok(this.ctx, require('../lib/cartoonMeta').meta());
  }

  async addImport() {
    try {
      ok(this.ctx, await this.ctx.service.project.addImport(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeImport() {
    try {
      ok(this.ctx, await this.ctx.service.project.removeImport(this.ctx.params.id, this.ctx.params.importId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async packages() {
    try {
      ok(this.ctx, await this.ctx.service.project.listNovelPackages(this.ctx.params.novelId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async summary() {
    try {
      ok(this.ctx, await this.ctx.service.project.dashboard());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async touchNode() {
    try {
      const body = this.ctx.request.body || {};
      ok(this.ctx, await this.ctx.service.project.touchNode(this.ctx.params.id, this.ctx.params.taskId, body.current_node));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async promoteShot() {
    try {
      ok(this.ctx, await this.ctx.service.project.promoteShot(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async rebase() {
    try {
      ok(this.ctx, await this.ctx.service.project.rebase(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async pullNovel() {
    try {
      const body = this.ctx.request.body || {};
      if (!body.novel_id && !(body.package_id && body.version)) this.ctx.throw(400, '需要 novel_id');
      ok(this.ctx, await this.ctx.service.project.pullNovel(this.ctx.params.id, body));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draftSuggest() {
    try {
      ok(this.ctx, await this.ctx.service.draft.suggestScript(this.ctx.params.id, this.ctx.params.importId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draftApply() {
    try {
      ok(this.ctx, await this.ctx.service.draft.applyScript(this.ctx.params.id, this.ctx.params.importId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draftScript() {
    try {
      ok(this.ctx, await this.ctx.service.draft.suggestScript(this.ctx.params.id, this.ctx.params.importId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draftScriptApply() {
    try {
      ok(this.ctx, await this.ctx.service.draft.applyScript(this.ctx.params.id, this.ctx.params.importId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draftShotOutline() {
    try {
      ok(this.ctx, await this.ctx.service.draft.suggestShotOutline(
        this.ctx.params.id,
        this.ctx.params.importId,
        this.ctx.request.body || {},
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async clearImportShots() {
    try {
      ok(this.ctx, await this.ctx.service.project.clearImportShots(this.ctx.params.id, this.ctx.params.importId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draftShotExpand() {
    try {
      ok(this.ctx, await this.ctx.service.draft.expandShot(this.ctx.params.id, this.ctx.params.importId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async draft() {
    try {
      ok(this.ctx, await this.ctx.service.draft.run(this.ctx.params.id, this.ctx.params.importId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async addShot() {
    try {
      ok(this.ctx, await this.ctx.service.project.addShot(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async showPanel() {
    try {
      ok(this.ctx, await this.ctx.service.project.panelOf(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async savePanel() {
    try {
      ok(this.ctx, await this.ctx.service.project.savePanel(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async listCopyBlocks() {
    try {
      ok(this.ctx, await this.ctx.service.project.listCopyBlocks(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async addCopyBlock() {
    try {
      ok(this.ctx, await this.ctx.service.project.saveCopyBlock(this.ctx.params.id, null, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateCopyBlock() {
    try {
      ok(this.ctx, await this.ctx.service.project.saveCopyBlock(this.ctx.params.id, this.ctx.params.blockId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeCopyBlock() {
    try {
      await this.ctx.service.project.removeCopyBlock(this.ctx.params.id, this.ctx.params.blockId);
      ok(this.ctx, null);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async addAsset() {
    try {
      ok(this.ctx, await this.ctx.service.project.addAsset(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateAsset() {
    try {
      ok(this.ctx, await this.ctx.service.project.updateAsset(this.ctx.params.id, this.ctx.params.assetId, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async saveAssetImage() {
    try {
      ok(this.ctx, await this.ctx.service.project.saveAssetImage(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async assetImage() {
    try {
      const absolute = this.ctx.service.project.assetImagePath(this.ctx.params.id, this.ctx.params.name);
      const ext = path.extname(absolute).toLowerCase();
      this.ctx.type = ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : (ext === '.webp' ? 'webp' : 'png');
      this.ctx.body = fs.createReadStream(absolute);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async purgeShots() {
    try {
      ok(this.ctx, await this.ctx.service.project.purgeShotGroup(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async disableAsset() {
    try {
      ok(this.ctx, await this.ctx.service.project.disableAsset(this.ctx.params.id, this.ctx.params.assetId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async clearAssets() {
    try {
      ok(this.ctx, await this.ctx.service.project.clearAssets(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeAsset() {
    try {
      ok(this.ctx, await this.ctx.service.project.removeAsset(this.ctx.params.id, this.ctx.params.assetId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async saveShotAssets() {
    try {
      ok(this.ctx, await this.ctx.service.project.saveShotAssets(
        this.ctx.params.id,
        this.ctx.params.shotId,
        this.ctx.request.body || {},
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async updateShot() {
    try {
      ok(this.ctx, await this.ctx.service.project.updateShot(this.ctx.params.id, this.ctx.request.body || {}));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async saveFrame() {
    try {
      ok(this.ctx, await this.ctx.service.project.saveManualFrame(
        this.ctx.params.id,
        this.ctx.params.shotId,
        this.ctx.request.body || {},
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async frameFile() {
    try {
      await this.ctx.service.project.sendFrame(this.ctx.params.id, this.ctx.params.shotId, this.ctx.params.which);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async audioBoard() {
    try {
      ok(this.ctx, await this.ctx.service.capture.board(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async extractAudio() {
    try {
      ok(this.ctx, await this.ctx.service.capture.extract(this.ctx.params.id, this.ctx.params.shotId));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async audioFile() {
    try {
      await this.ctx.service.capture.send(this.ctx.params.id, this.ctx.params.shotId);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeShot() {
    try {
      ok(this.ctx, await this.ctx.service.project.removeShot(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async generateInputs() {
    try {
      ok(this.ctx, await this.ctx.service.generate.inputs());
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async runs() {
    try {
      const id = this.ctx.params.id;
      const tasks = await this.ctx.model.Task.findAll({
        where: { project_id: id, status: [ 'queued', 'running', 'saving' ] },
        attributes: [ 'id', 'shot_id', 'status', 'kind' ],
        order: [[ 'id', 'DESC' ]],
      });
      ok(this.ctx, {
        runs: listRuns(this.app, id),
        tasks: tasks.map(item => (item.toJSON ? item.toJSON() : item)),
      });
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async stopGenerate() {
    try {
      ok(this.ctx, await this.ctx.service.generate.stopProject(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async startAutoJob() {
    try {
      const body = this.ctx.request.body || {};
      ok(this.ctx, await this.ctx.service.autoJob.start(this.ctx.params.id, body.shot_ids));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async currentAutoJob() {
    try {
      ok(this.ctx, await this.ctx.service.autoJob.current(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async generate() {
    const kinds = [ 'image', 'video', 'i2v', 'edit', 'refmod', 't2v' ];
    const kind = kinds.includes(this.ctx.query.kind) ? this.ctx.query.kind : 'image';
    try {
      ok(this.ctx, await this.ctx.service.generate.start(
        this.ctx.params.id,
        this.ctx.params.shotId,
        this.ctx.request.body || {},
        kind,
      ));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async shellMembers() {
    try {
      const project = await this.ctx.model.Project.findByPk(this.ctx.params.id);
      if (!project) this.ctx.throw(404, '项目不存在');
      ok(this.ctx, await this.ctx.service.shellRoster.list('cartoon', project.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async outputFile() {
    try {
      await this.ctx.service.generate.sendFile(this.ctx.params.id);
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeOutput() {
    try {
      ok(this.ctx, await this.ctx.service.generate.removeOutput(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeOutputs() {
    try {
      ok(this.ctx, await this.ctx.service.generate.removeOutputs(this.ctx.request.body?.ids));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async taskWorkflow() {
    try {
      ok(this.ctx, await this.ctx.service.generate.workflowOf(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }

  async removeTask() {
    try {
      ok(this.ctx, await this.ctx.service.generate.removeTask(this.ctx.params.id));
    } catch (err) {
      fail(this.ctx, err);
    }
  }
}

module.exports = ProjectController;
