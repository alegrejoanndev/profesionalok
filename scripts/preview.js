(function(){
  var root=document.getElementById('pv');
  var pages=[].slice.call(root.querySelectorAll('[data-page]'));
  var DLG={}; try{DLG=JSON.parse(document.getElementById('pv-dlg').textContent)}catch(e){}
  var note=document.getElementById('pv-note'),nt;
  function say(m){note.textContent=m;note.classList.add('on');clearTimeout(nt);nt=setTimeout(function(){note.classList.remove('on')},4200)}
  function page(k){return root.querySelector('[data-page="'+k+'"]')}
  function cur(){return pages.filter(function(p){return !p.hidden})[0]}
  function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}

  /* ---------- directorio: filtros ---------- */
  var dirForm=page('profesionales').querySelector('form');
  var FIELDS=['zona','especialidad','corriente','obra','modalidad'];
  function panel(){return dirForm.querySelector('[id$="-mas"]')}
  function openPanel(on){var p=panel();if(!p)return;p.classList.toggle('grid',on);p.classList.toggle('hidden',!on);
    var b=dirForm.querySelector('button[aria-controls]');if(b)b.setAttribute('aria-expanded',String(on))}
  function applyQuery(q){
    var sp=new URLSearchParams(q||''),adv=false;
    FIELDS.forEach(function(n){var el=dirForm.elements[n];if(el){el.value=sp.get(n)||'';if(sp.get(n)&&/^(especialidad|corriente|obra|modalidad)$/.test(n))adv=true}});
    var ed=sp.get('edad')||'';
    [].forEach.call(dirForm.querySelectorAll('input[name=edad]'),function(r){r.checked=(r.value===ed)});
    openPanel(adv);
  }
  function parseZonas(z){return (z||'').split(/[,;\/]|\s+y\s+/i).map(norm).map(function(s){return s.trim()}).filter(Boolean).slice(0,6)}
  function filter(){
    var v={};FIELDS.forEach(function(n){var el=dirForm.elements[n];v[n]=el?el.value:''});
    var edr=dirForm.querySelector('input[name=edad]:checked');v.edad=edr?edr.value:'';
    var zonas=parseZonas(v.zona),shown=0;
    [].forEach.call(page('profesionales').querySelectorAll('article[data-pv-card]'),function(a){
      var ok=true,esp=JSON.parse(a.dataset.esp),cor=JSON.parse(a.dataset.corr),obr=JSON.parse(a.dataset.obra);
      if(v.especialidad&&esp.indexOf(v.especialidad)<0)ok=false;
      if(v.corriente&&cor.indexOf(v.corriente)<0)ok=false;
      if(v.obra&&obr.indexOf(v.obra)<0)ok=false;
      if(v.edad&&a.dataset.edad.split(',').indexOf(v.edad)<0)ok=false;
      if(v.modalidad&&a.dataset.mod!==v.modalidad&&a.dataset.mod!=='AMBAS')ok=false;
      if(zonas.length){var z=norm(a.dataset.zona);ok=ok&&zonas.some(function(t){return z.indexOf(t)>=0})}
      a.style.display=ok?'':'none'; if(ok)shown++;
    });
    var c=[].filter.call(page('profesionales').querySelectorAll('p'),function(p){return /^\d+ (profesional|psicólog)/.test(p.textContent.trim())})[0];
    if(c)c.textContent=c.textContent.replace(/^\d+ \S+/,shown+(shown===1?' psicólogo':' psicólogos'));
    document.getElementById('pv-empty').style.display=shown?'none':'block';
  }

  /* ---------- navegación ---------- */
  function go(k,q){
    if(!page(k))k='home';
    var closeDlg=root.querySelector('dialog[open]');if(closeDlg&&closeDlg.close)closeDlg.close();
    pages.forEach(function(p){p.hidden=p.dataset.page!==k});
    if(k==='profesionales'){if(q!=null)applyQuery(q);filter()}
    var nk=/^asociar/.test(k)?'asociar':k;
    root.querySelectorAll('header nav a[data-go]').forEach(function(a){
      var on=a.dataset.go===nk;
      if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
      var s=a.querySelector('span');if(s){s.classList.toggle('scale-x-100',on);s.classList.toggle('scale-x-0',!on)}
    });
    var m=document.getElementById('menu-movil');
    if(m){m.classList.remove('grid-rows-[1fr]');m.classList.add('grid-rows-[0fr]');m.setAttribute('inert','')}
    var bt=root.querySelector('header button[aria-controls="menu-movil"]');if(bt)bt.setAttribute('aria-expanded','false');
    window.scrollTo(0,0);
    try{history.replaceState(null,'','#'+k)}catch(e){}
  }

  /* ---------- alta: cartel de verificación (simula el padrón del Colegio) ---------- */
  var KNOWN={'1234':'ok','777':'baja'};
  function datos(){
    var p=page('asociar'),inputs=[].slice.call(p.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file])'));
    var sel=p.querySelector('select');
    return {lic:(inputs[4]&&inputs[4].value||'').replace(/\D/g,'').replace(/^0+/,''),prov:sel?sel.value:''};
  }
  function esSantaFe(prov){return norm(prov).indexOf('santa fe')===0}
  function openDialog(){
    var d=page('asociar').querySelector('dialog');if(!d)return;
    d.innerHTML=esSantaFe(datos().prov)?DLG.notice_sf:DLG.notice_other;
    try{d.showModal()}catch(e){d.setAttribute('open','')}
  }
  function resultDialog(){
    var x=datos();
    return KNOWN[x.lic]==='ok'?DLG.result_ok:DLG.result_bad;
  }

  /* ---------- alta: "agregar otra" (especialidades, corrientes, obras sociales) ---------- */
  function addChip(btn){
    var box=btn.parentElement,input=box.querySelector('input[type=text],input:not([type])');
    var fs=btn.closest('fieldset');if(!input||!fs)return;
    var val=input.value.trim().replace(/\s+/g,' ');
    if(!/^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .,()\-\/+&'’]{1,59}$/.test(val)){say('Usá solo letras y números, de 2 a 60 caracteres.');return}
    val=val.charAt(0).toUpperCase()+val.slice(1);
    var labels=[].slice.call(fs.querySelectorAll('label')).filter(function(l){return l.querySelector('input[type=checkbox],input[type=radio]')});
    var hit=labels.filter(function(l){return norm(l.textContent)===norm(val)})[0];
    if(hit){hit.querySelector('input').checked=true}
    else{
      var tpl=labels[labels.length-1],n=tpl.cloneNode(true);
      n.querySelector('input').checked=true;n.querySelector('span').textContent=val;n.querySelector('span').title='Agregada por vos';
      tpl.parentNode.insertBefore(n,tpl.nextSibling);
    }
    input.value='';
  }

  /* ---------- alta: subida del título / foto ---------- */
  var TYPES={pdf:1,jpg:1,jpeg:1,png:1,webp:1};
  function onFile(inp){
    var lab=inp.closest('label'),f=inp.files&&inp.files[0];if(!lab)return;
    var old=lab.parentNode.querySelector('[data-pv-file]');if(old)old.remove();
    if(!f)return;
    var ext=(f.name.split('.').pop()||'').toLowerCase(),msg='';
    if(!TYPES[ext])msg='Usá una imagen JPG, PNG, WebP o un PDF';
    else if(f.size>8*1024*1024)msg='El archivo pesa '+(f.size/1048576).toFixed(1)+' MB. El máximo es 8 MB.';
    var p=document.createElement('p');p.setAttribute('data-pv-file','');p.setAttribute('role',msg?'alert':'status');
    p.className='mt-3 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium '+(msg?'bg-pink/15':'bg-lime');
    p.textContent=msg?msg:'✓ '+f.name+' · '+(f.size/1048576).toFixed(1)+' MB';
    lab.parentNode.insertBefore(p,lab.nextSibling);
    if(msg)inp.value='';
  }
  document.addEventListener('change',function(e){if(e.target.matches&&e.target.matches('input[type=file]'))onFile(e.target)});

  document.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(a){
      if(a.dataset.go){e.preventDefault();go(a.dataset.go,a.dataset.go==='profesionales'?(a.dataset.q||''):null);return}
      if(a.dataset.pv==='other'){e.preventDefault();say('Vista previa: esta pantalla existe en el sitio real.');return}
      var h=a.getAttribute('href')||'';
      if(h.length>1&&h.charAt(0)==='#'&&!a.dataset.go){e.preventDefault();var c=cur(),t=c&&c.querySelector('#'+CSS.escape(h.slice(1)));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});return}
      if(h==='#'){e.preventDefault();return}
      return;
    }
    var b=e.target.closest('button');if(!b)return;
    var txt=b.textContent.replace(/\s+/g,' ').trim();
    var p=cur(),k=p&&p.dataset.page;
    if(b.getAttribute('aria-controls')==='menu-movil'){
      var m=document.getElementById('menu-movil'),open=b.getAttribute('aria-expanded')==='true';
      b.setAttribute('aria-expanded',String(!open));
      m.classList.toggle('grid-rows-[1fr]',!open);m.classList.toggle('grid-rows-[0fr]',open);
      if(open)m.setAttribute('inert','');else m.removeAttribute('inert');
      return;
    }
    if(b.closest('dialog')){
      var d=b.closest('dialog');
      if(/^Entendido/.test(txt)){if(!esSantaFe(datos().prov)){d.close();go('asociar2');return}d.innerHTML=resultDialog();return}
      if(/^Darme de baja/.test(txt)){d.close();go('home');say('Vista previa: en el sitio real no se guarda nada y volvés al inicio.');return}
      if(/^Corregir|^Cerrar/.test(txt)){d.close();return}
      if(/^Continuar/.test(txt)){d.close();go('asociar2');return}
      return;
    }
    if(b.hasAttribute('aria-controls')&&k==='profesionales'){openPanel(b.getAttribute('aria-expanded')!=='true');return}
    if(/^Agregar/.test(txt)&&/^asociar/.test(k||'')){addChip(b);return}
    if(k==='asociar'&&/^Continuar/.test(txt)){openDialog();return}
    if(k==='asociar2'&&/^Continuar/.test(txt)){
      var fi=page('asociar2').querySelectorAll('input[type=file]'),last=fi[fi.length-1],ok=!!(last&&last.closest('label')&&last.closest('label').parentNode.querySelector('[data-pv-file][role=status]'));
      if(!ok){say('Subí el archivo de tu título (JPG, PNG, WebP o PDF) para continuar.');return}
      go('asociar3');return;
    }
    if(k==='asociar2'&&/Volver/.test(txt)){go('asociar');return}
    if(k==='asociar3'&&/Volver/.test(txt)){go('asociar2');return}
    if(k==='asociar3'){say('Vista previa: acá se abre Mercado Pago. Son 3 meses gratis: hoy no se cobra nada.');return}
    if(/^asociar/.test(k||'')){say('Vista previa: esto funciona al ejecutar el proyecto.');return}
  });

  document.addEventListener('submit',function(e){
    e.preventDefault();
    var f=e.target;
    if(f.matches('[role=search]')){
      var q=new URLSearchParams();new FormData(f).forEach(function(v,n){if(String(v).trim())q.set(n,String(v).trim())});
      go('profesionales',q.toString());
    }else say('Vista previa: en el sitio real este formulario envía los datos.');
  });

  var h=(location.hash||'').replace('#','');
  go(page(h)?h:'home',null);
})();
