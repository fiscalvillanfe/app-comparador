// ===== Helpers
const $  = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);

const els = {
  // entradas
  btnSinEntradas: $("#btnSinEntradas"), sinEntradas: $("#sinEntradas"), infoSinEntradas: $("#infoSinEntradas"),
  btnZipEntradas: $("#btnZipEntradas"), zipEntradas: $("#zipEntradas"), infoZipEntradas: $("#infoZipEntradas"),
  sumSinEntradas: $("#sumSinEntradas"), sumZipEntradas: $("#sumZipEntradas"),
  tbOnlyXmlEnt: $("#tbOnlyXmlEnt"), tbCommonEnt: $("#tbCommonEnt"),
  resumoTop: $("#resumoTop"),
  // reports
  btnOpenReport: $("#btnOpenReport"), modal: $("#modalReport"),
  reportName: $("#reportName"), reportOk: $("#reportOk"), reportCancel: $("#reportCancel"),
  toast: $("#toast"), loader: $("#loader"),
  dzSin: $("#dzSin"), dzZip: $("#dzZip")
};

const state = { sinEnt: null, zipEnt: null };

// ===== Segurança leve: bloquear copy/paste e seleção geral
(function hardenCopy(){
  function isAllowedTarget(t){
    return t.closest(".allow-copy") || t.tagName === "INPUT" || t.tagName === "TEXTAREA";
  }
  ["copy","cut","paste","contextmenu"].forEach(evt=>{
    document.addEventListener(evt,(e)=>{ if(!isAllowedTarget(e.target)) e.preventDefault(); },{capture:true});
  });
  // bloquear seleção por teclado
  document.addEventListener("keydown",(e)=>{
    const k=e.key.toLowerCase();
    const ctrl=e.ctrlKey||e.metaKey;
    if(ctrl && (k==="c" || k==="v" || k==="x" || k==="a")){
      if(!isAllowedTarget(e.target)) e.preventDefault();
    }
  },{capture:true});
  // impedir arrastar seleção
  document.addEventListener("selectstart",(e)=>{ if(!isAllowedTarget(e.target)) e.preventDefault(); },{capture:true});
})();

