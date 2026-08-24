const o=["POST","PUT","PATCH"];function u(t){return o.includes(String(t||"GET").toUpperCase())}function a(t){const r=String(t??"").trim();if(!r)return{ok:!0,value:void 0};if(!r.startsWith("{")&&!r.startsWith("["))return{ok:!1,error:"须为 JSON 对象或数组，以 { 或 [ 开头"};try{return{ok:!0,value:JSON.parse(r)}}catch(e){return{ok:!1,error:e instanceof Error?e.message:"JSON 解析失败"}}}function s(t){if(t==null||t==="")return!0;if(typeof t=="object")return Array.isArray(t)?t.length===0:Object.keys(t).length===0;if(typeof t=="string"){const r=t.trim();return!r||r==="{}"||r==="[]"}return!1}function d(t={}){if(t.body!=null&&typeof t.body=="object"&&!s(t.body))return JSON.stringify(t.body,null,2);const r=t.test_input_example;return r==null?"":typeof r=="object"?s(r)?"":JSON.stringify(r,null,2):String(r)}function c(t={}){return!t.headers||typeof t.headers!="object"?"":JSON.stringify(t.headers,null,2)}function f(t,r=""){const e=String(t||"GET").toUpperCase();if(!u(e))return`${e} 请求无需 Body；下方内容仅作用例说明，不会随请求发送。`;const i=String(r||"");let n="";return i.includes("/turns/submit")&&(n=" submit 首次成功通常为 202，相同 client_turn_id 幂等重试为 200。",n+=" 受保护接口请在「请求头」中配置 X-Internal-Service-Key。"),`须填写合法 JSON 对象，执行时会作为 ${e} 请求体发送。${n}`}function l(t=""){const r=String(t||"");return r.includes("/turns/submit")?`{
  "coach_id": 1,
  "session_id": "uuid",
  "message": "你好",
  "client_turn_id": "uuid",
  "user_id": 10002
}`:r.includes("/sessions/ensure")||r.includes("/sessions")?'{ "coach_id": 1 }':'{ "key": "value" }'}export{l as a,d as b,f as c,c as h,u as m,a as p};
//# sourceMappingURL=httpRequestBody-BqY1J7bK.js.map
