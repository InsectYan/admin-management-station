import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

function pagerBox(el) {
  if (!el) return null;
  if (el.classList.contains('el-pagination') || el.classList.contains('cartoon-pager') || el.classList.contains('cartoon-output-pager')) {
    return el;
  }
  return el.querySelector?.('.el-pagination, .cartoon-pager, .cartoon-output-pager') || null;
}

function tailHeight(el) {
  const next = el.nextElementSibling;
  const pager = pagerBox(next);
  if (!pager) return 8;
  return pager.offsetHeight + 16;
}

function inMultiTable(el) {
  const host = el.closest('.cartoon-voice, .cartoon-pipeline');
  return Boolean(host && host.querySelectorAll('.el-table').length > 1);
}

const TABLE_METHODS = [
  'clearSelection',
  'getSelectionRows',
  'getHalfSelectionRows',
  'toggleRowSelection',
  'toggleAllSelection',
  'toggleRowExpansion',
  'setCurrentRow',
  'clearSort',
  'clearFilter',
  'doLayout',
  'sort',
  'scrollTo',
  'setScrollTop',
  'setScrollLeft',
  'updateKeyChildren',
];

export function installFitTable(app) {
  const Original = app.component('ElTable');
  if (!Original) return;
  app.component('ElTable', defineComponent({
    name: 'ElTable',
    inheritAttrs: false,
    setup(_, { attrs, slots, expose }) {
      const root = ref(null);
      const api = {};
      TABLE_METHODS.forEach(name => {
        api[name] = (...args) => root.value?.[name]?.(...args);
      });
      expose(api);
      const maxHeight = ref(null);
      let observer;
      const onResize = () => measure();

      function rootEl() {
        const inst = root.value;
        if (!inst) return null;
        return inst.$el || inst;
      }

      function measure() {
        const el = rootEl();
        if (!el || typeof el.getBoundingClientRect !== 'function') return;
        const explicit = attrs.maxHeight ?? attrs['max-height'];
        if (explicit != null && explicit !== '') return;
        if (!el.isConnected || !el.closest('.cartoon-sub-root')) return;
        if (el.closest('.el-dialog, .el-drawer, .el-overlay, .el-popper')) return;
        if (el.offsetParent === null) return;
        if (inMultiTable(el)) {
          if (maxHeight.value != null) maxHeight.value = null;
          return;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width < 40) return;
        const page = el.closest('.cartoon-page, .cartoon-overview, .cartoon-workbench__main, .cartoon-sub-content');
        const pageBottom = page ? page.getBoundingClientRect().bottom : window.innerHeight;
        const limit = Math.min(window.innerHeight - 8, pageBottom - 4);
        const next = Math.floor(limit - rect.top - tailHeight(el));
        if (next < 120) return;
        if (maxHeight.value == null || Math.abs(maxHeight.value - next) > 2) maxHeight.value = next;
      }

      onMounted(() => {
        nextTick(measure);
        const el = rootEl();
        if (typeof ResizeObserver !== 'undefined' && el) {
          observer = new ResizeObserver(() => measure());
          observer.observe(el);
          const page = el.closest('.cartoon-page, .cartoon-overview, .cartoon-workbench__main, .cartoon-sub-content');
          if (page) observer.observe(page);
        }
        window.addEventListener('resize', onResize);
      });
      onBeforeUnmount(() => {
        observer?.disconnect();
        window.removeEventListener('resize', onResize);
      });

      return () => h(Original, {
        ...attrs,
        ref: root,
        maxHeight: maxHeight.value ?? attrs.maxHeight ?? attrs['max-height'],
      }, slots);
    },
  }));
}