function showToast(s){ els.toast.textContent=s; els.toast.classList.remove("hidden"); setTimeout(()=>els.toast.classList.add("hidden"),2000); }
function showLoader(on){ els.loader.classList.toggle("hidden",!on); }
const kv=(k,v)=>`<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`;
const onlyDigits=(s)=>String(s||"").replace(/\D/g,"");
const norm6=(n)=>{ const d=onlyDigits(n); return d.length>6?d.slice(-6):d.padStart(6,"0"); };
const toBrDate=(s)=>{
  if(!s) return ""; const str=String(s).trim();
  let m=str.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return `${m[3]}/${m[2]}/${m[1]}`;
  m=str.match(/^(\d{4})(\d{2})(\d{2})$/); if(m) return `${m[3]}/${m[2]}/${m[1]}`;
  m=str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(m) return str;
  return str;
};
const brMon=(n)=>(n??0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const cnpjMask=(c)=>{const s=onlyDigits(c).padStart(14,"0");return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12,14)}`;};

// ripple pos para .btn-press
document.addEventListener("pointerdown",(e)=>{
  const b=e.target.closest(".btn-press");
  if(!b) return;
  const r=b.getBoundingClientRect();
  b.style.setProperty("--x", `${e.clientX - r.left}px`);
  b.style.setProperty("--y", `${e.clientY - r.top }px`);
});

// ===== SINTEGRA parser (essenciais R10 e R50)
function parseSintegra(text){
  const lines=text.split(/\r?\n/).filter(l=>l.trim().length>0);
  const byType=new Map(); const push=(t,o)=>{ if(!byType.has(t)) byType.set(t,{items:[]}); byType.get(t).items.push(o); };

  for(const raw of lines){
    const tipo=raw.slice(0,2);
    if(tipo==="10"){
      push("10",{ CNPJ:raw.slice(2,16), IE:raw.slice(16,30).trim(), Razao:raw.slice(30,65).trim(),
        Mun:raw.slice(65,95).trim(), UF:raw.slice(95,97).trim(), DataIni:raw.slice(107,115), DataFim:raw.slice(115,123) });
    } else if(tipo==="50"){
      push("50",{ Data:raw.slice(30,38), UF:raw.slice(38,40).trim(), Modelo:raw.slice(40,42).trim(),
        Serie:raw.slice(42,45).trim(), Numero:raw.slice(45,51).trim(), CFOP:raw.slice(51,55).trim(),
        Emit:raw.slice(55,56).trim(),
        VTotal: (parseFloat(raw.slice(56,69))||0)/100,
        Bc:     (parseFloat(raw.slice(69,82))||0)/100,
        Icms:   (parseFloat(raw.slice(82,95))||0)/100,
        Isenta: (parseFloat(raw.slice(95,108))||0)/100,
        Outras: (parseFloat(raw.slice(108,121))||0)/100,
        Aliq:   (parseFloat(raw.slice(121,125))||0)/100,
        Sit: raw.slice(125,126).trim()
      });
    }
  }
  return { byType };
}

// ===== XML helpers
function textXML(doc, path){
  const parts=path.split(">"); let ctx=doc;
  for(const p of parts){ const el=ctx.getElementsByTagName(p)[0]; if(!el) return ""; ctx=el; }
  return ctx.textContent||"";
}
function extractFromXMLString(xml){
  const doc=new DOMParser().parseFromString(xml,"application/xml");
  const mod=textXML(doc,"ide>mod"); const serie=textXML(doc,"ide>serie"); const nNF=textXML(doc,"ide>nNF");
  const vNF=parseFloat(textXML(doc,"total>ICMSTot>vNF")||textXML(doc,"vNF")||"0");
  const dh=textXML(doc,"ide>dhEmi")||textXML(doc,"ide>dEmi"); const data=toBrDate(dh);
  const emit=textXML(doc,"emit>CNPJ")||textXML(doc,"emit>CPF");
  const dest=textXML(doc,"dest>CNPJ")||textXML(doc,"dest>CPF");
  const inf=doc.getElementsByTagName("infNFe")[0]; const chave=inf?(inf.getAttribute("Id")||"").replace(/^NFe/,""):"";
  return { Modelo:mod, Serie:serie, NumeroOriginal:nNF, Numero:norm6(nNF), Valor:vNF, DataEmissao:data, EmitCNPJ:emit, DestCNPJ:dest, Chave:chave };
}

// ===== Resumo simples (R50)
function resumoSintegra(result){
  const r10=result.byType.get("10")?.items?.[0];
  const empresa=r10?`${r10.Razao||""} • CNPJ ${cnpjMask(r10.CNPJ||"")} • ${r10.Mun||""}/${r10.UF||""}`:"";
  const periodo=r10?`${toBrDate(r10.DataIni)} a ${toBrDate(r10.DataFim)}`:"";

  const r50=result.byType.get("50")?.items||[];
  let ent=0, sai=0, set=new Set();
  for(const n of r50){
    const cf=(n.CFOP||"")[0]; const key=`${n.Modelo}-${n.Serie}-${norm6(n.Numero)}`; set.add(key);
    if(["1","2","3"].includes(cf)) ent+=n.VTotal||0;
    if(["5","6","7"].includes(cf)) sai+=n.VTotal||0;
  }
  return { empresa, periodo, totalEntradas:ent, totalSaidas:sai, qtdNotas:set.size };
}
function renderTopo(sum){
  if(!sum) return els.resumoTop.innerHTML="";
  els.resumoTop.innerHTML = [
    kv("Empresa", sum.empresa),
    kv("Período", sum.periodo),
    kv("Total Entradas (R50)", brMon(sum.totalEntradas)),
    kv("Total Saídas (R50)", brMon(sum.totalSaidas)),
    kv("Qtde Notas R50 únicas", sum.qtdNotas)
  ].join("");
}

// ===== Upload handlers + animação dropzone
function bindDropArea(area, input){
  ;["dragenter","dragover"].forEach(ev=>area.addEventListener(ev,(e)=>{e.preventDefault();area.classList.add("active");}));
  ;["dragleave","drop"].forEach(ev=>area.addEventListener(ev,(e)=>{e.preventDefault();area.classList.remove("active");}));
  area.addEventListener("drop",(e)=>{
    const f=e.dataTransfer?.files?.[0]; if(f) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event("change")); }
  });
}
bindDropArea(els.dzSin, els.sinEntradas);
bindDropArea(els.dzZip, els.zipEntradas);

els.btnSinEntradas.onclick=()=>els.sinEntradas.click();
els.btnZipEntradas.onclick=()=>els.zipEntradas.click();

els.sinEntradas.onchange=(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  showLoader(true);
  const fr=new FileReader();
  fr.onload=()=>{
    state.sinEnt=parseSintegra(String(fr.result||""));
    els.infoSinEntradas.textContent=`${f.name} ${(f.size/1024).toFixed(1)} KB`;
    renderTopo(resumoSintegra(state.sinEnt));
    showLoader(false);
    tryCompareEntradas();
  };
  fr.readAsText(f);
};

els.zipEntradas.onchange=async(e)=>{
  const f=e.target.files?.[0]; if(!f) return;
  showLoader(true);
  els.infoZipEntradas.textContent=`${f.name} ${(f.size/1024).toFixed(1)} KB`;
  const zip=await JSZip.loadAsync(f);
  const rows=[]; let cnpjCli=null;
  const r10=state.sinEnt?.byType.get("10")?.items?.[0]; if(r10) cnpjCli=onlyDigits(r10.CNPJ);
  const files=Object.values(zip.files).filter(z=>!z.dir && z.name.toLowerCase().endsWith(".xml"));
  for(const zf of files){
    const xml=await zf.async("string");
    try{ const x=extractFromXMLString(xml); if(cnpjCli && onlyDigits(x.DestCNPJ)!==cnpjCli) continue; rows.push(x); }catch{}
  }
  state.zipEnt={rows};
  els.sumZipEntradas.innerHTML=[
    kv("XMLs lidos", files.length),
    kv("Notas únicas", new Set(rows.map(r=>r.Numero)).size),
    kv("Total vNF", brMon(rows.reduce((a,b)=>a+(b.Valor||0),0)))
  ].join("");
  showLoader(false);
  tryCompareEntradas();
};

// ===== Comparação Entradas
function tryCompareEntradas(){
  if(!state.sinEnt || !state.zipEnt) return;
  const r50=state.sinEnt.byType.get("50")?.items||[];
  const entradas=r50.filter(n=>["1","2","3"].includes(String(n.CFOP||"")[0]));

  const mapS=new Map(), mapSDate=new Map();
  for(const n of entradas){
    const k=norm6(n.Numero);
    mapS.set(k,(mapS.get(k)||0)+(n.VTotal||0));
    if(!mapSDate.has(k)) mapSDate.set(k,toBrDate(n.Data||""));
  }

  const rows=state.zipEnt.rows; const mapX=new Map(), mapXDate=new Map(), detX=new Map();
  for(const x of rows){
    const k=x.Numero; mapX.set(k,(mapX.get(k)||0)+(x.Valor||0));
    if(!mapXDate.has(k)) mapXDate.set(k,x.DataEmissao||"");
    if(!detX.has(k)) detX.set(k,x);
  }

  const onlyXML=[], common=[];
  for(const [k,v] of mapX){
    if(!mapS.has(k)){
      const d=detX.get(k);
      onlyXML.push({ Numero:d.NumeroOriginal||k, DataEmissao:d.DataEmissao, Valor:v, Chave:d.Chave, Produto:"" });
    }else{
      common.push({ Numero:k, DataXML:mapXDate.get(k)||"", DataS:mapSDate.get(k)||"", vXML:v, vS:mapS.get(k)||0 });
    }
  }

  els.tbOnlyXmlEnt.innerHTML=onlyXML.map((r,i)=>`<tr><td>${i+1}</td><td>${r.Numero}</td><td>${r.DataEmissao}</td><td>${brMon(r.Valor)}</td><td>${r.Chave||""}</td><td>${r.Produto||""}</td></tr>`).join("");
  els.tbCommonEnt.innerHTML=common.map((r,i)=>`<tr><td>${i+1}</td><td>${r.Numero}</td><td>${r.DataXML}</td><td>${r.DataS}</td><td>${brMon(r.vXML)}</td><td>${brMon(r.vS)}</td></tr>`).join("");

  // resumo rápido no topo
  const totS=entradas.reduce((s,n)=>s+(n.VTotal||0),0);
  const totXML=(rows||[]).reduce((s,r)=>s+(r.Valor||0),0);
  const res = [
    kv("Total Entradas SINTEGRA (R50)", brMon(totS)),
    kv("Total Entradas XML", brMon(totXML)),
    kv("Diferença", brMon(totS-totXML))
  ].join("");
  els.resumoTop.insertAdjacentHTML("afterbegin", res);

  showToast("Entradas comparadas");
}

// ===== Relatórios
els.btnOpenReport.onclick=()=>{
  els.reportName.value = "RELATORIO DE COMPARACAO ENTRADAS";
  els.modal.classList.remove("hidden");
};
els.reportCancel.onclick=()=>els.modal.classList.add("hidden");
els.reportOk.onclick=()=>{
  const type=document.querySelector('input[name="rtype"]:checked')?.value||"pdf";
  let name=els.reportName.value.trim();
  if(!name) name = "RELATORIO DE COMPARACAO ENTRADAS";
  els.modal.classList.add("hidden");
  if(type==="pdf") exportPDF_Entradas(name); else exportXLSX_Entradas(name);
};

// PDF
function exportPDF_Entradas(name){
  const { jsPDF } = window.jspdf; const doc=new jsPDF({unit:"pt",format:"a4"});
  const r10=state.sinEnt?.byType.get("10")?.items?.[0]||{};
  const header=`ANALISE DE NOTAS DE ENTRADAS - ${r10.Razao||""} • CNPJ ${cnpjMask(r10.CNPJ||"")}`;

  doc.setFillColor(194,58,58); doc.rect(0,0,595,70,"F"); doc.setTextColor(255,255,255); doc.setFontSize(14); doc.text(header,24,42);
  let y=90;

  const r50=state.sinEnt?.byType.get("50")?.items||[];
  const totS=r50.filter(n=>["1","2","3"].includes(String(n.CFOP||"")[0]))
               .reduce((s,n)=>s+(n.VTotal||0),0);
  const totXML=(state.zipEnt?.rows||[]).reduce((s,r)=>s+(r.Valor||0),0);

  doc.autoTable({
    startY:y, head:[["Indicador","Valor"]],
    body:[
      ["Total Entradas SINTEGRA (R50)", brMon(totS)],
      ["Total Entradas XML", brMon(totXML)],
      ["Diferença", brMon(totS-totXML)]
    ],
    styles:{fontSize:9,lineColor:[200,60,60],lineWidth:.3,textColor:[40,40,40]},
    headStyles:{fillColor:[200,60,60],textColor:[255,255,255],halign:"left"},
    theme:"grid", margin:{left:24,right:24}
  });
  y=doc.lastAutoTable.finalY+18;

  const onlyRows=Array.from(els.tbOnlyXmlEnt.querySelectorAll("tr")).map(tr=>Array.from(tr.children).map(td=>td.textContent));
  doc.autoTable({ startY:y, head:[["#","Número","Data Emissão","Valor","Chave","Produto"]], body:onlyRows,
    styles:{fontSize:8,lineColor:[220,220,220],lineWidth:.2}, headStyles:{fillColor:[240,240,240],textColor:[30,30,30]},
    theme:"grid", margin:{left:24,right:24}
  });
  y=doc.lastAutoTable.finalY+18;

  const commonRows=Array.from(els.tbCommonEnt.querySelectorAll("tr")).map(tr=>Array.from(tr.children).map(td=>td.textContent));
  doc.autoTable({ startY:y, head:[["#","Número 6 dígitos","Data Emissão XML","Data Emissão SINTEGRA","Valor XML","Valor SINTEGRA"]], body:commonRows,
    styles:{fontSize:8,lineColor:[220,220,220],lineWidth:.2}, headStyles:{fillColor:[240,240,240],textColor:[30,30,30]},
    theme:"grid", margin:{left:24,right:24}
  });

  doc.save(`${name}.pdf`);
}

// XLSX
function setAutoWidths(ws, rows){
  const cols=rows[0]?.length||0; const widths=Array(cols).fill(10);
  for(const r of rows){ r.forEach((c,i)=>{ const len=String(c??"").length; widths[i]=Math.max(widths[i], Math.min(60, len+4)); }); }
  ws["!cols"]=widths.map(w=>({wch:w}));
}
function exportXLSX_Entradas(name){
  const wb=XLSX.utils.book_new();

  const onlyRows=[["#","Número","Data Emissão","Valor","Chave","Produto"]];
  onlyRows.push(...Array.from(els.tbOnlyXmlEnt.querySelectorAll("tr")).map(tr=>Array.from(tr.children).map(td=>td.textContent)));
  const ws1=XLSX.utils.aoa_to_sheet(onlyRows); setAutoWidths(ws1,onlyRows); XLSX.utils.book_append_sheet(wb, ws1, "NOTAS NÃO LANÇADAS");

  const commonRows=[["#","Número 6 dígitos","Data Emissão XML","Data Emissão SINTEGRA","Valor XML","Valor SINTEGRA"]];
  commonRows.push(...Array.from(els.tbCommonEnt.querySelectorAll("tr")).map(tr=>Array.from(tr.children).map(td=>td.textContent)));
  const ws2=XLSX.utils.aoa_to_sheet(commonRows); setAutoWidths(ws2,commonRows); XLSX.utils.book_append_sheet(wb, ws2, "Notas em comum");

  // Resumo
  const r50=state.sinEnt?.byType.get("50")?.items||[];
  const totS=r50.filter(n=>["1","2","3"].includes(String(n.CFOP||"")[0]))
               .reduce((s,n)=>s+(n.VTotal||0),0);
  const totXML=(state.zipEnt?.rows||[]).reduce((s,r)=>s+(r.Valor||0),0);
  const resumo=[["Indicador","Valor"],["Total Entradas SINTEGRA (R50)",brMon(totS)],["Total Entradas XML",brMon(totXML)],["Diferença",brMon(totS-totXML)]];
  const ws3=XLSX.utils.aoa_to_sheet(resumo); setAutoWidths(ws3,resumo); XLSX.utils.book_append_sheet(wb, ws3, "Resumo");

  XLSX.writeFile(wb, `${name}.xlsx`);
}

// ===== Inicial
window.addEventListener("DOMContentLoaded",()=>{
  els.modal.classList.add("hidden");
  els.loader.classList.add("hidden");
});
