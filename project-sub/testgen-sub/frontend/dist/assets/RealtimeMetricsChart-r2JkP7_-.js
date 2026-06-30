import{_}from"./_plugin-vue_export-helper-DlAUqK2U.js";import{w as g,o as y,v as $,c as w,g as M,n as k}from"./index-B5E7cHLQ.js";const R={__name:"RealtimeMetricsChart",props:{metrics:{type:Array,default:()=>[]},field:{type:String,default:"responseTime"},title:{type:String,default:"响应时间 (ms)"}},setup(v){const t=v,d=k(null);function n(){const s=d.value;if(!s)return;const o=t.metrics||[];if(!o.length){s.innerHTML='<div class="testgen-metrics-empty">暂无指标数据</div>';return}const r=o.map(i=>Number(i[t.field])||0),f=Math.max(...r,1),p=s.clientWidth||400,h=160,e=24,u=p-e*2,c=h-e*2,x=r.map((i,a)=>{const l=e+a/Math.max(r.length-1,1)*u,m=e+c-i/f*c;return`${l},${m}`});s.innerHTML=`
    <svg width="${p}" height="${h}" class="testgen-metrics-svg">
      <text x="${e}" y="14" class="testgen-metrics-title">${t.title}</text>
      <polyline fill="none" stroke="#409eff" stroke-width="2" points="${x.join(" ")}" />
      ${r.map((i,a)=>{const l=e+a/Math.max(r.length-1,1)*u,m=e+c-i/f*c;return`<circle cx="${l}" cy="${m}" r="3" fill="#409eff" />`}).join("")}
    </svg>
  `}return g(()=>t.metrics,n,{deep:!0}),g(()=>t.field,n),y(()=>{n(),window.addEventListener("resize",n)}),$(()=>{window.removeEventListener("resize",n)}),(s,o)=>(w(),M("div",{ref_key:"chartRef",ref:d,class:"testgen-metrics-chart"},null,512))}},H=_(R,[["__scopeId","data-v-442716d1"]]);export{H as R};
//# sourceMappingURL=RealtimeMetricsChart-r2JkP7_-.js.map
