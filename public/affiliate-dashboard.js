(function(){'use strict';
  const $=id=>document.getElementById(id),sections=['links','campaigns','coupons','freeDaysCodes','dailyReports','redemptions','commissions','payouts','financeLedger','vipBenefits'];
  const labels={draft:'Rascunho',active:'Ativa',approved:'Aprovada',suspended:'Suspensa',paused:'Pausada',ended:'Encerrada',pending:'Pendente',paid:'Paga',requested:'Solicitado',rejected:'Rejeitado',recorded:'Registrado',retired:'Encerrado'};
  let data=null,cursors={},activeUrl='';
  const el=(tag,value)=>{const item=document.createElement(tag);if(value!==undefined)item.textContent=String(value);return item;};
  const fmtCount=value=>new Intl.NumberFormat('pt-BR').format(Number(value)||0);
  const fmtMoney=(cents,currency='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency}).format((Number(cents)||0)/100);
  const fmtDate=value=>value?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(new Date(Number(value))):'—';
  function notify(value,type='info'){$('message').textContent=value;$('message').className='notice '+type;}
  $('site-link').href=window.X_BUNNY_SITE_ORIGIN+'/';
  if(!window.firebase||!window.DK_FIREBASE_CONFIG){notify('Firebase Authentication indisponível.','error');return;}
  firebase.initializeApp(window.DK_FIREBASE_CONFIG);
  async function api(action,body={}){
    const user=firebase.auth().currentUser;if(!user)throw new Error('Entre com sua conta X-Bunny Animes.');
    const response=await fetch('/api/affiliates/'+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify(body),cache:'no-store'});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Falha ao consultar seus dados.');return result;
  }
  function metric(label,value){const box=el('div');box.className='metric';box.append(el('small',label),el('strong',value));return box;}
  function benefit(label,value){const box=el('div');box.className='benefit-card';box.append(el('small',label),el('strong',value));return box;}
  function row(title,detail,meta){const item=el('div');item.className='row';const left=el('div');left.append(el('strong',title),el('small',detail));item.append(left);if(meta){const right=el('small',meta);right.className='row-meta';item.append(right);}return item;}
  function sectionRow(name,item){
    if(name==='campaigns')return row(item.name||'Campanha',`${labels[item.status]||item.status||'—'} · ${item.commissionPercent||0}% + ${fmtMoney(item.fixedPurchaseCents||0)} por compra · até ${fmtDate(item.expiresAt)}`,`${fmtCount(item.used)} / ${item.maxUses||'∞'} usos`);
    if(name==='links')return row(item.code||'Link',`${item.campaign||'Geral'} · ${item.active?'Ativo':labels[item.status]||'Rascunho'}`,item.active?'Compartilhável':'Aguarda ativação');
    if(name==='coupons')return row(item.code||'Cupom',`${item.discountPercent||0}% na primeira compra · ${item.campaign||'Campanha'}`,`${fmtCount(item.used)} / ${fmtCount(item.maxUses)} usos · ${labels[item.status]||item.status}`);
    if(name==='freeDaysCodes')return row(item.code||'Código',`${item.freeDays||0} dias grátis · ${item.campaign||'Campanha'}`,`${fmtCount(item.used)} / ${fmtCount(item.maxUses)} usos · ${labels[item.status]||item.status}`);
    if(name==='dailyReports')return row(item.date||'Dia',`${fmtCount(item.clicks)} acessos · ${fmtCount(item.signups)} cadastros`,`${fmtCount(item.conversions)} conversões`);
    if(name==='redemptions')return row(item.code||'Resgate',`${labels[item.status]||item.status||'Registrado'} · ${fmtDate(item.at)}`);
    if(name==='financeLedger')return row(item.kind||'Movimento',`${fmtMoney(item.amountCents)} · ${fmtDate(item.at)}`,item.id);
    if(name==='vipBenefits')return row(`${item.days} dia(s) de VIP`,`Concedido em ${fmtDate(item.at)}`,`Até ${fmtDate(item.expiresAt)}`);
    if(name==='commissions'||name==='payouts')return row(fmtMoney(item.amountCents||Math.round((Number(item.amount)||0)*100),item.currency||'BRL'),`${labels[item.status]||item.status||'Pendente'} · ${fmtDate(item.at)}`,name==='commissions'?'Comissão':'Saque');
    return row(item.id||'Registro','');
  }
  function renderList(name,items,append=false){const root=$(name);if(!append)root.replaceChildren();else for(const empty of root.querySelectorAll('.empty'))empty.remove();for(const item of items||[])root.append(sectionRow(name,item));
    if(!root.children.length){const empty=el('p',name==='links'?'Nenhum link atribuído ainda.':'Nenhum registro disponível.');empty.className='empty';root.append(empty);}
    document.querySelector(`[data-more="${name}"]`).hidden=!cursors[name];
  }
  function renderCampaignOptions(){const active=(data.campaigns||[]).filter(item=>item.status==='active');
    for(const select of document.querySelectorAll('.campaign-options')){const keepGeneral=select.closest('#link-form');select.replaceChildren();
      if(keepGeneral)select.append(new Option('Geral',''));
      for(const campaign of active)select.append(new Option(campaign.name,campaign.id));
    }
    $('coupon-form').hidden=!data.partner.permissions.canIssueCoupons||!active.length||data.partner.status!=='approved';
    $('free-days-form').hidden=!data.partner.permissions.canIssueFreeDaysCodes||!(Number(data.partner.benefits.freeDaysCodeLimit)>0)||!active.length||data.partner.status!=='approved';
  }
  function render(){const totals=data.totals,currency='BRL';
    $('partner-name').textContent=data.partner.label||'parceiro';$('partner-status').textContent=labels[data.partner.status]||data.partner.status;
    $('totals').replaceChildren(metric('Acessos ao link',fmtCount(totals.clicks)),metric('Visitantes estimados',fmtCount(totals.uniqueVisitorsEstimated)),
      metric('Conversões',fmtCount(totals.conversions)),metric('Compras confirmadas',fmtCount(totals.confirmedPurchases)),
      metric('Cupons utilizados',fmtCount(totals.couponRedemptions)),metric('Dias grátis resgatados',fmtCount(totals.freeDaysRedemptions)),
      metric('Cadastros',fmtCount(totals.signups)),metric('Total de resgates',fmtCount(totals.redemptions)));
    for(const name of sections)renderList(name,name==='dailyReports'?data.daily:data[name]);
    const active=(data.links||[]).find(item=>item.active===true&&item.status==='active');
    activeUrl=active?new URL('/?ref='+encodeURIComponent(active.code),window.X_BUNNY_SITE_ORIGIN).href:'';
    $('featured-link').textContent=activeUrl||'Nenhum link ativo';$('copy-link').disabled=!activeUrl;
    $('link-note').textContent=activeUrl?'Seu link está ativo para divulgação.':'Links em rascunho ainda não registram indicações no site.';
    $('link-form').hidden=!data.settings.allowPartnerLinks||!data.partner.permissions.canCreateLinks||data.partner.status!=='approved';
    renderCampaignOptions();
    const benefits=data.partner.benefits||{},account=data.accountBenefits||{};
    $('benefits-list').replaceChildren(benefit('Plano registrado na conta',account.plan||'Não informado'),
      benefit('VIP válido até',fmtDate(account.vipUntil)),benefit('Bônus de comissão',`${Number(benefits.commissionBoostPercent)||0}%`),
      benefit('Fixo por compra',fmtMoney(benefits.fixedPurchaseCents||0)),
      benefit('Recompensa por código grátis',fmtMoney(benefits.freeDaysRewardCents||0)),
      benefit('Limite de códigos de dias grátis',fmtCount(benefits.freeDaysCodeLimit)));
    $('rules').textContent=data.settings.commissionDescription||'As regras de comissão ainda não foram publicadas.';
    const finance=data.finance;
    $('finance-summary').replaceChildren(finance?metric('Comissões pendentes',fmtMoney(totals.commissionPendingCents,currency)):metric('Financeiro','Acesso restrito'),
      finance?metric('Comissões aprovadas',fmtMoney(totals.commissionApprovedCents,currency)):metric('Saldo','—'),
      finance?metric('Comissões pagas',fmtMoney(totals.commissionPaidCents,currency)):metric('Saques','—'),
      finance?metric('Saldo disponível verificado',finance.ledgerVerified?fmtMoney(finance.availableCents,currency):'Aguardando conciliação'):metric('Histórico','—'));
    $('payout-form').hidden=!finance?.canRequestPayout||data.partner.status!=='approved';
    $('payout-note').textContent=!finance?'Sua permissão financeira está desabilitada.':!data.settings.payoutsEnabled?'Solicitações de saque não estão habilitadas pelo administrador.':!finance.ledgerVerified?'O saldo precisa ser verificado no servidor antes de solicitar saque.':finance.availableCents<=0?'Não há saldo disponível para saque.':`Disponível para solicitar: ${fmtMoney(finance.availableCents,currency)}.`;
    $('app').hidden=false;
  }
  async function refresh(){notify('Carregando seus dados…','loading');$('refresh').disabled=true;
    try{data=await api('report',{limit:20});cursors=data.pages||{};render();notify('Dados atualizados.');}
    catch(error){if(!data)$('app').hidden=true;notify(error.message,'error');}
    finally{$('refresh').disabled=false;}
  }
  for(const name of sections)document.querySelector(`[data-more="${name}"]`).onclick=async event=>{
    event.currentTarget.disabled=true;notify('Carregando mais registros…','loading');
    try{const result=await api('report',{section:name,after:cursors[name],limit:20});cursors[name]=result.nextCursor;
      renderList(name,result.items,true);notify('Mais registros carregados.');}catch(error){notify(error.message,'error');}
    finally{event.currentTarget.disabled=false;}
  };
  $('copy-link').onclick=async()=>{if(!activeUrl)return;try{await navigator.clipboard.writeText(activeUrl);notify('Link copiado.');}catch(_){notify('Não foi possível copiar o link.','error');}};
  async function submitCode(event,action,payload){event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
    try{const result=await api(action,payload(form));form.reset();await refresh();const record=result.link||result.coupon||result.freeDaysCode;
      notify(`Código ${record.code} criado em rascunho. Aguarde a ativação no site.`);}catch(error){notify(error.message,'error');}
    finally{button.disabled=false;}
  }
  $('link-form').onsubmit=event=>submitCode(event,'myLink',form=>({campaignId:form.elements.campaignId.value}));
  $('coupon-form').onsubmit=event=>submitCode(event,'myCoupon',form=>({campaignId:form.elements.campaignId.value,
    discountPercent:Number(form.elements.discountPercent.value),maxUses:Number(form.elements.maxUses.value)}));
  $('free-days-form').onsubmit=event=>submitCode(event,'myFreeDaysCode',form=>({campaignId:form.elements.campaignId.value,
    freeDays:Number(form.elements.freeDays.value),maxUses:Number(form.elements.maxUses.value)}));
  let payoutRequestId='';
  $('payout-form').elements.amount.addEventListener('input',()=>{payoutRequestId='';});
  $('payout-form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button');button.disabled=true;
    const cents=Math.round(Number(form.elements.amount.value)*100);
    try{if(!Number.isSafeInteger(cents)||cents<1||cents>data.finance.availableCents)throw new Error('Informe um valor dentro do saldo disponível.');
      if(!payoutRequestId)payoutRequestId=Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
      await api('payout',{amountCents:cents,requestId:payoutRequestId});payoutRequestId='';form.reset();await refresh();notify('Solicitação enviada para análise.');}
    catch(error){notify(error.message,'error');}finally{button.disabled=false;}
  };
  $('refresh').onclick=refresh;$('logout').onclick=()=>firebase.auth().signOut().then(()=>location.assign('index.html'));
  for(const link of document.querySelectorAll('.nav-link'))link.onclick=()=>{for(const item of document.querySelectorAll('.nav-link'))item.classList.remove('active');link.classList.add('active');};
  firebase.auth().onAuthStateChanged(user=>{if(user)refresh();else{$('app').hidden=true;notify('Entre pelo início deste painel com uma conta autorizada.','error');}});
})();
