'use strict';

/** X-02：项目变量 extract 不会被 loadGlobalRequestContext 注入 */
const EXTRACT_RUNTIME_NOTE =
  '注意：项目全局变量 source=extract 运行时不会自动注入，仅 manual / 环境 fixed_params / 前置 extract 可用。';

module.exports = { EXTRACT_RUNTIME_NOTE };
