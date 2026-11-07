import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

function tailHeight(el) {
  const next = el.nextElementSibling;
  if (!next) return 8;
  if (next.classList.contains('el-pagination') || next.classList.contains('cartoon-pager')) {
    return next.offsetHeight + 16;
  }
  return 8;
}

export function installFitTable(app) {
  const Original = app.component('ElTable');
  if (!Original) return;
  app.component('ElTable', defineComponent({
    name: 'ElTable',
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const root = ref(null);
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
