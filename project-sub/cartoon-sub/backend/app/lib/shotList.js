'use strict';

/** 镜头页、预览、合成用的顺序。镜头编号仍按创建时的 sort_order 分配。 */
const LIST_ORDER = [[ 'list_order', 'ASC' ], [ 'id', 'ASC' ]];

function listOrder() {
  return LIST_ORDER;
}

function neighborWhere(Op, shot, direction) {
  const order = Number(shot?.list_order) || 0;
  const id = Number(shot?.id) || 0;
  const cmp = direction === 'before' ? Op.lt : Op.gt;
  return {
    [Op.or]: [
      { list_order: { [cmp]: order } },
      { list_order: order, id: { [cmp]: id } },
    ],
  };
}

function neighborOrder(direction) {
  const dir = direction === 'before' ? 'DESC' : 'ASC';
  return [[ 'list_order', dir ], [ 'id', dir ]];
}

function compareShots(a, b) {
  const list = (Number(a?.list_order) || 0) - (Number(b?.list_order) || 0);
  if (list) return list;
  return (Number(a?.id) || 0) - (Number(b?.id) || 0);
}

module.exports = {
  listOrder,
  neighborWhere,
  neighborOrder,
  compareShots,
};
